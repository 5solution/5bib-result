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
import { VolEvent } from './vol-event.entity';

// v1.8: "Team" layer above roles. A Team (aka Category) groups multiple
// roles of the same operational unit (e.g. Team Nước: Leader / Crew /
// TNV are 3 separate roles but share the SAME team). Stations + supply
// plans belong to a Team — that way all 3 ranks of a team can share and
// manage the team's stations.
@Entity('vol_team_category')
@Unique('uq_category_event_slug', ['event_id', 'slug'])
@Index('idx_category_event', ['event_id', 'sort_order'])
export class VolTeamCategory {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  event_id!: number;

  @ManyToOne(() => VolEvent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event?: VolEvent;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 60 })
  slug!: string;

  @Column({ type: 'varchar', length: 7, default: '#3B82F6' })
  color!: string;

  @Column({ type: 'int', default: 0 })
  sort_order!: number;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;
}
