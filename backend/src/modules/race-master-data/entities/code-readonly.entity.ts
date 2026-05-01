import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { RaceCourseReadonly } from './race-course-readonly.entity';

/**
 * READ-ONLY. 5BIB platform `codes` table (số nhiều — KHÔNG phải `code`).
 * VĐV import qua code (không qua order/mua vé) link tới race_course qua
 * `race_course_id` trên code này.
 *
 * Use case: race 192 có 2070/3267 athletes (63%) thiếu order_line_item_id
 * (admin import bulk qua code). JOIN `athletes.code_id → codes.race_course_id`
 * là path duy nhất để lấy cự ly cho nhóm này.
 */
@Entity('codes')
export class CodeReadonly {
  @PrimaryColumn({ type: 'bigint' })
  id: number;

  /**
   * Tên column thực tế trên codes table là `course_id` (FK tới
   * race_course.id), KHÔNG phải `race_course_id` như subinfo path.
   */
  @Column({ type: 'bigint', name: 'course_id', nullable: true })
  course_id: number | null;

  @ManyToOne(() => RaceCourseReadonly, { nullable: true })
  @JoinColumn({ name: 'course_id' })
  raceCourse: RaceCourseReadonly | null;
}
