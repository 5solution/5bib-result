import { Entity, PrimaryColumn, Column } from 'typeorm';

/**
 * FEATURE-033 — READ-ONLY entity cho MySQL `5bib_platform_live.races` table.
 *
 * Promo Hub `race_calendar` section dùng để fetch race phase BÁN VÉ
 * (`status = 'GENERATED_CODE'`) — khác với MongoDB `races` collection của
 * 5bib-result chỉ chứa race phase VẬN HÀNH.
 *
 * MUST-DO: query qua named connection `'platform'`. KHÔNG ghi (DB user
 * `5bib_readonly_user` không có quyền INSERT/UPDATE/DELETE).
 *
 * Field selection: chỉ map các column cần cho Promo Hub render —
 * KHÔNG full schema (table có 70+ columns). Adding column sau: extend
 * entity + verify SELECT grant trong DB.
 *
 * Bit type handling: MySQL `bit(1)` → TypeORM Buffer. Service layer dùng
 * `CAST(... AS UNSIGNED) = 1` trong QueryBuilder để filter (raw comparison
 * cleaner than Buffer.readUInt8 sau load).
 */
@Entity('races')
export class RaceReadonly {
  @PrimaryColumn({ type: 'bigint', name: 'race_id' })
  raceId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string | null;

  @Column({ name: 'url_name', type: 'varchar', length: 255, nullable: true })
  urlName: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  status: string | null;

  @Column({ name: 'logo_url', type: 'text', nullable: true })
  logoUrl: string | null;

  @Column({ name: 'event_start_date', type: 'datetime', nullable: true })
  eventStartDate: Date | null;

  @Column({ name: 'event_end_date', type: 'datetime', nullable: true })
  eventEndDate: Date | null;

  @Column({ name: 'registration_start_time', type: 'datetime', nullable: true })
  registrationStartTime: Date | null;

  @Column({ name: 'registration_end_time', type: 'datetime', nullable: true })
  registrationEndTime: Date | null;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  location: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  brand: string | null;

  @Column({ name: 'tenant_id', type: 'bigint', nullable: true })
  tenantId: string | null;

  // ─── FEATURE-037 — Extension cho on-sale race detail page ───
  // Manager 2026-05-18 verified SELECT grant cho 7 cols dưới + JOIN race_course

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  images: string | null;

  @Column({ name: 'event_type', type: 'varchar', length: 255, nullable: true })
  eventType: string | null;

  @Column({ name: 'race_type', type: 'varchar', length: 64, nullable: true })
  raceType: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  district: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  season: string | null;

  @Column({ name: 'location_url', type: 'text', nullable: true })
  locationUrl: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  province: string | null;
}
