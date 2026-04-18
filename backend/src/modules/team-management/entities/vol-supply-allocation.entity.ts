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
import { VolStation } from './vol-station.entity';
import { VolSupplyItem } from './vol-supply-item.entity';
import { VolRegistration } from './vol-registration.entity';

// v1.6: Round 1 allocation + confirmation.
// Supplement rounds → vol_supply_supplement table (OQ-D Option 2).
@Entity('vol_supply_allocation')
@Unique('uq_alloc_station_item', ['station_id', 'item_id'])
@Index('idx_alloc_station', ['station_id'])
@Index('idx_alloc_item', ['item_id'])
export class VolSupplyAllocation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  station_id!: number;

  @ManyToOne(() => VolStation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'station_id' })
  station?: VolStation;

  @Column({ type: 'int' })
  item_id!: number;

  @ManyToOne(() => VolSupplyItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id' })
  item?: VolSupplyItem;

  @Column({ type: 'int', default: 0 })
  allocated_qty!: number;

  @Column({ type: 'int', nullable: true })
  confirmed_qty!: number | null;

  @Column({
    type: 'int',
    nullable: true,
    generatedType: 'STORED',
    asExpression: `CASE WHEN confirmed_qty IS NOT NULL THEN allocated_qty - confirmed_qty ELSE NULL END`,
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

  // Lock gate — crew confirms sets TRUE; admin unlock clears.
  @Column({ type: 'boolean', default: false })
  is_locked!: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  unlocked_by_admin_id!: string | null;

  @Column({ type: 'text', nullable: true })
  unlock_note!: string | null;

  @Column({ type: 'datetime', nullable: true })
  unlocked_at!: Date | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;
}
