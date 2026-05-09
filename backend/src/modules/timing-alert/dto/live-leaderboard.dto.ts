import { ApiProperty } from '@nestjs/swagger';

/**
 * FEATURE-005 — Live Leaderboard DTO cho tab Command Center.
 *
 * Sort logic (BR-CC-08):
 * - Athletes có Finish → ASC theo finish time
 * - Athletes chưa Finish → projected by last CP (orderIndex DESC)
 *
 * Athletes flag MISS-Finish (BR-CC-09): có intermediate time nhưng KHÔNG có Finish
 * → row magenta + icon trên FE.
 */
export class LiveLeaderboardEntryDto {
  @ApiProperty({ description: 'Sort rank within course (1..N)' })
  rank!: number;

  @ApiProperty({ description: 'Athlete BIB number' })
  bib!: string;

  @ApiProperty({ description: 'Display name (fallback "BIB X" nếu thiếu)' })
  athleteName!: string;

  @ApiProperty({ description: 'Last checkpoint key đã pass (vd Start, TM1, Finish)' })
  lastCheckpoint!: string;

  @ApiProperty({ description: 'Time at lastCheckpoint (HH:MM:SS hoặc MM:SS)' })
  lastCheckpointTime!: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Finish chip time (null nếu chưa finish)',
  })
  finishTime!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'Gap so với leader trên cùng course (null nếu chưa có data hoặc là leader)',
  })
  gap!: string | null;

  @ApiProperty({
    description:
      'TRUE nếu có intermediate time nhưng MISS Finish — UI highlight magenta (BR-CC-09)',
  })
  hasMissingFinish!: boolean;

  @ApiProperty({ nullable: true, type: String })
  gender!: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Age group / category' })
  ageGroup!: string | null;
}

export class LiveLeaderboardCourseDto {
  @ApiProperty() courseId!: string;
  @ApiProperty() courseName!: string;

  @ApiProperty({ nullable: true, type: Number })
  distanceKm!: number | null;

  @ApiProperty({ type: [LiveLeaderboardEntryDto] })
  entries!: LiveLeaderboardEntryDto[];
}
