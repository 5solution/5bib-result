import { ApiProperty } from '@nestjs/swagger';

/**
 * Phase 2.2 — Response DTO cho `GET /timing-alert/dashboard-snapshot/:raceId`.
 *
 * Single endpoint trả 4 sections cho admin cockpit:
 * - race-level KPI (Hero stats bar)
 * - per-course breakdown grid
 * - checkpoint progression (cho stacked bar chart Recharts)
 * - recent activity timeline
 */

export class RaceMetaDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ description: 'draft | pre_race | live | ended' })
  status!: string;
  @ApiProperty({ nullable: true, type: String })
  startDate!: string | null;
  @ApiProperty({ nullable: true, type: String })
  endDate!: string | null;
  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'ISO timestamp khi race CHÍNH THỨC start (status → live). Null nếu chưa start (draft/pre_race). Frontend dùng để hiển thị elapsed clock trên Cockpit.',
  })
  startedAt!: string | null;
  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'Source của startedAt: status_history (admin manual transition) | course_start_time (fallback từ startDate + course.startTime sớm nhất). Null khi startedAt null.',
  })
  startedAtSource!: 'status_history' | 'course_start_time' | null;
}

export class RaceStatsDto {
  @ApiProperty({ description: 'Athletes có Start time' })
  started!: number;
  @ApiProperty({ description: 'Athletes có Finish time' })
  finished!: number;
  @ApiProperty({ description: 'Started - Finished (đang trên đường)' })
  onCourse!: number;
  @ApiProperty({ description: 'Số alerts OPEN tổng cộng' })
  suspectOpen!: number;
  @ApiProperty({ description: 'Số CRITICAL alerts OPEN' })
  criticalOpen!: number;
  @ApiProperty({ description: 'Race progress 0..1 = finished / started' })
  progress!: number;
}

export class CourseStatsDto {
  @ApiProperty() courseId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true, type: Number })
  distanceKm!: number | null;
  @ApiProperty({ nullable: true, type: String })
  cutOffTime!: string | null;
  @ApiProperty({ nullable: true, type: String, description: 'RR API URL — null nếu BTC chưa wire' })
  apiUrl!: string | null;
  @ApiProperty({ description: 'Course đã có checkpoints config (BTC apply discover)' })
  hasCheckpoints!: boolean;

  @ApiProperty() started!: number;
  @ApiProperty() finished!: number;
  @ApiProperty() onCourse!: number;
  @ApiProperty() suspectCount!: number;
  @ApiProperty({ nullable: true, type: String, description: 'Top finisher chiptime cho card hiển thị' })
  leadingChipTime!: string | null;
}

export class CheckpointPointDto {
  @ApiProperty() key!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true, type: Number })
  distanceKm!: number | null;
  @ApiProperty() orderIndex!: number;
  @ApiProperty({ description: 'Số athletes đã passed checkpoint này' })
  passedCount!: number;
  @ApiProperty({ description: 'Started count — denominator cho ratio' })
  expectedCount!: number;
  @ApiProperty({ description: '0..1 = passedCount / expectedCount' })
  passedRatio!: number;
}

export class CheckpointProgressionDto {
  @ApiProperty() courseId!: string;
  @ApiProperty() courseName!: string;
  @ApiProperty({ nullable: true, type: Number })
  distanceKm!: number | null;
  @ApiProperty() startedCount!: number;
  @ApiProperty({ type: [CheckpointPointDto] })
  points!: CheckpointPointDto[];
}

export class RecentActivityItemDto {
  @ApiProperty({ description: 'alert.created | alert.resolved | poll.completed' })
  type!: string;
  @ApiProperty({ description: 'ISO timestamp' })
  at!: string;
  @ApiProperty({ description: 'Type-specific payload' })
  payload!: Record<string, unknown>;
}

export class DashboardSnapshotResponseDto {
  @ApiProperty() race!: RaceMetaDto;
  @ApiProperty() raceStats!: RaceStatsDto;
  @ApiProperty({ type: [CourseStatsDto] }) courses!: CourseStatsDto[];
  @ApiProperty({ type: [CheckpointProgressionDto] })
  checkpointProgression!: CheckpointProgressionDto[];
  @ApiProperty({ type: [RecentActivityItemDto] })
  recentActivity!: RecentActivityItemDto[];
  @ApiProperty({ description: 'ISO timestamp khi snapshot generated' })
  generatedAt!: string;
}
