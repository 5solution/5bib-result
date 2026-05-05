import { ApiProperty } from '@nestjs/swagger';
import { LiveLeaderboardCourseDto } from './live-leaderboard.dto';
import { SummaryCardsDto } from './summary-cards.dto';

/**
 * Phase 2.2 — Response DTO cho `GET /timing-alert/dashboard-snapshot/:raceId`.
 *
 * Single endpoint trả nhiều sections cho admin Command Center (F-005, ex-Cockpit):
 * - race-level KPI (Hero stats bar)
 * - per-course breakdown grid
 * - checkpoint progression (athlete flow chart)
 * - recent activity timeline (alert feed)
 * - F-005: live leaderboard (top N per course)
 * - F-005: summary cards (racekit / started / finished / dns / miss%)
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
      'Source của startedAt: status_history (admin manual transition, most accurate) | course_start_time (fallback từ startDate + course.startTime sớm nhất) | recent_history (fallback Tier 3 — dùng changedAt entry gần nhất nếu race=live mà không có data nào tốt hơn). Null khi startedAt null.',
  })
  startedAtSource!:
    | 'status_history'
    | 'course_start_time'
    | 'recent_history'
    | null;
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

  // F-005 — Command Center additive fields (additive only, KHÔNG đổi shape hiện có)
  @ApiProperty({
    type: [LiveLeaderboardCourseDto],
    description:
      'Top N live leaderboard per course (default 10). Empty array nếu race draft/pre_race.',
  })
  liveLeaderboard!: LiveLeaderboardCourseDto[];

  @ApiProperty({
    type: SummaryCardsDto,
    description: 'Race-level summary cards (racekit / started / finished / dns / miss%)',
  })
  summary!: SummaryCardsDto;

  @ApiProperty({ description: 'ISO timestamp khi snapshot generated' })
  generatedAt!: string;
}
