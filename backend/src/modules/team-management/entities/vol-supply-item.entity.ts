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

// v1.6: Admin hoặc leader tự tạo item khi order (Danny Q4).
// created_by_role_id = role leader tạo — phân quyền edit (Q7).
@Entity('vol_supply_item')
@Unique('uq_item_event_name', ['event_id', 'item_name'])
@Index('idx_supply_event', ['event_id', 'sort_order'])
export class VolSupplyItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  event_id!: number;

  @ManyToOne(() => VolEvent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event?: VolEvent;

  @Column({ type: 'varchar', length: 200 })
  item_name!: string;

  @Column({ type: 'varchar', length: 50 })
  unit!: string;

  // NULL = admin created, has value = leader of that role created.
  // Used to gate edits (Danny Q7: ông nào ông đó sửa).
  @Column({ type: 'int', nullable: true })
  created_by_role_id!: number | null;

  @ManyToOne(() => VolRole, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_role_id' })
  created_by_role?: VolRole | null;

  @Column({ type: 'int', default: 0 })
  sort_order!: number;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;
}
