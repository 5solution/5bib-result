import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from 'src/utils/base/base-entity';

@Entity('race_results')
@Index(['race_id', 'course_id', 'bib'], { unique: true })
@Index(['course_id'])
@Index(['gender'])
@Index(['category'])
@Index(['overall_rank_numeric'])
export class RaceResultEntity extends BaseEntity {
  @Column({ type: 'int' })
  bib: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  overall_rank: string;

  @Column({ type: 'int', nullable: true })
  overall_rank_numeric: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  gender_rank: string;

  @Column({ type: 'int', nullable: true })
  gender_rank_numeric: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  cat_rank: string;

  @Column({ type: 'int', nullable: true })
  cat_rank_numeric: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  gender: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  chip_time: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  gun_time: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  timing_point: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  pace: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  certi: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  certificate: string;

  @Column({ type: 'text', nullable: true })
  overall_ranks: string;

  @Column({ type: 'text', nullable: true })
  gender_ranks: string;

  @Column({ type: 'text', nullable: true })
  chiptimes: string;

  @Column({ type: 'text', nullable: true })
  guntimes: string;

  @Column({ type: 'text', nullable: true })
  paces: string;

  @Column({ type: 'text', nullable: true })
  tods: string;

  @Column({ type: 'text', nullable: true })
  sectors: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  overrank_live: string;

  @Column({ type: 'int', nullable: true })
  overrank_live_numeric: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  gap: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  nationality: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  nation: string;

  @Column({ type: 'int' })
  race_id: number;

  @Column({ type: 'varchar', length: 50 })
  course_id: string;

  @Column({ type: 'varchar', length: 50 })
  distance: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  synced_at: Date;
}
