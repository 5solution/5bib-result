/**
 * FEATURE-046 — Race Recap public response DTO (PII strip BR-46-15/16).
 * 6 blocks render order BR-46-06: Hero → Podium → Pace → NegSplit → AG → Insight.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RecapHeroStatsDto {
  @ApiProperty() totalFinishers!: number;
  @ApiProperty() dnsCount!: number;
  @ApiProperty() dnfCount!: number;
  @ApiProperty() dsqCount!: number;
  @ApiProperty() headline!: string;
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
}

export class RecapPodiumPerCourseDto {
  @ApiProperty() courseId!: string;
  @ApiProperty() courseName!: string;
  @ApiPropertyOptional() distance?: string;
  @ApiProperty({ type: [RecapPodiumCellDto] }) male!: RecapPodiumCellDto[];
  @ApiProperty({ type: [RecapPodiumCellDto] }) female!: RecapPodiumCellDto[];
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
}
