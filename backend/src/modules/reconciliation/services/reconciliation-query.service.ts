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

/**
 * FEATURE-016 v1.6.5 — extend FIVE_BIB_CATEGORIES.
 *
 * Trước F-016: array thiếu GROUP_BUY, GROUP_BUY_FIXED, CODE_TRANSFER → drop silently.
 * Sau F-016 (BR-01): include 6 categories với % fee theo CLAUDE.md business invariant.
 *
 * BR-02 — payment_ref split pattern:
 *   - Categories trong SPLIT_BY_PAYMENT_REF: có payment_ref → 5BIB GMV; không → manual fallback.
 *   - ORDINARY + CHANGE_COURSE: KHÔNG split (BR-03 preserve existing behavior).
 */
const FIVE_BIB_CATEGORIES = new Set([
  'ORDINARY',
  'PERSONAL_GROUP',
  'CHANGE_COURSE',
  'GROUP_BUY',
  'GROUP_BUY_FIXED',
  'CODE_TRANSFER',
]);

const SPLIT_BY_PAYMENT_REF = new Set([
  'PERSONAL_GROUP',
  'GROUP_BUY',
  'GROUP_BUY_FIXED',
  'CODE_TRANSFER',
]);

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

      // BR-02 — payment_ref split for 4 categories (PERSONAL_GROUP + 3 mới)
      if (SPLIT_BY_PAYMENT_REF.has(category)) {
        if (r.payment_ref) {
          fiveBibOrders.push(r);
        } else {
          manualOrders.push(r);
        }
        continue;
      }

      // ORDINARY + CHANGE_COURSE: BR-03 preserve — pass through to 5BIB regardless of payment_ref
      fiveBibOrders.push(r);
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

    const missingPaymentRef = fiveBibOrders.filter((r) => !r.payment_ref);

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
