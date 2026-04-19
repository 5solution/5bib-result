import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { VolEvent } from './vol-event.entity';
import { VolContractTemplate } from './vol-contract-template.entity';
import { VolTeamCategory } from './vol-team-category.entity';

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
@Index('idx_role_category', ['category_id'])
export class VolRole {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  event_id!: number;

  @ManyToOne(() => VolEvent, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'event_id' })
  event?: VolEvent;

  // v1.8: Team mà role thuộc về. NULL = floater (role không thuộc team
  // operational nào — VD "Cố vấn", "Khách mời"). Nếu có → role share
  // stations + supply với các role khác trong cùng team.
  @Column({ type: 'int', nullable: true })
  category_id!: number | null;

  @ManyToOne(() => VolTeamCategory, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category?: VolTeamCategory | null;

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

  @Column({ type: 'boolean', default: false })
  auto_approve!: boolean;

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

  // v1.4: Leader roles can check-in and confirm completion for team
  // members of the SAME event. Enforced in team-leader.service.
  @Column({ type: 'boolean', default: false })
  is_leader_role!: boolean;

  // v1.6 Option B2: Leader role → N managed roles via junction table.
  // Supports nested hierarchy (Leader A manages Leader B which manages Crew).
  // BFS resolver in TeamRoleHierarchyService traverses descendants at runtime.
  // Empty array for non-leader roles (or leader not yet configured).
  @ManyToMany(() => VolRole, { cascade: false })
  @JoinTable({
    name: 'vol_role_manages',
    joinColumn: { name: 'leader_role_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'managed_role_id', referencedColumnName: 'id' },
  })
  managed_roles?: VolRole[];

  // v1.5: Per-role group chat link. Gated by registration.status
  // in the public endpoints — only shown once TNV has ký HĐ.
  @Column({
    type: 'enum',
    enum: ['zalo', 'telegram', 'whatsapp', 'other'],
    nullable: true,
  })
  chat_platform!: 'zalo' | 'telegram' | 'whatsapp' | 'other' | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  chat_group_url!: string | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;
}
