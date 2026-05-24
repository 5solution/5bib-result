import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRepository } from '@nestjs/typeorm';
import { Model } from 'mongoose';
import { Repository } from 'typeorm';
import { Tenant } from '../../merchant/entities/tenant.entity';
import {
  Reconciliation,
  ReconciliationDocument,
} from '../schemas/reconciliation.schema';
import {
  FIVE_BIB_CATEGORIES as SHARED_FIVE_BIB_CATEGORIES,
  SPLIT_BY_PAYMENT_REF,
  isPaymentRefEmpty,
} from '../../../common/constants/order-classification';

/**
 * FEATURE-016 v1.6.5 — extend FIVE_BIB_CATEGORIES to 6 categories.
 * FEATURE-061 v1.9.5 — unify SPLIT_BY_PAYMENT_REF logic.
 *
 * Trước F-016: array thiếu GROUP_BUY/GROUP_BUY_FIXED/CODE_TRANSFER → drop silently.
 * Sau F-016 (BR-01): 6 categories trong FIVE_BIB_CATEGORIES.
 *
 * Trước F-061: SPLIT_BY_PAYMENT_REF chỉ chứa 4 categories
 *   (PERSONAL_GROUP/GROUP_BUY/GROUP_BUY_FIXED/CODE_TRANSFER).
 *   ORDINARY + CHANGE_COURSE bị treat "pass-through 5BIB regardless" (BR-03 legacy)
 *   → bug 19 race MOU thu hộ ngoài 5BIB vẫn miss phí MANUAL ~25-40M VND/period.
 *
 * Sau F-061 (BR-61-01/02): cả 6 categories uniformly split theo payment_ref.
 *   - payment_ref truthy → 5BIB GMV path
 *   - payment_ref falsy/empty/whitespace → MANUAL semantic (intentional MOU)
 *
 * Shared constants moved sang `common/constants/order-classification.ts`
 * (PAUSE-61-BA-B) — 1 source of truth cho Reconciliation + Finance + Analytics
 * + Dashboard.
 */
const FIVE_BIB_CATEGORIES = new Set(SHARED_FIVE_BIB_CATEGORIES);

export interface QueryOrdersResult {
  fiveBibOrders: Record<string, unknown>[];
  manualOrders: Record<string, unknown>[];
  missingPaymentRef: Record<string, unknown>[];
  /**
   * FEATURE-016 BR-04 — số đơn có order_category KHÔNG match enum (vd: null, 'CORPORATE', future).
   * Preflight sẽ emit ERROR-severity warning UNKNOWN_CATEGORY_DROPPED nếu count > 0.
   * Defensive guard — KHÔNG silent drop dirty data.
   */
  unknownCategoryCount: number;
}

/**
 * FEATURE-040 — slice từ một reconciliation doc, dùng trong fee breakdown
 * payload và trong source-decision logic của FeeService.
 */
export interface ReconciledFeeSlice {
  reconciliationId: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  feeAmount: number;
  manualFeeAmount: number;
  finalizedAt: string | null;
  legacyWarning?: string;
  /** Source createdAt — used for legacy detection downstream. */
  createdAt: Date | null;
}

/** BR-40-03 — recon doc statuses considered "BBNT signed/equivalent". */
export const F040_RECON_STATUS_WHITELIST = [
  'signed',
  'reviewed',
  'completed',
  'sent',
] as const;

/** BR-40-12 — pre-F016 cutoff. Recon docs created before this date may have
 * underestimated fee_amount due to GROUP_BUY/CODE_TRANSFER drop. */
export const F040_PRE_F016_CUTOFF = new Date('2026-05-08T00:00:00.000Z');

@Injectable()
export class ReconciliationQueryService {
  private readonly logger = new Logger(ReconciliationQueryService.name);

  constructor(
    @InjectRepository(Tenant, 'platform')
    private tenantRepo: Repository<Tenant>,
    @InjectModel(Reconciliation.name)
    private reconciliationModel: Model<ReconciliationDocument>,
  ) {}

