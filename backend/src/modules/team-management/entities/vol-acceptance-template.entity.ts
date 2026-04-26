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

/**
 * Template for Biên bản nghiệm thu (acceptance minutes).
 *
 * - `event_id = NULL` marks a global default template. The acceptance
 *   service picks the default row when an event-scoped template is
 *   not configured.
 * - `content_html` holds the template with `{{placeholder}}` tokens;
 *   `variables` is the whitelist of placeholders used by the renderer.
 * - `is_default = TRUE` flags the one-and-only canonical default
 *   seeded by migration 031.
 */
@Entity('vol_acceptance_template')
@Index('idx_acceptance_tpl_event', ['event_id'])
@Index('idx_acceptance_tpl_default', ['is_default', 'is_active'])
export class VolAcceptanceTemplate {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', nullable: true })
  event_id!: number | null;

  @ManyToOne(() => VolEvent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event?: VolEvent;

  @Column({ type: 'varchar', length: 255 })
  template_name!: string;

  @Column({ type: 'longtext' })
  content_html!: string;

  @Column({ type: 'json' })
  variables!: string[];

  @Column({ type: 'boolean', default: false })
  is_default!: boolean;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  // ── Party A (legal entity signing the acceptance document) ──
  @Column({ type: 'varchar', length: 200, nullable: true })
  party_a_company_name!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  party_a_address!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  party_a_tax_code!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  party_a_representative!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  party_a_position!: string | null;

  @Column({ type: 'varchar', length: 100, default: 'system' })
  created_by!: string;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;
}
