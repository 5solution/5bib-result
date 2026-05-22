import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type { Redis } from 'ioredis';
import { Model } from 'mongoose';
import { Repository } from 'typeorm';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { env } from 'src/config';
import {
  Reconciliation,
  ReconciliationDocument,
} from './schemas/reconciliation.schema';
import {
  MerchantConfig,
  MerchantConfigDocument,
} from '../merchant/schemas/merchant-config.schema';
import {
  ReconciliationCronLog,
  ReconciliationCronLogDocument,
} from './schemas/reconciliation-cron-log.schema';
import { Tenant } from '../merchant/entities/tenant.entity';
import { ReconciliationQueryService } from './services/reconciliation-query.service';
import { ReconciliationCalcService } from './services/reconciliation-calc.service';
import { ReconciliationPreflightService } from './services/reconciliation-preflight.service';
import { XlsxService } from './services/xlsx.service';
import { DocxService } from './services/docx.service';
import { PreviewReconciliationDto } from './dto/preview-reconciliation.dto';
import { CreateReconciliationDto } from './dto/create-reconciliation.dto';
import { UpdateReconciliationStatusDto } from './dto/update-reconciliation-status.dto';
import { BatchCreateReconciliationDto } from './dto/batch-create-reconciliation.dto';
import { DeleteBatchResponseDto } from './dto/delete-batch.dto';

