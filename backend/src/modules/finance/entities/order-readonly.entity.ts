import { Entity, PrimaryColumn, Column } from 'typeorm';

/**
 * F-028 BR-PNL-04 + BR-PNL-22 — READ-ONLY entity cho MySQL platform DB.
 *
 * Map cột MINIMUM cần thiết để compute TICKET_SALES revenue cho contract:
 *   - tenant_id + race_id → match contract → race linkage
 *   - internal_status = 'COMPLETE' (5BIB platform convention — equivalent
 *     "paid" trong PRD)
 *   - order_category → match FIVE_BIB_CATEGORIES (exclude MANUAL)
 *   - processed_on → date range filter (signDate ↔ now)
 *   - total_price → revenue contribution per order
 *
 * Đặt tên class `OrderReadonly` distinct với generic "Order" tránh nhầm với
 * Mongoose models. Bảng MySQL THỰC TẾ tên `order_metadata` (xác nhận qua
 * F-016 ReconciliationQueryService line 68: `LEFT JOIN order_metadata o`).
 *
 * PAUSE-CODE-028-B resolved: schema verified bằng cross-check F-016 SQL —
 * KHÔNG có cột `service_fee` ở level order_metadata. Revenue 5BIB-share
 * compute từ raw row × fee rate (logic Reconciliation đảm nhiệm). Cho
 * F-028 Phase 1 chấp nhận: pull `SUM(total_price)` của orders thuộc
 * tenant + race + period + paid + 5BIB categories — đây là GMV thật.
 * Phase 2 có thể swap qua bảng `reconciliation` (đã computed) nếu cần
 * tách 5BIB fee net vs GMV.
 *
 * KHÔNG có @Column write decorator nào ngoài allowlist — strict read-only.
 */
@Entity({ name: 'order_metadata' })
export class OrderReadonly {
  @PrimaryColumn({ type: 'bigint' })
  id: number;

  // NOTE F-028 BUG fix 2026-05-12: column `tenant_id` KHÔNG tồn tại trên
  // `order_metadata` MySQL prod (đã verify bằng error log "Unknown column
  // 'o.tenant_id' in 'where clause'"). Tenant scoping ở MySQL platform đi
  // qua `races.tenant_id` (filter join `race_course → race`), KHÔNG filter
  // trực tiếp `order_metadata`. Bỏ @Column decorator để TypeORM KHÔNG đụng
  // column này trong query autogen — chỉ giữ thuộc tính lúc cần phân tích
  // future-compat. Pattern F-016 ReconciliationQueryService line 67-77.

  @Column({ name: 'internal_status', type: 'varchar', nullable: true })
  internalStatus: string | null;

  @Column({ name: 'order_category', type: 'varchar', nullable: true })
  orderCategory: string | null;

  @Column({ name: 'processed_on', type: 'datetime', nullable: true })
  processedOn: Date | null;

  @Column({ name: 'total_price', type: 'decimal', precision: 18, scale: 2, nullable: true })
  totalPrice: string | null;

  @Column({ name: 'payment_ref', type: 'varchar', nullable: true })
  paymentRef: string | null;

  @Column({ type: 'tinyint', nullable: true })
  deleted: number | null;
}
