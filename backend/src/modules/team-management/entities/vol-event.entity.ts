import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// MariaDB DECIMAL columns come back as strings from the driver.
// This transformer converts them to JS numbers transparently.
const decimalToNumber = {
  from: (v: string | null): number | null => (v === null ? null : parseFloat(v)),
  to: (v: number | null): number | null => v,
};

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

  // Admin sets once per event — service-layer guard rejects edits
  // after the first contract_number has been issued for the event.
  @Column({ type: 'varchar', length: 10, nullable: true })
  contract_code_prefix!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true, transformer: decimalToNumber })
  location_lat!: number | null;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true, transformer: decimalToNumber })
  location_lng!: number | null;

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

  // v1.9: Feature toggle — lite mode hides QR, station, supply.
  @Column({
    type: 'enum',
    enum: ['full', 'lite'],
    default: 'full',
    comment: 'full = all features; lite = personnel + contract only',
  })
  feature_mode!: 'full' | 'lite';

  // v1.9: Whether admin must confirm nghiem thu before marking completed.
  @Column({ type: 'boolean', default: true, comment: 'require formal acceptance before completed' })
  feature_nghiem_thu!: boolean;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;
}

export type FeatureMode = 'full' | 'lite';
