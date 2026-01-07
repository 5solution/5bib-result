import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from 'src/utils/base/base-entity';
import { RaceEntity } from './race.entity';
import { TicketTypeEntity } from './ticket-type.entity';
import { RaceResultEntity } from 'src/modules/race-result/entities/race-result.entity';

@Entity('race_courses')
@Index(['race_id'])
@Index(['variant_id'])
@Index(['course_type'])
export class RaceCourseEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  distance: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  prefix: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price: number;

  @Column({ type: 'int' })
  race_id: number;

  @Column({ type: 'int', nullable: true })
  variant_id: number;

  @Column({ type: 'int', default: 1 })
  max_participate: number;

  @Column({ type: 'int', default: 1 })
  max_ticket_per_order: number;

  @Column({ type: 'int', default: 1 })
  min_ticket_per_order: number;

  @Column({ type: 'timestamp', nullable: true })
  open_for_sale_date_time: Date;

  @Column({ type: 'timestamp', nullable: true })
  close_for_sale_date_time: Date;

  @Column({ type: 'text', nullable: true })
  medal_url: string;

  @Column({ type: 'text', nullable: true })
  ticket_image_url: string;

  @Column({ type: 'text', nullable: true })
  route_image_url: string;

  @Column({ type: 'text', nullable: true })
  route_map_image_url: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  race_result_url: string;

  @Column({ type: 'int', nullable: true })
  min_age: number;

  @Column({ type: 'int', nullable: true })
  max_age: number;

  @Column({ type: 'varchar', length: 50, default: 'NONE' })
  race_result_import_status: string;

  @Column({ type: 'jsonb', nullable: true })
  exclude_bibs: any;

  @Column({ type: 'varchar', length: 50, default: 'ORDINARY' })
  course_type: string;

  @Column({ type: 'int', nullable: true })
  min_bib: number;

  @Column({ type: 'int', nullable: true })
  max_bib: number;

  @Column({ type: 'int', nullable: true })
  nice_number_difficult: number;

  @Column({ type: 'text', nullable: true })
  bib_image_template: string;

  @Column({ type: 'text', nullable: true })
  bib_image_template_fb: string;

  @Column({ type: 'text', nullable: true })
  story_image_template: string;

  @Column({ type: 'text', nullable: true })
  story_image_template_fb: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  gain: string;

  @Column({ type: 'jsonb', nullable: true })
  customize_fields: any;

  @Column({ type: 'jsonb', nullable: true })
  add_ons: any;

  @Column({ type: 'int', nullable: true })
  max_ticket_per_user: number;

  @ManyToOne(() => RaceEntity, (race) => race.race_courses)
  @JoinColumn({ name: 'race_id' })
  race: RaceEntity;

  @OneToMany(() => TicketTypeEntity, (ticketType) => ticketType.race_course)
  ticket_types: TicketTypeEntity[];

  @OneToMany(() => RaceResultEntity, (result) => result.course_id)
  race_results: RaceResultEntity[];
}
