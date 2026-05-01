import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { RaceCourseReadonly } from './race-course-readonly.entity';

/** READ-ONLY. JOIN từ order_line_item.ticket_type_id → race_course. */
@Entity('ticket_type')
export class TicketTypeReadonly {
  @PrimaryColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint', nullable: true })
  race_course_id: number | null;

  @ManyToOne(() => RaceCourseReadonly, { nullable: true })
  @JoinColumn({ name: 'race_course_id' })
  raceCourse: RaceCourseReadonly | null;
}
