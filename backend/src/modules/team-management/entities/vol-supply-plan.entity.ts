import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { VolEvent } from './vol-event.entity';
import { VolRole } from './vol-role.entity';
import { VolSupplyItem } from './vol-supply-item.entity';

// v1.6: Leader order + Admin fulfill = 2 con số riêng.
// gap_qty auto-compute by MariaDB STORED generated column.
@Entity('vol_supply_plan')
@Unique('uq_plan_role_item', ['role_id', 'item_id'])
@Index('idx_plan_event', ['event_id'])
export class VolSupplyPlan {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  event_id!: number;

  @ManyToOne(() => VolEvent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event?: VolEvent;

  @Column({ type: 'int' })
  role_id!: number;

  @ManyToOne(() => VolRole, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role?: VolRole;

  @Column({ type: 'int' })
  item_id!: number;

  @ManyToOne(() => VolSupplyItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id' })
  item?: VolSupplyItem;

  @Column({ type: 'int', default: 0 })
  requested_qty!: number;

  @Column({ type: 'text', nullable: true })
  request_note!: string | null;

  // NULL = admin chưa xử lý; 0 = không đáp ứng được; >0 = số đã cấp
  @Column({ type: 'int', nullable: true })
  fulfilled_qty!: number | null;

  @Column({ type: 'text', nullable: true })
  fulfill_note!: string | null;

  // GENERATED STORED column — MariaDB computes.
  @Column({
    type: 'int',
    nullable: true,
    generatedType: 'STORED',
    asExpression: `CASE WHEN fulfilled_qty IS NULL THEN NULL ELSE requested_qty - fulfilled_qty END`,
    insert: false,
    update: false,
  })
  gap_qty!: number | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;
}
