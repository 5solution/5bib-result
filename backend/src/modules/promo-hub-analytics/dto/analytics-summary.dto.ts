import { ApiProperty } from '@nestjs/swagger';

/**
 * FEATURE-027 — GET /api/promo-hub-analytics/:hubId/summary response.
 *
 * Aggregated view/click metrics for admin dashboard. Server queries
 * `promo_hub_views` + `promo_hub_clicks` and rolls up:
 *   - Total views + clicks (CTR derived)
 *   - Views/clicks per day (last 7d, last 30d windows)
 *   - Top section CTRs (click count per sectionId, sorted desc)
 *   - Top labels (most-clicked CTA labels across all sections)
 *   - Top referers (traffic source attribution)
 *
 * Time-series buckets returned ISO-date strings keyed by day.
 */

export class TimeSeriesDataPointDto {
  @ApiProperty({ description: 'ISO date string YYYY-MM-DD' })
  date!: string;

  @ApiProperty()
  count!: number;
}

export class TopSectionDto {
  @ApiProperty()
  sectionId!: string;

  @ApiProperty()
  clicks!: number;
}

export class TopLabelDto {
  @ApiProperty()
  label!: string;

  @ApiProperty()
  clicks!: number;
}

export class TopRefererDto {
  @ApiProperty()
  referer!: string;

  @ApiProperty()
  views!: number;
}

export class AnalyticsSummaryDto {
  @ApiProperty()
  hubId!: string;

  @ApiProperty({
    description: 'Total views in last 30 days (also reflects TTL window)',
  })
  totalViews!: number;

  @ApiProperty({
    description: 'Total clicks in last 30 days',
  })
  totalClicks!: number;

  @ApiProperty({
    description:
      'Click-through rate = totalClicks / totalViews (0 if no views). Range 0.0-N (>1 possible if multiple clicks per view).',
  })
  ctr!: number;

  @ApiProperty({ type: [TimeSeriesDataPointDto], description: 'Views per day, last 30 days' })
  viewsByDay!: TimeSeriesDataPointDto[];

  @ApiProperty({ type: [TimeSeriesDataPointDto], description: 'Clicks per day, last 30 days' })
  clicksByDay!: TimeSeriesDataPointDto[];

  @ApiProperty({ type: [TopSectionDto], description: 'Top 10 sections by click count' })
  topSections!: TopSectionDto[];

  @ApiProperty({ type: [TopLabelDto], description: 'Top 10 CTA labels by click count' })
  topLabels!: TopLabelDto[];

  @ApiProperty({
    type: [TopRefererDto],
    description: 'Top 10 referer URLs by view count (traffic sources)',
  })
  topReferers!: TopRefererDto[];

  @ApiProperty({ description: 'ISO timestamp when summary was generated' })
  generatedAt!: string;
}
