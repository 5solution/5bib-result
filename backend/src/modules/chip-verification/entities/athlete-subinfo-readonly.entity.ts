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
   * 'achievements' (đúng chính tả). Free-form text, có thể là single item
   * ("Mũ") hoặc list comma-separated. FE render raw — không parse.
   *
   * Race 192 (pilot 2026-05-02): 930/3267 dòng = "Mũ" (BTC giao mũ),
   * còn lại NULL. KHÔNG fallback giá trị khác — empty/null thì FE hiện '—'.
   */
  @Column({ nullable: true, type: 'text', name: 'achievements' })
  achievements: string | null;

  @Column({ type: 'bigint', nullable: true })
  order_line_item_id: number | null;

  @ManyToOne(() => OrderLineItemReadonly, { nullable: true })
  @JoinColumn({ name: 'order_line_item_id' })
  orderLineItem: OrderLineItemReadonly | null;
}
