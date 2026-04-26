import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { VolEvent } from './vol-event.entity';

/**
 * Atomic per-event counter for contract_number.
 *
 * The contract-number service reserves the next number with:
 *   START TRANSACTION;
 *   SELECT last_number FROM vol_contract_number_sequence
 *     WHERE event_id = :eventId FOR UPDATE;
 *   (create row with last_number=0 if missing, using
 *    INSERT ... ON DUPLICATE KEY UPDATE)
 *   UPDATE ... SET last_number = last_number + 1;
 *   -- format NNN-{PREFIX}-HDDV/CTV-5BIB and persist to
 *   -- vol_registration.contract_number
 *   COMMIT;
 *
 * Row is auto-created on first send. ON DELETE CASCADE from
 * vol_event so closed/deleted events don't leak orphan counters.
 */
@Entity('vol_contract_number_sequence')
export class VolContractNumberSequence {
  @PrimaryColumn({ type: 'int' })
  event_id!: number;

  @OneToOne(() => VolEvent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event?: VolEvent;

  @Column({ type: 'int', default: 0 })
  last_number!: number;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;
}
