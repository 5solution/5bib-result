import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ReconciliationQueryService } from './reconciliation-query.service';
import { ReconciliationCalcService } from './reconciliation-calc.service';
import {
  Reconciliation,
  ReconciliationDocument,
} from '../schemas/reconciliation.schema';
import {
  MerchantConfig,
  MerchantConfigDocument,
} from '../../merchant/schemas/merchant-config.schema';

export interface PreflightFlag {
  type: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  message: string;
  count: number | null;
}

export interface PreflightRaceResult {
  race_id: number;
  race_name: string;
  order_count: number;
  gross_revenue: number;
  manual_order_count: number;
  ordinary_missing_payment_ref: number;
}

export interface PreflightRaceSkipped {
  race_id: number;
  race_name: string;
  reason: string;
}

export interface PreflightResult {
  tenant_id: number;
  merchant_name: string;
  period: string;
  can_create: boolean;
  races_with_orders: PreflightRaceResult[];
  races_skipped: PreflightRaceSkipped[];
  warnings: PreflightFlag[];
  summary: {
    total_orders: number;
    estimated_gross_revenue: number;
    estimated_fee: number | null;
  };
}

const HIGH_MANUAL_RATIO_THRESHOLD = 20; // %

@Injectable()
export class ReconciliationPreflightService {
  constructor(
    private readonly queryService: ReconciliationQueryService,
    private readonly calcService: ReconciliationCalcService,
    @InjectModel(Reconciliation.name)
    private readonly reconciliationModel: Model<ReconciliationDocument>,
    @InjectModel(MerchantConfig.name)
    private readonly configModel: Model<MerchantConfigDocument>,
  ) {}

