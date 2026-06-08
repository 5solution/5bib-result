import { Entity, PrimaryColumn, Column } from 'typeorm';

/**
 * F-076 BR-01 + BR-04 + BR-05 + BR-05b — READ-ONLY entity cho MySQL platform DB.
 *
 * Distinct với `finance/entities/order-readonly.entity.ts` (F-028 `OrderReadonly`)
 * — F-076 cần thêm cột `vat_ref` + `vat_create_on` + `name` + `email` +
 * `payment_on` + `first_name` + `last_name` + `race_id` mà F-028 không có.
 *
 * Pattern reuse F-028: same `@Entity({ name: 'order_metadata' })`, distinct
 * TypeScript class name (`OrderMetadataReadonly` vs `OrderReadonly`) — TypeORM
 * supports multi-entity-per-table per F-037 lesson (`RaceCourseReadonly` vs
 * `OnSaleCourseReadonly` same `race_course` table).
 *
 * **STRICT READ-ONLY:** không có method write nào. Chỉ SELECT.
 *
 * Schema verified via Manager session 2026-06-08 SSH PROD VPS query (race 140
 * + 220 rows). Field names verified:
 *   - `id` bigint (primary)
 *   - `race_id` bigint
 *   - `name` varchar(255) — public order code `#5B<id>IB` (BR-05b)
 *   - `email` varchar(255)
 *   - `first_name` / `last_name` varchar(128) — fallback nếu `name` empty
 *   - `phone_number` varchar(128)
 *   - `financial_status` varchar(32) — filter `= 'paid'`
 *   - `internal_status` varchar(32) — filter `= 'COMPLETE'`
 *   - `order_category` varchar(16) — filter `NOT IN ('INSURANCE', 'MANUAL')`
 *   - `payment_on` datetime — `paid_at` analog, age compute base
 *   - `total_price` float
 *   - `vat_ref` varchar(64) — MISA InvNo (BR-04 mapping target)
 *   - `vat_create_on` datetime(6) — legacy trigger publish timestamp
 *   - `deleted` bit(1) — filter `= 0`
 */
@Entity({ name: 'order_metadata' })
export class OrderMetadataReadonly {
  @PrimaryColumn({ type: 'bigint' })
  id!: number;

  @Column({ name: 'race_id', type: 'bigint', nullable: true })
  raceId!: number | null;

  @Column({ name: 'name', type: 'varchar', nullable: true })
  name!: string | null;

  @Column({ name: 'email', type: 'varchar', nullable: true })
  email!: string | null;

  @Column({ name: 'first_name', type: 'varchar', nullable: true })
  firstName!: string | null;

  @Column({ name: 'last_name', type: 'varchar', nullable: true })
  lastName!: string | null;

  @Column({ name: 'financial_status', type: 'varchar', nullable: true })
  financialStatus!: string | null;

  @Column({ name: 'internal_status', type: 'varchar', nullable: true })
  internalStatus!: string | null;

  @Column({ name: 'order_category', type: 'varchar', nullable: true })
  orderCategory!: string | null;

  @Column({ name: 'payment_on', type: 'datetime', nullable: true })
  paymentOn!: Date | null;

  @Column({ name: 'total_price', type: 'float', nullable: true })
  totalPrice!: number | null;

  @Column({ name: 'vat_ref', type: 'varchar', nullable: true })
  vatRef!: string | null;

  @Column({ name: 'vat_create_on', type: 'datetime', nullable: true })
  vatCreateOn!: Date | null;

  // NOTE — `deleted` column is bit(1) in MySQL. Trong WHERE clause raw SQL
  // dùng `AND o.deleted = 0` (CAST behavior implicit), KHÔNG cần map qua
  // TypeORM @Column (raw SQL pattern F-016/F-028 dùng raw query không
  // qua repo.find()). Field declared chỉ for completeness — không touch
  // via decorator để TypeORM autogen query không include.
}
