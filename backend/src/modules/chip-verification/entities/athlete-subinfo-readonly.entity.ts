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

  @Column({ type: 'bigint', nullable: true })
  order_line_item_id: number | null;

  @ManyToOne(() => OrderLineItemReadonly, { nullable: true })
  @JoinColumn({ name: 'order_line_item_id' })
  orderLineItem: OrderLineItemReadonly | null;
}