  /**
   * Run pre-flight for a single merchant + period.
   * If mysql_race_id provided: check only that race.
   * Otherwise: check all races of the merchant.
   */
  async run(
    tenant_id: number,
    period: string, // YYYY-MM
    mysql_race_id?: number,
  ): Promise<PreflightResult> {
    const { period_start, period_end } = this.parsePeriod(period);
    const tenant = await this.queryService.getTenant(tenant_id);
    const config = await this.configModel.findOne({ tenantId: tenant_id }).lean();

    const merchantName = tenant?.name ?? `Merchant #${tenant_id}`;
    const warnings: PreflightFlag[] = [];
    const racesWithOrders: PreflightRaceResult[] = [];
    const racesSkipped: PreflightRaceSkipped[] = [];

    // --- Check: fee rate ---
    if (!config?.service_fee_rate) {
      warnings.push({
        type: 'NO_FEE_RATE',
        severity: 'ERROR',
        message: 'Merchant chưa thiết lập service_fee_rate',
        count: null,
      });
    }

    // --- Get races to check ---
    let racesToCheck: Array<{ race_id: string; title: string }> = [];
    if (mysql_race_id) {
      // Single race mode — find title from tenant races
      const allRaces = await this.queryService.getRacesByTenant(tenant_id);
      const found = allRaces.find((r) => Number(r.race_id) === mysql_race_id);
      racesToCheck = [{ race_id: String(mysql_race_id), title: found?.title ?? `Race #${mysql_race_id}` }];
    } else {
      racesToCheck = await this.queryService.getRacesByTenant(tenant_id);
    }

    // --- Check each race ---
    for (const race of racesToCheck) {
      const raceId = Number(race.race_id);
      const raceName = race.title;

      const { fiveBibOrders, manualOrders, missingPaymentRef, unknownCategoryCount } =
        await this.queryService.queryOrders(raceId, period_start, period_end);

      const totalOrders = fiveBibOrders.length + manualOrders.length;

      if (totalOrders === 0 && unknownCategoryCount === 0) {
        racesSkipped.push({ race_id: raceId, race_name: raceName, reason: 'Không có giao dịch trong kỳ' });
        continue;
      }

      // Calc estimated gross revenue
      const uniqueFiveBib = this.dedup(fiveBibOrders);
      const grossRevenue = uniqueFiveBib.reduce((s, r) => s + Number(r.subtotal_price || 0), 0);
      const uniqueManual = this.dedup(manualOrders);
      const manualRevenue = uniqueManual.reduce((s, r) => s + Number(r.subtotal_price || 0), 0);

      racesWithOrders.push({
        race_id: raceId,
        race_name: raceName,
        order_count: this.dedup(fiveBibOrders).length,
        gross_revenue: grossRevenue + manualRevenue,
        manual_order_count: this.dedup(manualOrders).length,
        ordinary_missing_payment_ref: missingPaymentRef.length,
      });

      // --- Race-level warnings ---
      // F-061 BR-61-04 — severity downgrade ERROR → WARNING + message update.
      // Sau F-061, ORDINARY/CHANGE_COURSE/PERSONAL_GROUP/etc thiếu payment_ref
      // = intentional MOU semantic (organizer self-collect, 5BIB charge phí
      // MANUAL 5000đ/vé). Preflight giữ WARNING level cho Sales Admin verify
      // giao kèo (PAUSE-61-04 = B) — KHÔNG block recon creation.
      if (missingPaymentRef.length > 0) {
        warnings.push({
          type: 'MISSING_PAYMENT_REF',
          severity: 'WARNING',
          message: `${missingPaymentRef.length} đơn ORDINARY/CHANGE_COURSE/nhóm thiếu payment_ref tại "${raceName}" — sẽ được tính như đơn thủ công (phí MANUAL). Xác nhận đúng giao kèo MOU?`,
          count: missingPaymentRef.length,
        });
      }

      // FEATURE-016 BR-04 — defensive guard: dirty/unknown order_category dropped silently
      if (unknownCategoryCount > 0) {
        warnings.push({
          type: 'UNKNOWN_CATEGORY_DROPPED',
          severity: 'ERROR',
          message: `${unknownCategoryCount} đơn có order_category không xác định bị bỏ qua tại "${raceName}" — liên hệ engineering để verify dữ liệu`,
          count: unknownCategoryCount,
        });
      }

      const manualRatio =
        totalOrders > 0 ? (manualOrders.length / totalOrders) * 100 : 0;
      if (manualRatio > HIGH_MANUAL_RATIO_THRESHOLD) {
        warnings.push({
          type: 'HIGH_MANUAL_RATIO',
          severity: 'WARNING',
          message: `Đơn MANUAL chiếm ${Math.round(manualRatio)}% tổng đơn tại "${raceName}" (ngưỡng cảnh báo: ${HIGH_MANUAL_RATIO_THRESHOLD}%)`,
          count: null,
        });
      }

      // --- Revenue spike/drop vs. previous month ---
      await this.checkRevenueAnomaly(tenant_id, raceId, period, grossRevenue + manualRevenue, warnings, raceName);

      // --- Fee changed in period ---
      await this.checkFeeChanged(tenant_id, period_start, period_end, warnings);
    }

    // --- Already exists check ---
    if (mysql_race_id) {
      const existing = await this.reconciliationModel.findOne({
        tenant_id,
        mysql_race_id,
        period_start,
        period_end,
      });
      if (existing) {
        warnings.push({
          type: 'ALREADY_EXISTS',
          severity: 'WARNING',
          message: `Đã có bản đối soát cho race này trong kỳ ${period}`,
          count: null,
        });
      }
    }

    const totalOrders = racesWithOrders.reduce((s, r) => s + r.order_count, 0);
    const totalGross = racesWithOrders.reduce((s, r) => s + r.gross_revenue, 0);
    const feeRate = config?.service_fee_rate ?? null;
    const estimatedFee = feeRate ? Math.round((totalGross * feeRate) / 100) : null;

    const hasErrors = warnings.some((w) => w.severity === 'ERROR');
    const hasOrders = racesWithOrders.length > 0;

    // can_create = false only when ZERO_ORDERS (no races with data)
    const can_create = hasOrders;

    return {
      tenant_id,
      merchant_name: merchantName,
      period,
      can_create,
      races_with_orders: racesWithOrders,
      races_skipped: racesSkipped,
      warnings,
      summary: {
        total_orders: totalOrders,
        estimated_gross_revenue: totalGross,
        estimated_fee: estimatedFee,
      },
    };
  }

