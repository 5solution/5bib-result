import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { bitTransformer } from './bit-transformer';
import { AthleteSubinfoReadonly } from './athlete-subinfo-readonly.entity';

/**
 * READ-ONLY entity. KHÔNG ghi vào DB này.
 * Connection: 'platform' (5bib_platform_live, read replica).
 * Chỉ map các cột cần cho chip lookup + delta sync + display.
 */
@Entity('athletes')
export class AthleteReadonly {
  @PrimaryColumn({ type: 'bigint', name: 'athletes_id' })
  athletes_id: number;

  @Column({ type: 'bigint', nullable: false })
  race_id: number;

  @Column({ nullable: true, type: 'varchar', length: 64 })
  bib_number: string | null;

  @Column({ nullable: true, type: 'varchar', length: 255 })
  name: string | null;

  @Column({ nullable: true, type: 'varchar', length: 32 })
  last_status: string | null;

  /** Cột legacy có typo — giữ nguyên tên để khớp DB. */
  @Column({ type: 'tinyint', nullable: true })
  racekit_recieved: number | null;

  @Column({ type: 'datetime', nullable: true })
  racekit_recieved_time: Date | null;

  @Column({ type: 'bigint', nullable: true })
  subinfo_id: number | null;

  /** Dùng cho delta sync window (modified_on > NOW() - 90s). */
  @Column({ type: 'datetime', nullable: true })
  modified_on: Date | null;

  @Column({
    type: 'bit',
    width: 1,
    nullable: true,
    default: false,
    transformer: bitTransformer,
  })
  deleted: boolean;

  @ManyToOne(() => AthleteSubinfoReadonly, { nullable: true })
  @JoinColumn({ name: 'subinfo_id' })
  subinfo: AthleteSubinfoReadonly | null;
}
