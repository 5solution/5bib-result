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
import { VolSupplyAllocation } from './vol-supply-allocation.entity';
import { VolRole } from './vol-role.entity';
import { VolRegistration } from './vol-registration.entity';

// v1.6 OQ-D Option 2: Multi-supplement. Each row = 1 supplement round.
// Supports race nhiều ca — unlimited rounds per allocation.
@Entity('vol_supply_supplement')
@Unique('uq_supp_alloc_round', ['allocation_id', 'round_number'])
@Index('idx_supp_allocation', ['allocation_id'])
export class VolSupplySupplement {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  allocation_id!: number;

  @ManyToOne(() => VolSupplyAllocation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'allocation_id' })
  allocation?: VolSupplyAllocation;

  // Auto-increment per allocation (service computes max+1)
  @Column({ type: 'int', default: 1 })
  round_number!: number;

  @Column({ type: 'int' })
  qty!: number;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ type: 'int', nullable: true })
  created_by_role_id!: number | null;

  @ManyToOne(() => VolRole, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_role_id' })
  created_by_role?: VolRole | null;

  @Column({ type: 'int', nullable: true })
  confirmed_qty!: number | null;

  @Column({
    type: 'int',
    nullable: true,
    generatedType: 'STORED',
    asExpression: `CASE WHEN confirmed_qty IS NOT NULL THEN qty - confirmed_qty ELSE NULL END`,
    insert: false,
    update: false,
  })
  shortage_qty!: number | null;

  @Column({ type: 'datetime', nullable: true })
  confirmed_at!: Date | null;

  @Column({ type: 'int', nullable: true })
  confirmed_by_registration_id!: number | null;

  @ManyToOne(() => VolRegistration, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'confirmed_by_registration_id' })
  confirmed_by_registration?: VolRegistration | null;

  @Column({ type: 'text', nullable: true })
  confirmation_note!: string | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;
}
