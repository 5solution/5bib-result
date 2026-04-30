import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TicketTypeReadonly } from './ticket-type-readonly.entity';

/**
 * READ-ONLY. Chỉ map cột cần cho JOIN sang ticket_type → race_course
 * (lấy course name hiển thị kiosk).
 */
@Entity('order_line_item')
export class OrderLineItemReadonly {
  @PrimaryColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint', nullable: true })
  ticket_type_id: number | null;

  @ManyToOne(() => TicketTypeReadonly, { nullable: true })
  @JoinColumn({ name: 'ticket_type_id' })
  ticketType: TicketTypeReadonly | null;
}
