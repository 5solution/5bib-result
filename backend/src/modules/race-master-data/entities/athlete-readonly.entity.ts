import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { bitTransformer } from './bit-transformer';
import { AthleteSubinfoReadonly } from './athlete-subinfo-readonly.entity';
import { CodeReadonly } from './code-readonly.entity';

/**
 * READ-ONLY entity. KHÔNG ghi vào DB này.
 * Connection: 'platform' (5bib_platform_live, read replica).
 * Chỉ map các cột cần cho chip lookup + delta sync + display.
 */
@Entity('athletes')
export class AthleteReadonly {
  @PrimaryColumn({ type: 'bigint', name: 'athletes_id' })
  athletes_id: number;

  @Column({ type: 'bigint', nullable: false })
  race_id: number;

  @Column({ nullable: true, type: 'varchar', length: 64 })
  bib_number: string | null;

  @Column({ nullable: true, type: 'varchar', length: 255 })
  name: string | null;

  /**
   * F-048 PII — email is the ONLY identity field in `athletes` table.
   *
   * **CRITICAL FIX 2026-05-20 (QC catch — staged_10 sync 10/10 failed):**
   * Original Adjustment #1 claimed athletes.contact_phone + id_number exist.
   * PROD MySQL verify revealed: contact_phone + id_number live in
   * `athlete_subinfo` table (NOT athletes). Removed from this entity →
   * sourced via subinfo relation in mapper (a.subinfo?.contact_phone).
   *
   * **PRIVACY (BR-48-15 PII strict 5-layer defense):**
   *   - Stored MongoDB with `select: false` (admin-only access)
   *   - NEVER returned in public DTO (toPublicView strips)
   *   - SHA256 hash before use as identity cluster anchor
   *   - Logger output uses `[emailHash:abc12345]` proxy
   *
   * Coverage post-F-048 sync: email ≥80% (athletes table direct).
   */
  @Column({ nullable: true, type: 'varchar', length: 255 })
  email: string | null;

  /**
   * F-019 v2 — Date of Birth.
   * Source: MySQL `athletes.dob` (DATE), coverage ~95% (92506/97155 toàn DB).
   *
   * **PRIVACY (BR-03 PII strict allowlist):**
   * Đây là PII — bị isolated. Service layer (`AgeComputerService`) đọc field
   * này → compute `ageOnRaceDay` → persist CHỈ age number vào MongoDB
   * `race_athletes.ageOnRaceDay`. DOB raw KHÔNG bao giờ rời backend, KHÔNG
   * bao giờ trả public API. Vẫn trong tinh thần allowlist BR-03 vì
   * persisted state KHÔNG có raw DOB.
   *
   * Format: TypeORM map MySQL DATE → JS Date object UTC midnight.
   */
  @Column({ nullable: true, type: 'date' })
  dob: Date | null;

  @Column({ nullable: true, type: 'varchar', length: 32 })
  last_status: string | null;

  /** Cột legacy có typo — giữ nguyên tên để khớp DB. */
  @Column({ type: 'tinyint', nullable: true })
  racekit_recieved: number | null;

  @Column({ type: 'datetime', nullable: true })
  racekit_recieved_time: Date | null;

  @Column({ type: 'bigint', nullable: true })
  subinfo_id: number | null;

  /**
   * VĐV import qua code (không qua order) — `code_id` link tới `code` table
   * có `race_course_id`. Dùng làm fallback path cho course_name khi
   * subinfo.order_line_item_id null (xảy ra với 63% athletes race 192).
   */
  @Column({ type: 'bigint', nullable: true })
  code_id: number | null;

  /** Dùng cho delta sync window (modified_on > NOW() - 90s). */
  @Column({ type: 'datetime', nullable: true })
  modified_on: Date | null;

  @Column({
    type: 'bit',
    width: 1,
    nullable: true,
    default: false,
    transformer: bitTransformer,
  })
  deleted: boolean;

  @ManyToOne(() => AthleteSubinfoReadonly, { nullable: true })
  @JoinColumn({ name: 'subinfo_id' })
  subinfo: AthleteSubinfoReadonly | null;

  @ManyToOne(() => CodeReadonly, { nullable: true })
  @JoinColumn({ name: 'code_id' })
  code: CodeReadonly | null;
}
