import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { bitTransformer } from './bit-transformer';
import { AthleteSubinfoReadonly } from './athlete-subinfo-readonly.entity';
import { CodeReadonly } from './code-readonly.entity';

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

  /**
   * VĐV import qua code (không qua order) — `code_id` link tới `code` table
   * có `race_course_id`. Dùng làm fallback path cho course_name khi
   * subinfo.order_line_item_id null (xảy ra với 63% athletes race 192).
   */
  @Column({ type: 'bigint', nullable: true })
  code_id: number | null;

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

  @ManyToOne(() => CodeReadonly, { nullable: true })
  @JoinColumn({ name: 'code_id' })
  code: CodeReadonly | null;
}