  async queryOrders(
    mysql_race_id: number,
    period_start: string,
    period_end: string,
  ): Promise<QueryOrdersResult> {
    const sql = `
      SELECT
        oli.id as oli_id, oli.order_id, o.order_category,
        oli.price AS line_price,
        o.name as full_name, o.email, o.last_name, o.first_name,
        o.phone_number, o.internal_status, o.payment_ref, o.processed_on,
        rc.name AS distance, tt.type_name, tt.price AS origin_price,
        oli.quantity AS qty, o.total_discounts, o.total_add_on_price,
        dc.code as discount_code, o.subtotal_price, o.total_price, o.vat_metadata
      FROM order_line_item oli
      LEFT JOIN order_metadata o ON oli.order_id = o.id
      LEFT JOIN ticket_type tt ON oli.ticket_type_id = tt.id
      LEFT JOIN race_course rc ON tt.race_course_id = rc.id
      LEFT JOIN discount_code dc ON o.discound_code_id = dc.id
      WHERE rc.race_id = ?
        AND o.internal_status = 'COMPLETE'
        AND o.processed_on >= ?
        AND o.processed_on <= ?
        AND o.deleted = 0
      ORDER BY o.order_category, oli.id ASC
    `;

    const rows: Record<string, unknown>[] = await this.tenantRepo.manager.query(
      sql,
      [mysql_race_id, period_start + ' 00:00:00', period_end + ' 23:59:59'],
    );

    return this.categorize(rows, mysql_race_id, period_start, period_end);
  }

  /**
   * FEATURE-016 BR-01..BR-04 — categorize order rows into 5BIB / manual / unknown.
   *
   * Pure function (testable). Logging side-effect for unknown categories.
   *
   * @param rows MySQL query result
   * @param mysql_race_id used for log context only
   * @param period_start used for log context only
   * @param period_end used for log context only
   */
  private categorize(
    rows: Record<string, unknown>[],
    mysql_race_id: number,
    period_start: string,
    period_end: string,
  ): QueryOrdersResult {
    const fiveBibOrders: Record<string, unknown>[] = [];
    const manualOrders: Record<string, unknown>[] = [];
    const unknownRows: Record<string, unknown>[] = [];
    // F-061 BR-61-04 — track orders that fell into MANUAL bucket BECAUSE
    // SPLIT-category had empty/missing payment_ref (intentional MOU per
    // PAUSE-61-01 = A). Preflight emit WARNING (not ERROR) cho Sales Admin
    // verify giao kèo MOU trước khi finalize recon.
    const missingPaymentRefFallback: Record<string, unknown>[] = [];

    for (const r of rows) {
      const category = r.order_category as string | null | undefined;

      // Defensive: null / undefined / unknown enum → drop with warning (BR-04)
      if (typeof category !== 'string') {
        unknownRows.push(r);
        continue;
      }

      if (category === 'MANUAL') {
        manualOrders.push(r);
        continue;
      }

      if (!FIVE_BIB_CATEGORIES.has(category)) {
        unknownRows.push(r);
        continue;
      }

      // F-061 BR-61-01/02 — unified payment_ref split cho TẤT CẢ 6 categories.
      // Trước F-061 có BR-03 special-case "ORDINARY/CHANGE_COURSE pass-through
      // 5BIB regardless" đã được DROP — giờ uniform logic 1 source of truth.
      // payment_ref empty/whitespace/null → MANUAL semantic (intentional MOU
      // organizer self-collect). Sales Admin có WARNING preflight verify intent.
      if (SPLIT_BY_PAYMENT_REF.has(category)) {
        const paymentRef = r.payment_ref as string | null | undefined;
        if (isPaymentRefEmpty(paymentRef)) {
          manualOrders.push(r);
          missingPaymentRefFallback.push(r);
        } else {
          fiveBibOrders.push(r);
        }
        continue;
      }

      // Defensive — không trúng nhánh nào ở trên (lý thuyết KHÔNG xảy ra vì
      // FIVE_BIB_CATEGORIES === SPLIT_BY_PAYMENT_REF sau F-061). Giữ làm
      // safety net cho future extend FIVE_BIB_CATEGORIES mà quên thêm vào
      // SPLIT_BY_PAYMENT_REF.
      unknownRows.push(r);
    }

    if (unknownRows.length > 0) {
      // Build category distribution for log context
      const distribution: Record<string, number> = {};
      for (const r of unknownRows) {
        const key = String(r.order_category ?? 'NULL');
        distribution[key] = (distribution[key] ?? 0) + 1;
      }
      this.logger.warn('Unknown order_category dropped during reconciliation query', {
        mysql_race_id,
        period_start,
        period_end,
        dropped_count: unknownRows.length,
        category_distribution: distribution,
      });
    }

    // F-061 BR-61-04 — `missingPaymentRef` semantic NOW = orders that landed
    // in MANUAL bucket DO TO empty payment_ref under SPLIT category (formerly
    // ORDINARY/CHANGE_COURSE were treated as "5BIB regardless"). Preflight
    // uses this to emit WARNING (severity downgrade) khi count > 0.
    const missingPaymentRef = missingPaymentRefFallback;

    return {
      fiveBibOrders,
      manualOrders,
      missingPaymentRef,
      unknownCategoryCount: unknownRows.length,
    };
  }

