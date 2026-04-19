import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { VolEvent } from './vol-event.entity';
import { VolTeamCategory } from './vol-team-category.entity';

export type StationStatus = 'setup' | 'active' | 'closed';

// v1.8: Trạm thuộc về Team (category), không thuộc role cụ thể.
// Tất cả role trong cùng team (Leader/Crew/TNV) share quyền assign
// vào station. Status lifecycle manual (Danny Q1 từ v1.6).
@Entity('vol_station')
@Index('idx_station_category', ['category_id', 'status', 'sort_order'])
@Index('idx_station_event', ['event_id'])
export class VolStation {
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

  @Column({ type: 'varchar', length: 200 })
  station_name!: string;

  @Column({ type: 'text', nullable: true })
  location_description!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  gps_lat!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  gps_lng!: string | null;

  @Column({
    type: 'enum',
    enum: ['setup', 'active', 'closed'],
    default: 'setup',
  })
  status!: StationStatus;

  @Column({ type: 'int', default: 0 })
  sort_order!: number;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;
}
