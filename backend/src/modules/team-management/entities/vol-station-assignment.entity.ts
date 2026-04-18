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

export type AssignmentRole = 'crew' | 'volunteer';

// BR-STN-01: 1 registration → max 1 station (UNIQUE registration_id)
// BR-STN-03: Leader không được gán (service-level check)
@Entity('vol_station_assignment')
@Unique('uq_one_station_per_person', ['registration_id'])
@Index('idx_assignment_station', ['station_id', 'assignment_role'])
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

  @Column({ type: 'enum', enum: ['crew', 'volunteer'] })
  assignment_role!: AssignmentRole;

  @Column({ type: 'int', default: 0 })
  sort_order!: number;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @CreateDateColumn({ type: 'datetime', name: 'assigned_at' })
  assigned_at!: Date;
}