  async getTenant(tenant_id: number): Promise<Tenant | null> {
    return this.tenantRepo.findOne({ where: { id: tenant_id } });
  }

  async getRacesByTenant(
    tenant_id: number,
  ): Promise<{ race_id: string; title: string; created_on: Date; modified_on: Date }[]> {
    const sql = `
      SELECT r.race_id, r.title, r.created_on, r.modified_on
      FROM races r
      WHERE r.tenant_id = ?
      ORDER BY r.created_on DESC
    `;
    return this.tenantRepo.manager.query(sql, [tenant_id]);
  }

  /**
   * FEATURE-040 BR-40-02 + BR-40-03 + BR-40-04 + BR-40-12 + BR-40-13.
   *
   * Query reconciliations cho (mysql_race_id, tenant_id) overlap với contract
   * period. Whitelist status `signed | reviewed | completed | sent` ONLY
   * (BR-40-03 — `draft | flagged | ready | approved` chưa BBNT ký, KHÔNG dùng).
   *
   * Period overlap (BR-40-04): `period_end >= periodFrom AND period_start <= periodTo`
   * — atomic month-bound, không split partial month.
   *
   * Defensive (BR-40-13): >1 docs match (race condition duplicate) → log WARN,
   * SUM caller. KHÔNG throw.
   *
   * Defensive (BR-40-12): docs `createdAt < 2026-05-08` (pre-F016 fix) → attach
   * `legacyWarning`. Caller (FeeService) rate-limits INFO log per request.
   */
  async getReconciledFeeForContract(
    mysqlRaceId: number,
    tenantId: number,
    periodFrom: Date | string,
    periodTo: Date | string,
  ): Promise<ReconciledFeeSlice[]> {
    const fromIso = this.toIsoDateString(periodFrom);
    const toIso = this.toIsoDateString(periodTo);

    const docs = await this.reconciliationModel
      .find({
        mysql_race_id: mysqlRaceId,
        tenant_id: tenantId,
        status: { $in: [...F040_RECON_STATUS_WHITELIST] },
        period_end: { $gte: fromIso },
        period_start: { $lte: toIso },
      })
      .lean()
      .exec();

    if (docs.length > 1) {
      this.logger.warn(
        `[F-040] duplicate recon docs detected for (raceId=${mysqlRaceId}, tenantId=${tenantId}, period=${fromIso}..${toIso}): ${docs.length} docs summed`,
      );
    }

    return docs.map((d) => {
      const createdAt = (d as { createdAt?: Date }).createdAt ?? null;
      const isLegacy =
        createdAt !== null && createdAt.getTime() < F040_PRE_F016_CUTOFF.getTime();
      const finalizedAt =
        d.signed_at ?? d.approved_at ?? d.reviewed_at ?? null;
      return {
        reconciliationId: String(d._id),
        periodStart: d.period_start,
        periodEnd: d.period_end,
        status: d.status,
        feeAmount: Number(d.fee_amount ?? 0),
        manualFeeAmount: Number(d.manual_fee_amount ?? 0),
        finalizedAt: finalizedAt ? finalizedAt.toISOString() : null,
        legacyWarning: isLegacy
          ? 'BBNT pre-F016 — fee_amount có thể underestimate GROUP_BUY/CODE_TRANSFER orders (xem TD-F016-FINANCE-01)'
          : undefined,
        createdAt,
      };
    });
  }

  private toIsoDateString(input: Date | string): string {
    if (typeof input === 'string') {
      // Accept either YYYY-MM-DD or full ISO; trim to YYYY-MM-DD.
      if (/^\d{4}-\d{2}-\d{2}/.test(input)) return input.slice(0, 10);
      const parsed = new Date(input);
      return parsed.toISOString().slice(0, 10);
    }
    return input.toISOString().slice(0, 10);
  }
}
