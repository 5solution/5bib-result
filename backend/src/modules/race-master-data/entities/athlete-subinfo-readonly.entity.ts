import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { OrderLineItemReadonly } from './order-line-item-readonly.entity';

/**
 * READ-ONLY. KHÔNG map PII (email/phone/dob/cccd) — strict allowlist
 * theo BR-03. Field name_on_bib + club đủ cho display kiosk.
 */
@Entity('athlete_subinfo')
export class AthleteSubinfoReadonly {
  @PrimaryColumn({ type: 'bigint' })
  id: number;

  @Column({ nullable: true, type: 'varchar', length: 255 })
  name_on_bib: string | null;

  @Column({ nullable: true, type: 'varchar', length: 255 })
  club: string | null;

  /** Giới tính: 'MALE' | 'FEMALE' | 'OTHER' (varchar 16). */
  @Column({ nullable: true, type: 'varchar', length: 16 })
  gender: string | null;

  /**
   * Vật phẩm BTC giao kèm racekit (VD: "Mũ", "Áo", "Túi nylon"). Cột DB
   * 'achievements' (đúng chính tả). Free-form text. Race 192 pilot
   * 2026-05-02: 930/3267 dòng = "Mũ" cho athletes nhận mũ.
   */
  @Column({ nullable: true, type: 'text' })
  achievements: string | null;

  @Column({ type: 'bigint', nullable: true })
  order_line_item_id: number | null;

  /**
   * F-048 PII fields — VERIFIED via PROD MySQL schema 2026-05-20.
   * Sourced from `athlete_subinfo` table (NOT athletes — original Adjustment #1
   * assumption was wrong, caught by staged_10 sync 10/10 failure).
   *
   * **PRIVACY (BR-48-15 strict allowlist):** select: false at MongoDB schema,
   * SHA256 hash for identity cluster anchor, logger sanitize.
   */
  @Column({ nullable: true, type: 'varchar', length: 255 })
  contact_phone: string | null;

  @Column({ nullable: true, type: 'varchar', length: 255 })
  id_number: string | null;

  @ManyToOne(() => OrderLineItemReadonly, { nullable: true })
  @JoinColumn({ name: 'order_line_item_id' })
  orderLineItem: OrderLineItemReadonly | null;
}
