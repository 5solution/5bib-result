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

export type ShirtSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL';
export type RegistrationStatus =
  | 'pending'
  | 'approved'
  | 'waitlisted'
  | 'rejected'
  | 'cancelled';
export type CheckinMethod = 'qr_scan' | 'gps_verify';
export type ContractStatus = 'not_sent' | 'sent' | 'signed' | 'expired';
export type PaymentStatus = 'pending' | 'paid';

@Entity('vol_registration')
@Index('idx_role_status', ['role_id', 'status'])
@Index('idx_event_status', ['event_id', 'status'])
@Index('idx_qr_code', ['qr_code'])
@Unique('uq_magic_token', ['magic_token'])
@Unique('uq_email_role', ['email', 'role_id'])
export class VolRegistration {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  role_id!: number;

  @ManyToOne(() => VolRole, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'role_id' })
  role?: VolRole;

  @Column({ type: 'int' })
  event_id!: number;

  @ManyToOne(() => VolEvent, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'event_id' })
  event?: VolEvent;

  @Column({ type: 'varchar', length: 255 })
  full_name!: string;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 20 })
  phone!: string;

  @Column({ type: 'json' })
  form_data!: Record<string, unknown>;

  @Column({
    type: 'enum',
    enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
    nullable: true,
  })
  shirt_size!: ShirtSize | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatar_photo_url!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  cccd_photo_url!: string | null;

  @Column({
    type: 'enum',
    enum: ['pending', 'approved', 'waitlisted', 'rejected', 'cancelled'],
    default: 'pending',
  })
  status!: RegistrationStatus;

  @Column({ type: 'int', nullable: true })
  waitlist_position!: number | null;

  @Column({ type: 'varchar', length: 64 })
  magic_token!: string;

  @Column({ type: 'datetime' })
  magic_token_expires!: Date;

  @Column({ type: 'boolean', default: false })
  contract_sign_token_used!: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  qr_code!: string | null;

  @Column({ type: 'datetime', nullable: true })
  checked_in_at!: Date | null;

  @Column({ type: 'datetime', nullable: true })
  checked_out_at!: Date | null;

  @Column({
    type: 'enum',
    enum: ['qr_scan', 'gps_verify'],
    nullable: true,
  })
  checkin_method!: CheckinMethod | null;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  checkin_lat!: string | null;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  checkin_lng!: string | null;

  @Column({
    type: 'enum',
    enum: ['not_sent', 'sent', 'signed', 'expired'],
    default: 'not_sent',
  })
  contract_status!: ContractStatus;

  @Column({ type: 'datetime', nullable: true })
  contract_signed_at!: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  contract_pdf_url!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  contract_pdf_hash!: string | null;

  @Column({ type: 'int', nullable: true })
  actual_working_days!: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 0, nullable: true })
  actual_compensation!: string | null;

  @Column({ type: 'enum', enum: ['pending', 'paid'], default: 'pending' })
  payment_status!: PaymentStatus;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;
}
