import { ApiProperty } from '@nestjs/swagger';

// ─── F-03: Time Distribution ────────────────────────────────────

export class TimeDistributionBucketDto {
  @ApiProperty({
    description: 'Time range label',
    example: '3h00-3h30',
  })
  range!: string;

  @ApiProperty({
    description: 'Lower bound in seconds (inclusive)',
    example: 10800,
  })
  minSeconds!: number;

  @ApiProperty({
    description: 'Upper bound in seconds (exclusive)',
    example: 12600,
  })
  maxSeconds!: number;

  @ApiProperty({
    description: 'Count of athletes in this range',
    example: 42,
  })
  count!: number;

  @ApiProperty({
    description: 'Percentage of total finishers (0–100, 1 decimal)',
    example: 12.5,
  })
  percentage!: number;
}

export class TimeDistributionDataDto {
  @ApiProperty({ type: [TimeDistributionBucketDto] })
  buckets!: TimeDistributionBucketDto[];

  @ApiProperty({ description: 'Total finishers counted' })
  totalFinishers!: number;

  @ApiProperty({ description: 'Fastest finish time seconds', example: 7342 })
  minSeconds!: number;

  @ApiProperty({ description: 'Slowest finish time seconds', example: 25000 })
  maxSeconds!: number;

  @ApiProperty({ description: 'Average finish time seconds', example: 14250 })
  avgSeconds!: number;

  @ApiProperty({
    description:
      'True if aggregation was computed on a sample (>10k finishers) rather than full set',
    example: false,
  })
  sampled!: boolean;
}

export class TimeDistributionResponseDto {
  @ApiProperty({ type: TimeDistributionDataDto })
  data!: TimeDistributionDataDto;

  @ApiProperty({ example: true })
  success!: boolean;
}

// ─── F-04: Country Stats ────────────────────────────────────────

export class CountryStatsItemDto {
  @ApiProperty({ description: 'Raw nationality string from data', example: 'Vietnam' })
  nationality!: string;

  @ApiProperty({ description: 'ISO-2 code when resolvable, else empty', example: 'VN' })
  iso2!: string;

  @ApiProperty({ description: 'Number of finishers from this country', example: 312 })
  count!: number;

  @ApiProperty({
    description: 'Best chip time string (HH:MM:SS)',
    example: '2:58:12',
  })
  bestTime!: string;

  @ApiProperty({ description: 'Best chip time in seconds', example: 10692 })
  bestSeconds!: number;
}

export class CountryStatsDataDto {
  @ApiProperty({ type: [CountryStatsItemDto] })
  countries!: CountryStatsItemDto[];

  @ApiProperty({ description: 'Total distinct countries', example: 18 })
  totalCountries!: number;
}

export class CountryStatsResponseDto {
  @ApiProperty({ type: CountryStatsDataDto })
  data!: CountryStatsDataDto;

  @ApiProperty({ example: true })
  success!: boolean;
}

// ─── F-04: Country Rank (per athlete) ───────────────────────────

export class CountryRankDataDto {
  @ApiProperty({
    description: 'Rank among same-nationality athletes (1-based)',
    example: 5,
    nullable: true,
  })
  rank!: number | null;

  @ApiProperty({
    description: 'Total same-nationality finishers on this course',
    example: 312,
  })
  total!: number;

  @ApiProperty({ example: 'Vietnam' })
  nationality!: string;

  @ApiProperty({ example: 'VN' })
  iso2!: string;
}

export class CountryRankResponseDto {
  @ApiProperty({ type: CountryRankDataDto })
  data!: CountryRankDataDto;

  @ApiProperty({ example: true })
  success!: boolean;
}

// ─── F-06: Performance Percentile (P1) ──────────────────────────

export class PercentileDataDto {
  @ApiProperty({
    description: 'Percentile 0–100 (higher = faster). Null if athlete is DNF or chipTime invalid.',
    example: 72,
    nullable: true,
  })
  percentile!: number | null;

  @ApiProperty({ description: 'Count of finishers slower than athlete', example: 225 })
  slowerCount!: number;

  @ApiProperty({ description: 'Total finishers on this course', example: 312 })
  totalFinishers!: number;

  @ApiProperty({ description: 'Athlete chipTime seconds', example: 10692 })
  athleteSeconds!: number;

  @ApiProperty({ description: 'Course average seconds', example: 14250 })
  avgSeconds!: number;

  @ApiProperty({ description: 'Course fastest seconds', example: 7342 })
  minSeconds!: number;
}

export class PercentileResponseDto {
  @ApiProperty({ type: PercentileDataDto })
  data!: PercentileDataDto;

  @ApiProperty({ example: true })
  success!: boolean;
}
