import { ApiProperty } from '@nestjs/swagger';

/**
 * F-062 Wave 2C-3 NEW DTO — GA4 Overview response (BR-SA-11 v3).
 *
 * Proxy của Google Analytics 4 Data API v4 metrics.
 * Returns `available: false` when GA4 not configured (does NOT throw 500).
 */
export class Ga4DailySessionPointDto {
  @ApiProperty({ example: '2026-05-20' }) date!: string;
  @ApiProperty({ example: 1245 }) sessions!: number;
}

export class Ga4TopPageDto {
  @ApiProperty({ example: '/races/vnexpress-marathon-2026' }) page!: string;
  @ApiProperty({ example: 5240 }) pageviews!: number;
}

export class Ga4TrafficSourceDto {
  @ApiProperty({ example: 'google / organic' }) source!: string;
  @ApiProperty({ example: 12450 }) sessions!: number;
}

export class Ga4OverviewResponseDto {
  @ApiProperty({
    description: 'false nếu GA4 chưa config (KHÔNG throw 500 per BR-SA-11)',
    example: true,
  })
  available!: boolean;

  @ApiProperty({ required: false, example: 'GA4 chưa được cấu hình' })
  error?: string;

  @ApiProperty({ required: false, example: 24500 })
  sessions?: number;

  @ApiProperty({ required: false, example: 89500 })
  pageviews?: number;

  @ApiProperty({ required: false, example: 0.42 })
  bounceRate?: number;

  @ApiProperty({ required: false, example: 195.5 })
  avgSessionDuration?: number;

  @ApiProperty({ required: false, example: 8400 })
  newUsers?: number;

  @ApiProperty({ type: Ga4TopPageDto, isArray: true, required: false })
  topPages?: Ga4TopPageDto[];

  @ApiProperty({ type: Ga4TrafficSourceDto, isArray: true, required: false })
  trafficSources?: Ga4TrafficSourceDto[];

  @ApiProperty({ type: Ga4DailySessionPointDto, isArray: true, required: false })
  dailySessions?: Ga4DailySessionPointDto[];
}
