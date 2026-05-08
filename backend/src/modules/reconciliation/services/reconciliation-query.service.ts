import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../merchant/entities/tenant.entity';

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

@Injectable()
export class ReconciliationQueryService {
  private readonly logger = new Logger(ReconciliationQueryService.name);

  constructor(
    @InjectRepository(Tenant, 'platform')
    private tenantRepo: Repository<Tenant>,
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
}
