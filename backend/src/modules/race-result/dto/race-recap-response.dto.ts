/**
 * FEATURE-046 — Race Recap public response DTO (PII strip BR-46-15/16).
 * 6 blocks render order BR-46-06: Hero → Podium → Pace → NegSplit → AG → Insight.
 *
 * FEATURE-056 — Extended fields (all `@ApiPropertyOptional`, backward-compat
 * BR-56-19):
 *  - RecapPodiumCellDto.city (GAP #1)
 *  - RecapPodiumPerCourseDto.maleFinisherCount / femaleFinisherCount
 *  - RecapNegativeSplitDto.{avgFirstHalf,avgSecondHalf,deltaSeconds,finishersAnalyzed} (GAP #2)
 *  - RecapHeroStatsDto.registered (BR-56-13)
 *  - RaceRecapResponseDto.spotlightStoriesByCourse (GAP #3)
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RecapHeroStatsDto {
  @ApiProperty() totalFinishers!: number;
  @ApiProperty() dnsCount!: number;
  @ApiProperty() dnfCount!: number;
  @ApiProperty() dsqCount!: number;
  @ApiProperty() headline!: string;

  /** F-056 BR-56-13 — Total registered (sum all status). Used for "Tổng X / Y" header. */
  @ApiPropertyOptional({ description: 'F-056 Tổng số VĐV đăng ký (mọi trạng thái)' })
  registered?: number;
}

export class RecapPodiumCellDto {
  @ApiProperty() name!: string;
  @ApiProperty() bib!: string;
  @ApiProperty() chipTime!: string;
  @ApiPropertyOptional() category?: string;
  @ApiProperty({ enum: ['gold', 'silver', 'bronze'] })
  medal!: 'gold' | 'silver' | 'bronze';

  /**
   * F-046 Phase 1.5 — Public-shareable avatar (athlete self-uploaded per F-013
   * result image precedent). NOT PII — public consent implicit. Email still
   * stripped (BR-46-15). May be null if athlete didn't upload.
   */
  @ApiPropertyOptional() avatarUrl?: string;

  /**
   * F-056 GAP #1 — Derived city per BR-56-04 chain. Max 80 chars (DTO mandate +
   * BR-56-21 truncate-ellipsis). Hide chip if null.
   */
  @ApiPropertyOptional({
    description: 'F-056 City per podium athlete (derived chain)',
    maxLength: 80,
  })
  city?: string;
}

export class RecapPodiumPerCourseDto {
  @ApiProperty() courseId!: string;
  @ApiProperty() courseName!: string;
  @ApiPropertyOptional() distance?: string;
  @ApiProperty({ type: [RecapPodiumCellDto] }) male!: RecapPodiumCellDto[];
  @ApiProperty({ type: [RecapPodiumCellDto] }) female!: RecapPodiumCellDto[];

  /** F-056 BR-56-13 — Finisher count per gender for podium section header. */
  @ApiPropertyOptional({ description: 'F-056 Tổng số finisher Nam' })
  maleFinisherCount?: number;

  @ApiPropertyOptional({ description: 'F-056 Tổng số finisher Nữ' })
  femaleFinisherCount?: number;
}

export class RecapPaceStatsDto {
  @ApiProperty() courseId!: string;
  @ApiProperty() courseName!: string;
  @ApiProperty() medianPace!: string;
  @ApiProperty() p10Pace!: string;
  @ApiProperty() p90Pace!: string;
  @ApiProperty({ type: [Number] }) distribution!: number[];
  @ApiProperty() finisherCount!: number;
}

export class RecapNegativeSplitDto {
  @ApiProperty() courseId!: string;
  @ApiProperty() courseName!: string;
  @ApiProperty() negativeSplitPercent!: number;
  @ApiProperty() interpretation!: string;

  /** F-056 GAP #2 — Avg 1st half hh:mm:ss across analyzed finishers. */
  @ApiPropertyOptional({
    description: 'F-056 Average 1st half time hh:mm:ss',
  })
  avgFirstHalf?: string;

  /** F-056 GAP #2 — Avg 2nd half hh:mm:ss. */
  @ApiPropertyOptional({
    description: 'F-056 Average 2nd half time hh:mm:ss',
  })
  avgSecondHalf?: string;

  /** F-056 GAP #2 — Δ delta (avg2H - avg1H). Positive = positive split. */
  @ApiPropertyOptional({
    description: 'F-056 Delta seconds (positive = positive split)',
  })
  deltaSeconds?: number;

  /** F-056 GAP #2 — Count finishers analyzed (had valid checkpoint data). */
  @ApiPropertyOptional({
    description: 'F-056 Số finisher có data đủ để compute split',
  })
  finishersAnalyzed?: number;

  /** F-056 BR-56-02 — Hardcoded VN benchmark (40). */
  @ApiPropertyOptional({ description: 'F-056 Benchmark Vietnam (40)' })
  benchmark?: number;
}

export class RecapAGBucketDto {
  @ApiProperty() category!: string;
  @ApiProperty() finisherCount!: number;
  @ApiProperty({ type: [RecapPodiumCellDto] }) top5!: RecapPodiumCellDto[];
}

export class RecapAGBreakdownPerCourseDto {
  @ApiProperty() courseId!: string;
  @ApiProperty() courseName!: string;
  @ApiProperty({ type: [RecapAGBucketDto] }) buckets!: RecapAGBucketDto[];
}

// F-056 NEW — Spotlight Stories (GAP #3)

export class RecapSpotlightStoryDto {
  @ApiProperty({ description: 'Course ID this story refers to' })
  courseId!: string;

  @ApiProperty({ enum: ['M', 'F'] })
  gender!: 'M' | 'F';

  @ApiProperty({ description: 'Winner BIB number' })
  winnerBib!: string;

  @ApiProperty({ description: 'Winner display name' })
  winnerName!: string;

  @ApiProperty({ description: 'Auto-gen or admin-curated markdown source' })
  markdown!: string;

  @ApiProperty({ description: 'Pre-rendered sanitized HTML' })
  html!: string;

  @ApiProperty({ enum: ['admin', 'auto'] })
  source!: 'admin' | 'auto';
}

export class RecapSpotlightPerCourseDto {
  @ApiProperty() courseId!: string;
  @ApiProperty() courseName!: string;
  @ApiProperty({ type: [RecapSpotlightStoryDto] })
  stories!: RecapSpotlightStoryDto[];
}

export class RaceRecapResponseDto {
  @ApiProperty() raceId!: string;
  @ApiProperty() raceTitle!: string;
  @ApiProperty() raceSlug!: string;
  @ApiPropertyOptional() endDate?: string;
  @ApiProperty({ type: RecapHeroStatsDto }) hero!: RecapHeroStatsDto;
  @ApiProperty({ type: [RecapPodiumPerCourseDto] })
  podiums!: RecapPodiumPerCourseDto[];
  @ApiProperty({ type: [RecapPaceStatsDto] }) paceStats!: RecapPaceStatsDto[];
  @ApiProperty({ type: [RecapNegativeSplitDto] })
  negativeSplits!: RecapNegativeSplitDto[];
  @ApiProperty({ type: [RecapAGBreakdownPerCourseDto] })
  agBreakdowns!: RecapAGBreakdownPerCourseDto[];
  @ApiProperty() computedAt!: string;

  /** F-056 GAP #3 — Spotlight editorial per podium winner per course. */
  @ApiPropertyOptional({ type: [RecapSpotlightPerCourseDto] })
  spotlightStoriesByCourse?: RecapSpotlightPerCourseDto[];
}
