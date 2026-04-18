import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { VolEvent } from './vol-event.entity';
import { VolRole } from './vol-role.entity';

// v1.4: One row per (event, role) — upsert. Admin writes body_html with
// {{placeholders}}; bulk-send substitutes per-registration data plus the
// role-level custom fields (reporting_time, gathering_point, etc.).
@Entity('vol_team_schedule_email')
@Unique('uq_event_role', ['event_id', 'role_id'])
export class VolTeamScheduleEmail {
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

  @Column({ type: 'varchar', length: 500 })
  subject!: string;

  @Column({ type: 'longtext' })
  body_html!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  reporting_time!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  gathering_point!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  team_contact_phone!: string | null;

  @Column({ type: 'text', nullable: true })
  special_note!: string | null;

  @Column({ type: 'datetime', nullable: true })
  last_sent_at!: Date | null;

  @Column({ type: 'int', default: 0 })
  last_sent_count!: number;

  @Column({ type: 'int', default: 0 })
  total_sent_count!: number;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;
}
