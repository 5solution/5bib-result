import { Entity, PrimaryColumn, Column } from 'typeorm';

/** READ-ONLY. Lấy course `name` ('21KM', '42KM') hiển thị kiosk. */
@Entity('race_course')
export class RaceCourseReadonly {
  @PrimaryColumn({ type: 'bigint' })
  id: number;

  @Column({ nullable: true, type: 'varchar', length: 100 })
  name: string | null;

  @Column({ nullable: true, type: 'varchar', length: 50 })
  distance: string | null;
}