  /**
   * FEATURE-003 BR-11 — Pre-flight for a single (tenant × race × range).
   * Supports multi-month range (period_start/period_end already validated to month-boundary).
   * Returns standard PreflightResult + adds RANGE_OVERLAP_WITH_EXISTING warnings if any
   * existing reconciliation (status != 'draft') overlaps the requested range.
   */
  async runRange(params: {
    tenant_id: number;
    mysql_race_id: number;
    period_start: string;
    period_end: string;
  }): Promise<PreflightResult & { overlap_warnings: Array<{ existing_id: string; existing_period_start: string; existing_period_end: string; existing_status: string }> }> {
    const { tenant_id, mysql_race_id, period_start, period_end } = params;
    const period = `${period_start.slice(0, 7)} → ${period_end.slice(0, 7)}`;
    const tenant = await this.queryService.getTenant(tenant_id);
    const config = await this.configModel.findOne({ tenantId: tenant_id }).lean();

    const merchantName = tenant?.name ?? `Merchant #${tenant_id}`;
    const warnings: PreflightFlag[] = [];
    const racesWithOrders: PreflightRaceResult[] = [];
    const racesSkipped: PreflightRaceSkipped[] = [];

    if (!config?.service_fee_rate) {
      warnings.push({
        type: 'NO_FEE_RATE',
        severity: 'ERROR',
        message: 'Merchant chưa thiết lập service_fee_rate',
        count: null,
      });
    }

    // Resolve race title
    const allRaces = await this.queryService.getRacesByTenant(tenant_id);
    const found = allRaces.find((r) => Number(r.race_id) === mysql_race_id);
    const raceName = found?.title ?? `Race #${mysql_race_id}`;

    const { fiveBibOrders, manualOrders, missingPaymentRef, unknownCategoryCount } =
      await this.queryService.queryOrders(mysql_race_id, period_start, period_end);

    const totalOrders = fiveBibOrders.length + manualOrders.length;

    // FEATURE-016 BR-04 — defensive guard: emit warning ngay cả khi totalOrders=0 nhưng có unknown
    if (unknownCategoryCount > 0) {
      warnings.push({
        type: 'UNKNOWN_CATEGORY_DROPPED',
        severity: 'ERROR',
        message: `${unknownCategoryCount} đơn có order_category không xác định bị bỏ qua tại "${raceName}" — liên hệ engineering để verify dữ liệu`,
        count: unknownCategoryCount,
      });
    }

    if (totalOrders === 0) {
      racesSkipped.push({
        race_id: mysql_race_id,
        race_name: raceName,
        reason: 'Không có giao dịch trong kỳ',
      });
    } else {
      const uniqueFiveBib = this.dedup(fiveBibOrders);
      const grossRevenue = uniqueFiveBib.reduce(
        (s, r) => s + Number(r.subtotal_price || 0),
        0,
      );
      const uniqueManual = this.dedup(manualOrders);
      const manualRevenue = uniqueManual.reduce(
        (s, r) => s + Number(r.subtotal_price || 0),
        0,
      );

      racesWithOrders.push({
        race_id: mysql_race_id,
        race_name: raceName,
        order_count: uniqueFiveBib.length,
        gross_revenue: grossRevenue + manualRevenue,
        manual_order_count: uniqueManual.length,
        ordinary_missing_payment_ref: missingPaymentRef.length,
      });

      // F-061 BR-61-04 — same downgrade trong runRange flow.
      if (missingPaymentRef.length > 0) {
        warnings.push({
          type: 'MISSING_PAYMENT_REF',
          severity: 'WARNING',
          message: `${missingPaymentRef.length} đơn ORDINARY/CHANGE_COURSE/nhóm thiếu payment_ref tại "${raceName}" — sẽ được tính như đơn thủ công (phí MANUAL). Xác nhận đúng giao kèo MOU?`,
          count: missingPaymentRef.length,
        });
      }

      const manualRatio =
        totalOrders > 0 ? (manualOrders.length / totalOrders) * 100 : 0;
      if (manualRatio > HIGH_MANUAL_RATIO_THRESHOLD) {
        warnings.push({
          type: 'HIGH_MANUAL_RATIO',
          severity: 'WARNING',
          message: `Đơn MANUAL chiếm ${Math.round(manualRatio)}% tổng đơn tại "${raceName}"`,
          count: null,
        });
      }
    }

    // BR-11 — Overlap detection for the same (tenant × race).
    // Caveat-01: status filter uses $ne 'draft' (schema enum has NO 'cancelled').
    const overlapDocs = await this.reconciliationModel
      .find(
        {
          tenant_id,
          mysql_race_id,
          period_start: { $lte: period_end },
          period_end: { $gte: period_start },
          status: { $ne: 'draft' },
        },
        { _id: 1, period_start: 1, period_end: 1, status: 1 },
      )
      .lean();

    const overlap_warnings = overlapDocs.map((d) => ({
      existing_id: String(d._id),
      existing_period_start: d.period_start,
      existing_period_end: d.period_end,
      existing_status: d.status,
    }));

    if (overlap_warnings.length > 0) {
      warnings.push({
        type: 'RANGE_OVERLAP_WITH_EXISTING',
        severity: 'WARNING',
        message: `Đã tồn tại ${overlap_warnings.length} bản đối soát giao thời cho race "${raceName}"`,
        count: overlap_warnings.length,
      });
    }

    const totalGross = racesWithOrders.reduce((s, r) => s + r.gross_revenue, 0);
    const feeRate = config?.service_fee_rate ?? null;
    const estimatedFee = feeRate ? Math.round((totalGross * feeRate) / 100) : null;
    const hasOrders = racesWithOrders.length > 0;

    return {
      tenant_id,
      merchant_name: merchantName,
      period,
      can_create: hasOrders,
      races_with_orders: racesWithOrders,
      races_skipped: racesSkipped,
      warnings,
      summary: {
        total_orders: racesWithOrders.reduce((s, r) => s + r.order_count, 0),
        estimated_gross_revenue: totalGross,
        estimated_fee: estimatedFee,
      },
      overlap_warnings,
    };
  }

