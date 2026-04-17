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
import type { ShirtSize } from './vol-registration.entity';

@Entity('vol_shirt_stock')
@Unique('uq_event_size', ['event_id', 'size'])
export class VolShirtStock {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  event_id!: number;

  @ManyToOne(() => VolEvent, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'event_id' })
  event?: VolEvent;

  @Column({
    type: 'enum',
    enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
  })
  size!: ShirtSize;

  @Column({ type: 'int', default: 0 })
  quantity_planned!: number;

  @Column({ type: 'int', default: 0 })
  quantity_ordered!: number;

  @Column({ type: 'int', default: 0 })
  quantity_received!: number;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;
}
