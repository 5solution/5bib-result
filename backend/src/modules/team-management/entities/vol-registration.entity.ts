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

const decimalToNumber = {
  from: (v: string | null): number | null => (v === null ? null : parseFloat(v)),
  to: (v: number | null): number | null => v,
};

export type ShirtSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL';
// v1.4: 10-state machine. Terminal states: rejected, cancelled.
// Flow: pending_approval → approved → contract_sent → contract_signed
//     → qr_sent → checked_in → completed (+ waitlisted as parallel branch)
export type RegistrationStatus =
  | 'pending_approval'
  | 'approved'
  | 'contract_sent'
  | 'contract_signed'
  | 'qr_sent'
  | 'checked_in'
  | 'completed'
  | 'waitlisted'
  | 'rejected'
  | 'cancelled';
export type CheckinMethod = 'qr_scan' | 'gps_verify' | 'leader_checkin';
export type ContractStatus = 'not_sent' | 'sent' | 'signed' | 'expired';
export type PaymentStatus = 'pending' | 'paid';
export type CompletionConfirmedBy = 'leader' | 'admin';

export const REGISTRATION_STATUS_VALUES: RegistrationStatus[] = [
  'pending_approval',
  'approved',
  'contract_sent',
  'contract_signed',
  'qr_sent',
  'checked_in',
  'completed',
  'waitlisted',
  'rejected',
  'cancelled',
];

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
    enum: REGISTRATION_STATUS_VALUES,
    default: 'pending_approval',
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
    enum: ['qr_scan', 'gps_verify', 'leader_checkin'],
    nullable: true,
  })
  checkin_method!: CheckinMethod | null;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true, transformer: decimalToNumber })
  checkin_lat!: number | null;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true, transformer: decimalToNumber })
  checkin_lng!: number | null;

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

  @Column({ type: 'varchar', length: 512, nullable: true })
  contract_signature_url!: string | null;

  @Column({ type: 'int', nullable: true })
  actual_working_days!: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 0, nullable: true })
  actual_compensation!: string | null;

  @Column({ type: 'enum', enum: ['pending', 'paid'], default: 'pending' })
  payment_status!: PaymentStatus;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  // v1.4 — Reject / completion / anti-fraud fields
  @Column({ type: 'text', nullable: true })
  rejection_reason!: string | null;

  @Column({ type: 'datetime', nullable: true })
  completion_confirmed_at!: Date | null;

  @Column({ type: 'enum', enum: ['leader', 'admin'], nullable: true })
  completion_confirmed_by!: CompletionConfirmedBy | null;

  @Column({ type: 'int', nullable: true })
  completion_confirmed_id!: number | null;

  @Column({ type: 'datetime', nullable: true })
  checkout_at!: Date | null;

  @Column({ type: 'boolean', default: false })
  suspicious_checkin!: boolean;

  // Snapshot compensation at completion — locks the pay amount against
  // later edits to vol_role.daily_rate / working_days (Danny Q4 = Y).
  @Column({ type: 'decimal', precision: 12, scale: 0, nullable: true })
  snapshot_daily_rate!: string | null;

  @Column({ type: 'int', nullable: true })
  snapshot_working_days!: number | null;

  // v1.4.1 — TNV profile edit with admin re-approval.
  // pending_changes is the JSON patch submitted by the TNV via the public
  // /profile endpoint. has_pending_changes is a quick boolean flag that the
  // admin list-view filters on. Both are cleared on approve/reject.
  @Column({ type: 'json', nullable: true })
  pending_changes!: Record<string, unknown> | null;

  @Column({ type: 'boolean', default: false })
  has_pending_changes!: boolean;

  @Column({ type: 'datetime', nullable: true })
  pending_changes_submitted_at!: Date | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;
}
