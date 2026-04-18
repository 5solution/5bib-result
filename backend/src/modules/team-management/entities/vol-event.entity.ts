import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type VolEventStatus = 'draft' | 'open' | 'closed' | 'completed';

@Entity('vol_event')
@Index('idx_status', ['status'])
@Index('idx_dates', ['event_start_date', 'event_end_date'])
export class VolEvent {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  race_id!: string | null;

  @Column({ type: 'varchar', length: 255 })
  event_name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  location_lat!: string | null;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  location_lng!: string | null;

  @Column({ type: 'int', default: 500 })
  checkin_radius_m!: number;

  @Column({ type: 'date' })
  event_start_date!: string;

  @Column({ type: 'date' })
  event_end_date!: string;

  @Column({ type: 'datetime' })
  registration_open!: Date;

  @Column({ type: 'datetime' })
  registration_close!: Date;

  @Column({
    type: 'enum',
    enum: ['draft', 'open', 'closed', 'completed'],
    default: 'draft',
  })
  status!: VolEventStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  contact_email!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  contact_phone!: string | null;

  // Benefits banner shown on the crew register page ("Quyền lợi khi
  // tham gia"). Admin uploads via the standard photo endpoint and stores
  // the public S3 URL here. Null = no banner, the register page just
  // hides the section.
  @Column({ type: 'varchar', length: 500, nullable: true })
  benefits_image_url!: string | null;

  // Terms & conditions TNV must agree to before submitting the register
  // form. Plain text, preserves newlines. Null = no gate, register form
  // submits immediately.
  @Column({ type: 'text', nullable: true })
  terms_conditions!: string | null;

  // v1.4: Minimum hours between check-in and completion-confirm; under
  // this threshold the completion is flagged `suspicious_checkin = TRUE`.
  @Column({ type: 'decimal', precision: 4, scale: 1, default: 2.0 })
  min_work_hours_for_completion!: string;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;
}
