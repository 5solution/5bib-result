import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { VolStation } from './vol-station.entity';
import { VolRegistration } from './vol-registration.entity';

// v1.8 note: `assignment_role` enum đã bị DROP (migration 029).
// Supervisor-vs-worker distinction giờ derive từ
// `registration.role.is_leader_role` tại read time. Single source of truth.
// BR-STN-01: 1 registration → max 1 station (UNIQUE registration_id)
// BR-STN-03: Relaxed — Leader có thể được assign (warning-only, không block)
@Entity('vol_station_assignment')
@Unique('uq_one_station_per_person', ['registration_id'])
@Index('idx_assignment_station', ['station_id', 'sort_order'])
export class VolStationAssignment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  station_id!: number;

  @ManyToOne(() => VolStation, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'station_id' })
  station?: VolStation;

  @Column({ type: 'int' })
  registration_id!: number;

  @ManyToOne(() => VolRegistration, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'registration_id' })
  registration?: VolRegistration;

  // v1.7: chuyên môn cụ thể tại trạm (VD: "phát nước", "sơ cứu", "timing")
  @Column({ type: 'varchar', length: 100, nullable: true })
  duty!: string | null;

  @Column({ type: 'int', default: 0 })
  sort_order!: number;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @CreateDateColumn({ type: 'datetime', name: 'assigned_at' })
  assigned_at!: Date;
}
