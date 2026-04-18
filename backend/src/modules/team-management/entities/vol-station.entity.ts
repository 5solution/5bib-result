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
import { VolRole } from './vol-role.entity';

export type StationStatus = 'setup' | 'active' | 'closed';

// v1.6: Trạm/sub-team trong mỗi role. Admin/Leader assign people
// (crew + TNV) xuống trạm. Status lifecycle manual (Danny Q1).
@Entity('vol_station')
@Index('idx_station_role', ['role_id', 'status', 'sort_order'])
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
  role_id!: number;

  @ManyToOne(() => VolRole, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'role_id' })
  role?: VolRole;

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
