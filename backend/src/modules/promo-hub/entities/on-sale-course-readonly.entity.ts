import { Entity, PrimaryColumn, Column } from 'typeorm';

/**
 * FEATURE-037 — READ-ONLY entity cho MySQL `5bib_platform_live.race_course` table.
 *
 * Mapped via named connection `'platform'` — used by F-037 on-sale race detail
 * endpoint (`GET /api/promo-hubs/races-on-sale/by-url-name/:urlName`) to JOIN
 * race + courses in single round-trip query.
 *
 * Field selection: 16 cols needed for SEO detail page rendering. Excluded:
 *   - `wave` text (large blob, race-day operational, not SEO-relevant)
 *   - `add_ons json` (admin-internal pricing flexibility, not user-facing on SEO)
 *   - `bib_*` templates, `customize_fields` (admin-only)
 *   - `variant_id`, `race_result_*` (race-day operational)
 *
 * MUST-DO: query qua named connection `'platform'`. KHÔNG ghi (DB user
 * `5bib_readonly_user` không có quyền INSERT/UPDATE/DELETE).
 *
 * Bit type handling: MySQL `bit(1)` → TypeORM Buffer. Service layer dùng
 * `CAST(rc.deleted AS UNSIGNED) = 0` trong QueryBuilder để filter (raw
 * comparison cleaner than Buffer.readUInt8 sau load). Pattern reuse F-033.
 */
/**
 * NOTE: `race-master-data` module có entity `RaceCourseReadonly` cũng map
 * `race_course` table với 3 cols (id, name, distance) cho kiosk display.
 * F-037 cần 16 cols → rename class `OnSaleCourseReadonly` (cùng table,
 * khác TypeScript identifier) để avoid duplicate identifier conflict.
 * TypeORM hỗ trợ multiple entity definitions per table OK trong cùng
 * named connection — chỉ cần unique class name trong DI graph.
 */
@Entity({ name: 'race_course' })
export class OnSaleCourseReadonly {
  @PrimaryColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'race_id', type: 'bigint' })
  raceId: string;

  @Column({ type: 'varchar', length: 6 })
  prefix: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  distance: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'float', nullable: true })
  price: number | null;

  @Column({ name: 'max_participate', type: 'int', nullable: true })
  maxParticipate: number | null;

  @Column({ name: 'min_age', type: 'tinyint', nullable: true })
  minAge: number | null;

  @Column({ name: 'max_age', type: 'tinyint', nullable: true })
  maxAge: number | null;

  @Column({
    name: 'open_for_sale_date_time',
    type: 'datetime',
    nullable: true,
  })
  openForSaleDateTime: Date | null;

  @Column({
    name: 'close_for_sale_date_time',
    type: 'datetime',
    nullable: true,
  })
  closeForSaleDateTime: Date | null;

  @Column({ name: 'route_image_url', type: 'text', nullable: true })
  routeImageUrl: string | null;

  @Column({ name: 'route_map_image_url', type: 'text', nullable: true })
  routeMapImageUrl: string | null;

  @Column({ name: 'medal_url', type: 'text', nullable: true })
  medalUrl: string | null;

  @Column({
    name: 'course_type',
    type: 'varchar',
    length: 16,
    nullable: true,
  })
  courseType: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  gain: string | null;

  // Bit(1) — filter via CAST(deleted AS UNSIGNED) = 0 in QueryBuilder
  @Column({ type: 'bit', width: 1, default: () => "b'0'", select: false })
  deleted: Buffer;
}
