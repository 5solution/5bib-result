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

export type EventContactType =
  | 'btc'
  | 'medical'
  | 'rescue'
  | 'police'
  | 'other';

// v1.5: Emergency contacts per event. Readable by any registration with
// a valid magic token — no status gate, safety info.
@Entity('vol_event_contact')
@Index('idx_event_contacts', ['event_id', 'is_active', 'sort_order'])
export class VolEventContact {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  event_id!: number;

  @ManyToOne(() => VolEvent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event?: VolEvent;

  @Column({
    type: 'enum',
    enum: ['btc', 'medical', 'rescue', 'police', 'other'],
  })
  contact_type!: EventContactType;

  @Column({ type: 'varchar', length: 200 })
  contact_name!: string;

  @Column({ type: 'varchar', length: 20 })
  phone!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone2!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ type: 'int', default: 0 })
  sort_order!: number;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;
}
