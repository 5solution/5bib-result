import type { DataSource } from 'typeorm';
import type { OrderForFeeAggregate } from '../../finance/dto/fee-aggregate.dto';

/**
 * F-062 Wave 2C-1 EXTRACT — Shared FeeService pre-aggregate helper.
 *
 * Pull raw orders from MySQL platform DB cho FeeService.computeFeeForOrdersAggregate
 * Tier 0 cascade. Returns `Map<tenantId, OrderForFeeAggregate[]>` keyed by tenant
 * for per-tenant fee cascade orchestration.
 *
 * Extracted from analytics.service.ts (Wave 0+) + merchant-comparison.service.ts
 * (Wave 2B-2) post-3rd consumer threshold met per TD-F062-WAVE2B2-PULLORDERS-DUPLICATE.
 * Wave 2C-1 race-performance.service.ts = 3rd consumer → extract clean abstraction
 * with confirmed need.
 *
 * Schema dependencies (MySQL platform DB):
 *   - `order_metadata` table: financial_status, total_price, total_discounts,
 *     order_category, payment_on, payment_ref
 *   - `races` table: tenant_id (FK)
 *   - `order_line_item` table: order_id, quantity (for manual_ticket_count
 *     sub-aggregate per F-061 BR-61-08 split semantics)
 *
 * Filters:
 *   - Always: `om.financial_status = 'paid'` (BI-01)
 *   - Optional clause + params via Wave 0+ `buildDateFilter()` output
 *   - Optional tenantId / raceId scope filter (subset query for TopRaces / merchant-scoped)
 *
 * F-061 BR-61-08 includes `om.payment_ref` so FeeService can distinguish
 * 5BIB-eligible (ref truthy) vs MANUAL semantic (ref empty/null).
 */
export async function pullOrdersForFeeAggregate(
  db: DataSource,
  clause: string,
  params: any[],
  filter?: { tenantId?: number; raceId?: number },
): Promise<Map<number, OrderForFeeAggregate[]>> {
  const whereClause = clause ? `AND ${clause}` : '';
  const extraConds: string[] = [];
  const extraParams: any[] = [];
  if (filter?.tenantId) {
    extraConds.push('r.tenant_id = ?');
    extraParams.push(filter.tenantId);
  }
  if (filter?.raceId) {
    extraConds.push('om.race_id = ?');
    extraParams.push(filter.raceId);
  }
  const extraWhere =
    extraConds.length > 0 ? `AND ${extraConds.join(' AND ')}` : '';

  const rows: Array<{
    id: number;
    tenant_id: number;
    race_id: number;
    total_price: string | number;
    total_discounts: string | number | null;
    order_category: string;
    payment_on: Date | string;
    payment_ref: string | null;
    manual_ticket_count: string | number | null;
  }> = await db.query(
    // HOTFIX F-058 2026-05-22: column thực tế là `payment_on` (NOT `created_at`
    // — order_metadata table không có column đó). Verified bằng existing
    // dashboard/kpi.service.ts pattern + entity OrderReadonly.
    // Semantic: `payment_on` chuẩn hơn cho fee calc (chỉ áp khi tiền vào).
    // F-061 BR-61-08: thêm `om.payment_ref` để FeeService cascade phân biệt
    // 5BIB-eligible (ref truthy) vs MANUAL semantic (ref empty/null).
    `SELECT
      om.id,
      r.tenant_id,
      om.race_id,
      om.total_price,
      om.total_discounts,
      om.order_category,
      om.payment_on,
      om.payment_ref,
      oli_agg.total_quantity AS manual_ticket_count
    FROM order_metadata om
    JOIN races r ON r.race_id = om.race_id
    LEFT JOIN (
      SELECT order_id, SUM(quantity) AS total_quantity
      FROM order_line_item GROUP BY order_id
    ) oli_agg ON oli_agg.order_id = om.id
    WHERE om.financial_status = 'paid' ${whereClause} ${extraWhere}`,
    [...params, ...extraParams],
  );

  const byTenant = new Map<number, OrderForFeeAggregate[]>();
  for (const r of rows) {
    const tid = Number(r.tenant_id);
    const arr = byTenant.get(tid) ?? [];
    arr.push({
      id: Number(r.id),
      raceId: Number(r.race_id),
      totalPrice: Number(r.total_price ?? 0),
      totalDiscounts: Number(r.total_discounts ?? 0),
      orderCategory: r.order_category,
      createdAt: r.payment_on, // F-058 hotfix: MySQL column `payment_on` → TS field `createdAt` (semantic: order paid time = effective date for fee cascade)
      paymentRef: r.payment_ref ?? null, // F-061 BR-61-08
      manualTicketCount:
        r.manual_ticket_count != null
          ? Number(r.manual_ticket_count)
          : undefined,
    });
    byTenant.set(tid, arr);
  }
  return byTenant;
}