const BUCKET_NAME = env.s3.bucket;
const REGION = env.s3.region;

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);
  private s3Client: S3Client;

  constructor(
    private queryService: ReconciliationQueryService,
    private calcService: ReconciliationCalcService,
    private preflightService: ReconciliationPreflightService,
    private xlsxService: XlsxService,
    private docxService: DocxService,
    @InjectModel(Reconciliation.name)
    private reconciliationModel: Model<ReconciliationDocument>,
    @InjectModel(MerchantConfig.name)
    private configModel: Model<MerchantConfigDocument>,
    @InjectModel(ReconciliationCronLog.name)
    private cronLogModel: Model<ReconciliationCronLogDocument>,
    @InjectRepository(Tenant, 'platform')
    private tenantRepo: Repository<Tenant>,
    @Optional() @InjectRedis() private readonly redis?: Redis,
  ) {
    this.s3Client = new S3Client({
      region: REGION,
      credentials: {
        accessKeyId: env.s3.accessKeyId,
        secretAccessKey: env.s3.secretAccessKey,
      },
    });
  }

  /**
   * FEATURE-040 BR-40-11 — invalidate PnL fee cache after recon mutation
   * affecting (tenant_id, mysql_race_id). Race-to-tenant is 1:1 on platform,
   * so flushing pattern `pnl:*:tenant=<tenantId>` is correct + sufficient.
   * Also flushes aggregated dashboard/list (no tenant suffix in key).
   */
  private async flushPnLCacheForRecon(
    tenantId: number,
    mysqlRaceId: number,
  ): Promise<void> {
    if (!this.redis) return;
    try {
      const pattern = `pnl:*:tenant=${tenantId}`;
      const keys: string[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stream = (this.redis as any).scanStream({
        match: pattern,
        count: 200,
      });
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: string[]) => keys.push(...chunk));
        stream.on('end', () => resolve());
        stream.on('error', (e: Error) => reject(e));
      });
      if (keys.length > 0) {
        const pipe = this.redis.pipeline();
        for (const k of keys) pipe.del(k);
        await pipe.exec();
      }
      // Aggregated keys — broader sweep
      const aggKeys: string[] = [];
      for (const aggPattern of ['pnl:dashboard:*', 'pnl:contracts-list:*']) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const s = (this.redis as any).scanStream({
          match: aggPattern,
          count: 200,
        });
        await new Promise<void>((resolve, reject) => {
          s.on('data', (chunk: string[]) => aggKeys.push(...chunk));
          s.on('end', () => resolve());
          s.on('error', (e: Error) => reject(e));
        });
      }
      if (aggKeys.length > 0) {
        const pipe = this.redis.pipeline();
        for (const k of aggKeys) pipe.del(k);
        await pipe.exec();
      }
      this.logger.log(
        `[F-040] flushed PnL cache after recon mutation tenantId=${tenantId} raceId=${mysqlRaceId} — scoped=${keys.length}, aggregated=${aggKeys.length}`,
      );
    } catch (e) {
      this.logger.warn(
        `[F-040] flushPnLCacheForRecon fail tenantId=${tenantId} raceId=${mysqlRaceId}: ${(e as Error).message}`,
      );
    }
  }

  async preview(dto: PreviewReconciliationDto) {
    const tenant = await this.queryService.getTenant(dto.tenant_id);
    const config = await this.configModel.findOne({ tenantId: dto.tenant_id });

    // F-043 BR-43-05/16 — Cascade resolution với feeSource attribution.
    // DTO values (admin preview override) ABSOLUTE priority.
    // Else: event_fee_overrides[raceId] + effective_from <= period_start → TIER 0
    // Else: MerchantConfig.service_fee_rate → TIER 1 merchant_default
    // Else: null (preview KHÔNG auto-fallback 5.5% — UI hiển thị "chưa cấu hình")
    const override = config?.event_fee_overrides?.find(
      (o) =>
        o.raceId === dto.mysql_race_id &&
        o.effective_from <= dto.period_start,
    );

    let feeRate: number | null;
    let feeSource:
      | 'admin_preview_override'
      | 'event_override'
      | 'merchant_default'
      | 'unconfigured';
    if (dto.fee_rate_applied != null) {
      feeRate = dto.fee_rate_applied;
      feeSource = 'admin_preview_override';
    } else if (override?.service_fee_rate != null) {
      feeRate = Number(override.service_fee_rate);
      feeSource = 'event_override';
    } else if (config?.service_fee_rate != null) {
      feeRate = Number(config.service_fee_rate);
      feeSource = 'merchant_default';
    } else {
      feeRate = null;
      feeSource = 'unconfigured';
    }

    const manualFeePerTicket =
      dto.manual_fee_per_ticket ??
      override?.manual_fee_per_ticket ??
      config?.manual_fee_per_ticket ??
      5000;
    const feeVatRate =
      dto.fee_vat_rate ??
      override?.fee_vat_rate ??
      config?.fee_vat_rate ??
      0;

    const { fiveBibOrders, manualOrders, missingPaymentRef } =
      await this.queryService.queryOrders(
        dto.mysql_race_id,
        dto.period_start,
        dto.period_end,
      );

    const summary = this.calcService.calculateSummary(
      fiveBibOrders,
      manualOrders,
      feeRate,
      manualFeePerTicket,
      feeVatRate,
      0,
    );

    const lineItems = this.calcService.buildLineItems(fiveBibOrders);
    const manualOrderRows = this.calcService.buildManualOrders(manualOrders);

    return {
      tenant_name: tenant?.name ?? '',
      tenant_metadata: tenant?.metadata ?? {},
      fee_rate_applied: feeRate,
      manual_fee_per_ticket: manualFeePerTicket,
      fee_vat_rate: feeVatRate,
      // F-043 BR-43-16 — Nguồn fee rate (admin UI dùng để render badge)
      fee_source: feeSource,
      // F-043 — Override metadata nếu fee_source = 'event_override' (UI tooltip)
      event_override_meta:
        feeSource === 'event_override' && override
          ? {
              effective_from: override.effective_from,
              note: override.note,
            }
          : null,
      ...summary,
      line_items: lineItems,
      manual_orders: manualOrderRows,
      missing_payment_ref_count: missingPaymentRef.length,
      raw_5bib_order_count: fiveBibOrders.length,
      raw_manual_order_count: manualOrders.length,
    };
  }

  async create(dto: CreateReconciliationDto): Promise<ReconciliationDocument> {
    const tenant = await this.queryService.getTenant(dto.tenant_id);

    const feeRate = dto.fee_rate_applied ?? null;
    const manualFeePerTicket = dto.manual_fee_per_ticket ?? 5000;
    const feeVatRate = dto.fee_vat_rate ?? 0;
    const manualAdjustment = dto.manual_adjustment ?? 0;

    const { fiveBibOrders, manualOrders } =
      await this.queryService.queryOrders(
        dto.mysql_race_id,
        dto.period_start,
        dto.period_end,
      );

    const summary = this.calcService.calculateSummary(
      fiveBibOrders,
      manualOrders,
      feeRate,
      manualFeePerTicket,
      feeVatRate,
      manualAdjustment,
    );

    const lineItems = this.calcService.buildLineItems(fiveBibOrders);
    const manualOrderRows = this.calcService.buildManualOrders(manualOrders);

    // Run pre-flight to determine flags and status
    const period = dto.period_start.slice(0, 7); // YYYY-MM
    const preflight = await this.preflightService.run(
      dto.tenant_id,
      period,
      dto.mysql_race_id,
    );
    const flags = this.preflightService.extractFlags(preflight);
    const status = this.preflightService.determineStatus(flags);

    const doc = await this.reconciliationModel.create({
      tenant_id: dto.tenant_id,
      mysql_race_id: dto.mysql_race_id,
      race_title: dto.race_title,
      tenant_name: tenant?.name ?? '',
      period_start: dto.period_start,
      period_end: dto.period_end,
      fee_rate_applied: feeRate,
      manual_fee_per_ticket: manualFeePerTicket,
      fee_vat_rate: feeVatRate,
      ...summary,
      manual_adjustment: manualAdjustment,
      adjustment_note: dto.adjustment_note ?? null,
      status,
      flags,
      created_source: (dto as any).created_source ?? 'manual',
      xlsx_url: null,
      docx_url: null,
      created_by: dto.created_by ?? null,
      reviewed_by: null,
      reviewed_at: null,
      approved_by: null,
      approved_at: null,
      signed_at: null,
      signed_date_str: dto.signed_date_str ?? null,
      line_items: lineItems,
      manual_orders: manualOrderRows,
      raw_5bib_orders: fiveBibOrders,
      raw_manual_orders: manualOrders,
    });

    // Attach tenant metadata for DOCX generation
    (doc as any).tenant_metadata = tenant?.metadata ?? {};

    const generateXlsx = dto.generate_xlsx !== false;
    const generateDocx = dto.generate_docx !== false;

    if (generateXlsx) {
      try {
        const buf = await this.xlsxService.generate(doc);
        const url = await this.uploadBuffer(
          buf,
          `reconciliations/${doc._id}/reconciliation.xlsx`,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        if (url) doc.xlsx_url = url;
      } catch (err) {
        console.error('XLSX generation error:', err);
      }
    }

    if (generateDocx) {
      try {
        const buf = await this.docxService.generate(doc);
        const url = await this.uploadBuffer(
          buf,
          `reconciliations/${doc._id}/reconciliation.docx`,
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        );
        if (url) doc.docx_url = url;
      } catch (err) {
        console.error('DOCX generation error:', err);
      }
    }

    await doc.save();

    // F-040 BR-40-11 — flush PnL cache (recon doc may overlap a contract period
    // and switch its feeSource from SELF_COMPUTE → RECONCILIATION on next read)
    await this.flushPnLCacheForRecon(dto.tenant_id, dto.mysql_race_id);

    return doc;
  }

  async getAllMerchantIds(): Promise<number[]> {
    const configs = await this.configModel.find({}, { tenantId: 1 }).lean();
    return configs.map((c) => c.tenantId);
  }

  /**
   * F-058 BR-58-08 — Aggregate Reconciliation totals per (tenantId, month) cho
   * discrepancy-check endpoint.
   *
   * Match logic:
   *   - tenant_id === tenantId
   *   - period_start <= monthEnd AND period_end >= monthStart (overlap)
   *   - status ∈ ['signed','reviewed','completed','sent'] (finalized only)
   *
   * Trả về tổng fee + GMV + danh sách _id của các doc đã aggregate.
   * Read-only. Idempotent.
   */
  async getTotalsByTenantMonth(
    tenantId: number,
    month: string,
  ): Promise<{
    totalServiceFee: number;
    totalManualFee: number;
    totalVat: number;
    totalFee: number;
    totalNetGmv: number;
    reconCount: number;
    reconciliationIds: string[];
  }> {
    // Validate month YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new NotFoundException(`Invalid month format: ${month}`);
    }
    const { period_start, period_end } = this.parsePeriod(month);

    // Aggregate reconciliations với period overlap tháng đó
    const docs = await this.reconciliationModel
      .find(
        {
          tenant_id: tenantId,
          status: { $in: ['signed', 'reviewed', 'completed', 'sent'] },
          period_start: { $lte: period_end },
          period_end: { $gte: period_start },
        },
        {
          _id: 1,
          fee_amount: 1,
          fee_vat_amount: 1,
          manual_fee_amount: 1,
          net_revenue: 1,
        },
      )
      .lean()
      .exec();

    let totalServiceFee = 0;
    let totalManualFee = 0;
    let totalVat = 0;
    let totalNetGmv = 0;
    const ids: string[] = [];

    for (const d of docs) {
      totalServiceFee += Number(d.fee_amount ?? 0);
      totalVat += Number(d.fee_vat_amount ?? 0);
      totalManualFee += Number(d.manual_fee_amount ?? 0);
      totalNetGmv += Number(d.net_revenue ?? 0);
      ids.push(String((d as { _id: unknown })._id));
    }

    return {
      totalServiceFee: Math.round(totalServiceFee),
      totalManualFee: Math.round(totalManualFee),
      totalVat: Math.round(totalVat),
      totalFee: Math.round(totalServiceFee + totalManualFee + totalVat),
      totalNetGmv: Math.round(totalNetGmv),
      reconCount: docs.length,
      reconciliationIds: ids,
    };
  }

  async findAll(filters: {
    tenant_id?: number;
    mysql_race_id?: number;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: any[]; total: number }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const query: Record<string, any> = {};
    if (filters.tenant_id) query.tenant_id = filters.tenant_id;
    if (filters.mysql_race_id) query.mysql_race_id = filters.mysql_race_id;
    if (filters.status) query.status = filters.status;

    const [data, total] = await Promise.all([
      this.reconciliationModel
        .find(query, {
          raw_5bib_orders: 0,
          raw_manual_orders: 0,
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.reconciliationModel.countDocuments(query),
    ]);

    return { data, total };
  }

  async findOne(id: string): Promise<ReconciliationDocument> {
    const doc = await this.reconciliationModel.findById(id);
    if (!doc) throw new NotFoundException(`Reconciliation ${id} not found`);
    return doc;
  }

  async updateStatus(
    id: string,
    dto: UpdateReconciliationStatusDto,
  ): Promise<ReconciliationDocument> {
    const doc = await this.findOne(id);

    doc.status = dto.status;

    if (dto.status === 'reviewed') {
      doc.reviewed_at = new Date();
      if (dto.reviewed_by) doc.reviewed_by = dto.reviewed_by;
    }

    if (dto.status === 'approved') {
      doc.approved_at = new Date();
      if (dto.approved_by) doc.approved_by = dto.approved_by;
    }

    if (dto.status === 'signed') {
      doc.signed_at = dto.signed_at ? new Date(dto.signed_at) : new Date();
    }

    await doc.save();

    // F-040 BR-40-11 — flush PnL cache when status crosses whitelist boundary.
    // Whitelist = {signed, reviewed, completed, sent}. Any status change in or
    // out of this set could flip feeSource; safe to flush unconditionally.
    await this.flushPnLCacheForRecon(doc.tenant_id, doc.mysql_race_id);

    return doc;
  }

  async regenerate(
    id: string,
    type: 'xlsx' | 'docx' | 'both',
  ): Promise<ReconciliationDocument> {
    const doc = await this.findOne(id);
    const tenant = await this.queryService.getTenant(doc.tenant_id);
    (doc as any).tenant_metadata = tenant?.metadata ?? {};

    if (type === 'xlsx' || type === 'both') {
      const buf = await this.xlsxService.generate(doc);
      const url = await this.uploadBuffer(
        buf,
        `reconciliations/${doc._id}/reconciliation.xlsx`,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      if (url) doc.xlsx_url = url;
    }

    if (type === 'docx' || type === 'both') {
      const buf = await this.docxService.generate(doc);
      const url = await this.uploadBuffer(
        buf,
        `reconciliations/${doc._id}/reconciliation.docx`,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
      if (url) doc.docx_url = url;
    }

    await doc.save();
    return doc;
  }

  async batchCreate(dto: BatchCreateReconciliationDto): Promise<{
    created: number;
    skipped: number;
    failed: number;
    results: Array<{
      merchant_id: number;
      merchant_name: string;
      race_id: number;
      race_title: string;
      status: 'created' | 'skipped' | 'failed';
      reason?: string;
      reconciliation_id?: string;
    }>;
  }> {
    let merchantIds: number[];
    if (dto.merchant_ids === 'all') {
      merchantIds = await this.getAllMerchantIds();
    } else {
      merchantIds = dto.merchant_ids;
    }

    const { period_start, period_end } = this.parsePeriod(dto.period);

    const results: Array<{
      merchant_id: number;
      merchant_name: string;
      race_id: number;
      race_title: string;
      status: 'created' | 'skipped' | 'failed';
      reason?: string;
      reconciliation_id?: string;
    }> = [];

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const merchantId of merchantIds) {
      let merchantName = `Merchant #${merchantId}`;
      try {
        const preflight = await this.preflightService.run(merchantId, dto.period);
        merchantName = preflight.merchant_name;

        const config = await this.configModel.findOne({ tenantId: merchantId }).lean();

        if (dto.skip_errors) {
          const hasErrors = preflight.warnings.some((w) => w.severity === 'ERROR');
          if (hasErrors) {
            for (const race of preflight.races_with_orders) {
              results.push({
                merchant_id: merchantId,
                merchant_name: merchantName,
                race_id: race.race_id,
                race_title: race.race_name,
                status: 'skipped',
                reason: 'Skipped due to ERROR-severity preflight flags',
              });
              skipped++;
            }
            continue;
          }
        }

        for (const race of preflight.races_with_orders) {
          try {
            const existing = await this.reconciliationModel.findOne({
              tenant_id: merchantId,
              mysql_race_id: race.race_id,
              period_start,
              period_end,
            });

            if (existing) {
              results.push({
                merchant_id: merchantId,
                merchant_name: merchantName,
                race_id: race.race_id,
                race_title: race.race_name,
                status: 'skipped',
                reason: 'Reconciliation already exists for this period',
                reconciliation_id: String(existing._id),
              });
              skipped++;
              continue;
            }

            const doc = await this.create({
              tenant_id: merchantId,
              mysql_race_id: race.race_id,
              race_title: race.race_name,
              period_start,
              period_end,
              fee_rate_applied: config?.service_fee_rate ?? 5.5,
              manual_fee_per_ticket: config?.manual_fee_per_ticket ?? 5000,
              fee_vat_rate: config?.fee_vat_rate ?? 0,
              manual_adjustment: 0,
              adjustment_note: null,
              signed_date_str: null,
              generate_xlsx: true,
              generate_docx: true,
              created_by: null,
              created_source: 'batch',
            } as any);

            results.push({
              merchant_id: merchantId,
              merchant_name: merchantName,
              race_id: race.race_id,
              race_title: race.race_name,
              status: 'created',
              reconciliation_id: String(doc._id),
            });
            created++;
          } catch (err) {
            results.push({
              merchant_id: merchantId,
              merchant_name: merchantName,
              race_id: race.race_id,
              race_title: race.race_name,
              status: 'failed',
              reason: err.message,
            });
            failed++;
          }
        }
      } catch (err) {
        results.push({
          merchant_id: merchantId,
          merchant_name: merchantName,
          race_id: 0,
          race_title: '—',
          status: 'failed',
          reason: err.message,
        });
        failed++;
      }
    }

    return { created, skipped, failed, results };
  }

  async delete(id: string): Promise<void> {
    // Fetch tenant+race BEFORE delete for cache flush hook (F-040 BR-40-11)
    const existing = await this.reconciliationModel
      .findById(id, { tenant_id: 1, mysql_race_id: 1 })
      .lean();
    const result = await this.reconciliationModel.deleteOne({ _id: id });
    if (result.deletedCount === 0) throw new NotFoundException(`Reconciliation ${id} not found`);
    if (existing) {
      await this.flushPnLCacheForRecon(existing.tenant_id, existing.mysql_race_id);
    }
  }

  /**
   * FEATURE-025 — Bulk delete reconciliations by IDs.
   *
   * - Uses Mongoose `deleteMany({_id:{$in:ids}})` — 1 RTT MongoDB regardless N.
   * - Admin trust philosophy (PAUSE-25-02): KHÔNG block bất kỳ status nào.
   * - Idempotent: IDs không tồn tại counted vào `not_found`, KHÔNG throw 404
   *   (khác `delete(id)` single — bulk semantics đặc biệt cho UX bulk action).
   * - Audit via `Logger.warn` (PAUSE-25-03): KHÔNG cần MongoDB audit collection.
   * - DTO `DeleteBatchDto` đã enforce 1≤N≤50 + valid ObjectId hex tại layer
   *   validation, nên KHÔNG có CastError tại service layer.
   */
  async deleteMany(ids: string[]): Promise<DeleteBatchResponseDto> {
    // F-040 BR-40-11 — capture affected (tenant_id, mysql_race_id) pairs
    // BEFORE delete so cache flush hooks can fire after delete completes.
    const existing = await this.reconciliationModel
      .find({ _id: { $in: ids } }, { tenant_id: 1, mysql_race_id: 1 })
      .lean();

    const result = await this.reconciliationModel.deleteMany({
      _id: { $in: ids },
    });
    const deleted = result.deletedCount;
    const not_found = ids.length - deleted;

    this.logger.warn('reconciliation_bulk_delete', {
      ids_count: ids.length,
      deleted_count: deleted,
      not_found_count: not_found,
    });

    // Flush PnL cache per affected (tenant, race) pair (deduped)
    const affected = new Set<string>();
    for (const e of existing) {
      affected.add(`${e.tenant_id}:${e.mysql_race_id}`);
    }
    for (const pair of affected) {
      const [tenantStr, raceStr] = pair.split(':');
      await this.flushPnLCacheForRecon(Number(tenantStr), Number(raceStr));
    }

    return { deleted, not_found };
  }

  async getCronLogs(limit = 12) {
    return this.cronLogModel.find({}).sort({ ran_at: -1 }).limit(limit).lean();
  }

  /**
   * FEATURE-003 BR-10 — Audit reconciliations whose stored period_start/period_end
   * does NOT snap to month-boundary. Read-only, no mutation.
   */
  async auditPeriodBoundary(): Promise<{
    total: number;
    items: Array<{
      id: string;
      tenant_id: number;
      tenant_name: string;
      race_title: string;
      period_start: string;
      period_end: string;
      expected_period_start: string;
      expected_period_end: string;
      deviation_start_days: number;
      deviation_end_days: number;
    }>;
  }> {
    const docs = await this.reconciliationModel
      .find(
        {},
        {
          _id: 1,
          tenant_id: 1,
          tenant_name: 1,
          race_title: 1,
          period_start: 1,
          period_end: 1,
        },
      )
      .lean();

    const items = docs.flatMap((doc) => {
      const start = doc.period_start ?? '';
      const end = doc.period_end ?? '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
        return [];
      }
      const expectedStart = `${start.slice(0, 7)}-01`;
      const [yEnd, mEnd] = end.split('-').map(Number);
      const lastDay = new Date(Date.UTC(yEnd, mEnd, 0)).getUTCDate();
      const expectedEnd = `${end.slice(0, 7)}-${String(lastDay).padStart(2, '0')}`;
      const dStart = this.diffDays(start, expectedStart);
      const dEnd = this.diffDays(end, expectedEnd);
      if (dStart === 0 && dEnd === 0) return [];
      return [
        {
          id: String(doc._id),
          tenant_id: doc.tenant_id,
          tenant_name: doc.tenant_name ?? '',
          race_title: doc.race_title ?? '',
          period_start: start,
          period_end: end,
          expected_period_start: expectedStart,
          expected_period_end: expectedEnd,
          deviation_start_days: dStart,
          deviation_end_days: dEnd,
        },
      ];
    });

    return { total: items.length, items };
  }

  private diffDays(a: string, b: string): number {
    const ta = Date.UTC(
      Number(a.slice(0, 4)),
      Number(a.slice(5, 7)) - 1,
      Number(a.slice(8, 10)),
    );
    const tb = Date.UTC(
      Number(b.slice(0, 4)),
      Number(b.slice(5, 7)) - 1,
      Number(b.slice(8, 10)),
    );
    return Math.round((ta - tb) / 86400000);
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

  private async uploadBuffer(
    buffer: Buffer,
    key: string,
    contentType: string,
  ): Promise<string | null> {
    try {
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      });
      await this.s3Client.send(command);
      return `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${key}`;
    } catch (err) {
      console.error('S3 upload error:', err);
      return null;
    }
  }
}
