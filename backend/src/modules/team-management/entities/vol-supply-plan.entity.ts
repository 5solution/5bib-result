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
import { VolTeamCategory } from './vol-team-category.entity';
import { VolSupplyItem } from './vol-supply-item.entity';

// v1.8: Supply-plan thuộc về Team (category), không thuộc role cụ thể.
// Leader của team đại diện đặt hàng; admin fulfill. gap_qty tự tính.
@Entity('vol_supply_plan')
@Unique('uq_plan_category_item', ['event_id', 'category_id', 'item_id'])
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
  category_id!: number;

  @ManyToOne(() => VolTeamCategory, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category?: VolTeamCategory;

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
