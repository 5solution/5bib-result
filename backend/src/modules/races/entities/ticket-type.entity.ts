import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from 'src/utils/base/base-entity';
import { RaceCourseEntity } from './race-course.entity';

@Entity('ticket_types')
@Index(['race_course_id'])
@Index(['unique_code'], { unique: true })
@Index(['type_name'])
export class TicketTypeEntity extends BaseEntity {
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  type_name: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  unique_code: string;

  @Column({ type: 'int' })
  race_course_id: number;

  @Column({ type: 'int', default: 1, nullable: true })
  max_participate: number;

  @Column({ type: 'int', default: 1, nullable: true })
  max_ticket_per_order: number;

  @Column({ type: 'int', default: 1, nullable: true })
  min_ticket_per_order: number;

  @Column({ type: 'int', default: 0, nullable: true })
  remained_ticket: number;

  @Column({ type: 'int', default: 0, nullable: true })
  sales_count: number;

  @Column({ type: 'int', default: 0, nullable: true })
  import_count: number;

  @Column({ type: 'text', nullable: true })
  image_url: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 10, default: 'VND', nullable: true })
  currency: string;

  @Column({ type: 'timestamp', nullable: true })
  valid_from: Date;

  @Column({ type: 'timestamp', nullable: true })
  valid_to: Date;

  @Column({ type: 'boolean', default: false })
  is_free: boolean;

  @Column({ type: 'boolean', default: true, nullable: true })
  is_show: boolean;

  @Column({ type: 'int', default: 0, nullable: true })
  claim_max_per_user: number;

  @Column({ type: 'int', default: 0, nullable: true })
  claim_counter: number;

  @Column({ type: 'boolean', default: false, nullable: true })
  is_5bib: boolean;

  @Column({ type: 'text', nullable: true })
  ticket_image_url: string;

  @Column({ type: 'varchar', length: 50, default: 'ORDINARY', nullable: true })
  course_type: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  race_course_name: string;

  @Column({ type: 'int', nullable: true })
  variant_id: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  race_course_distance: string;

  @ManyToOne(() => RaceCourseEntity, (raceCourse) => raceCourse.ticket_types)
  @JoinColumn({ name: 'race_course_id' })
  race_course: RaceCourseEntity;
}
