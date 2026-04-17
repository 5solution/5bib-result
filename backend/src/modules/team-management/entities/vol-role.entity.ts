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
import { VolContractTemplate } from './vol-contract-template.entity';

export interface FormFieldConfig {
  key: string;
  label: string;
  type:
    | 'text'
    | 'tel'
    | 'email'
    | 'select'
    | 'textarea'
    | 'date'
    | 'photo'
    | 'shirt_size';
  required: boolean;
  options?: string[];
  hint?: string;
  note?: string;
}

@Entity('vol_role')
@Index('idx_event', ['event_id'])
export class VolRole {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  event_id!: number;

  @ManyToOne(() => VolEvent, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'event_id' })
  event?: VolEvent;

  @Column({ type: 'varchar', length: 100 })
  role_name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'int', default: 0 })
  max_slots!: number;

  @Column({ type: 'int', default: 0 })
  filled_slots!: number;

  @Column({ type: 'boolean', default: true })
  waitlist_enabled!: boolean;

  @Column({ type: 'decimal', precision: 12, scale: 0, default: 0 })
  daily_rate!: string;

  @Column({ type: 'int', default: 1 })
  working_days!: number;

  // Generated column (read-only) — MySQL computes it.
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 0,
    generatedType: 'STORED',
    asExpression: 'daily_rate * working_days',
    insert: false,
    update: false,
  })
  total_compensation!: string;

  @Column({ type: 'json' })
  form_fields!: FormFieldConfig[];

  @Column({ type: 'int', nullable: true })
  contract_template_id!: number | null;

  @ManyToOne(() => VolContractTemplate, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'contract_template_id' })
  contract_template?: VolContractTemplate | null;

  @Column({ type: 'int', default: 0 })
  sort_order!: number;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;
}