  /** Compute flags array from a preflight result for embedding into a Reconciliation document */
  extractFlags(preflight: PreflightResult): PreflightFlag[] {
    return preflight.warnings;
  }

  /** Determine status from flags */
  determineStatus(flags: PreflightFlag[]): 'ready' | 'flagged' {
    const hasError = flags.some((f) => f.severity === 'ERROR');
    return hasError ? 'flagged' : 'ready';
  }

  private parsePeriod(period: string): { period_start: string; period_end: string } {
    const [year, month] = period.split('-').map(Number);
    const mm = String(month).padStart(2, '0');
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return {
      period_start: `${year}-${mm}-01`,
      period_end: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
    };
  }

  private dedup(rows: any[]): any[] {
    const seen = new Set<number>();
    return rows.filter((r) => {
      const id = Number(r.order_id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  private async checkRevenueAnomaly(
    tenant_id: number,
    mysql_race_id: number,
    period: string,
    currentRevenue: number,
    warnings: PreflightFlag[],
    raceName: string,
  ) {
    // Find previous period reconciliation for comparison
    const [year, month] = period.split('-').map(Number);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevPeriod = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
    const { period_start: ps, period_end: pe } = this.parsePeriod(prevPeriod);

    const prevRec = await this.reconciliationModel
      .findOne({ tenant_id, mysql_race_id, period_start: ps, period_end: pe })
      .lean();

    if (!prevRec || !prevRec.net_revenue) return;

    const prev = prevRec.net_revenue;
    if (prev === 0) return;

    const ratio = currentRevenue / prev;
    if (ratio > 1.5) {
      warnings.push({
        type: 'LARGE_REVENUE_SPIKE',
        severity: 'WARNING',
        message: `Doanh thu tháng này tăng ${Math.round((ratio - 1) * 100)}% so với tháng trước tại "${raceName}"`,
        count: null,
      });
    } else if (ratio < 0.5) {
      warnings.push({
        type: 'LARGE_REVENUE_DROP',
        severity: 'WARNING',
        message: `Doanh thu tháng này giảm ${Math.round((1 - ratio) * 100)}% so với tháng trước tại "${raceName}"`,
        count: null,
      });
    }
  }

  private async checkFeeChanged(
    tenant_id: number,
    period_start: string,
    period_end: string,
    warnings: PreflightFlag[],
  ) {
    // Check TenantFeeHistory for changes in this period
    // Use raw query since TenantFeeHistory is on the platform DB
    // This check is best-effort — skip if not available
    try {
      const rows: any[] = await this.queryService['tenantRepo'].manager.query(
        `SELECT COUNT(*) as cnt FROM tenant_fee_history
         WHERE tenant_id = ? AND changed_at >= ? AND changed_at <= ?`,
        [tenant_id, period_start + ' 00:00:00', period_end + ' 23:59:59'],
      );
      const cnt = Number(rows?.[0]?.cnt ?? 0);
      if (cnt > 0) {
        warnings.push({
          type: 'FEE_CHANGED_IN_PERIOD',
          severity: 'INFO',
          message: `Phí dịch vụ đã thay đổi ${cnt} lần trong kỳ đối soát`,
          count: cnt,
        });
      }
    } catch {
      // Ignore — table may not exist or no permission
    }
  }
}
