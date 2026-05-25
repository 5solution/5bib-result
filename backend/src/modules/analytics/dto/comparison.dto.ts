import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { AnalyticsQueryDto } from './analytics-query.dto';

/**
 * F-062 Wave 2B-1 NEW DTO — Comparison query (BR-SA-04 v3).
 *
 * Extends `AnalyticsQueryDto` (from/to/tenantId/raceId) thêm `compareWith` enum:
 * - `'wow'` — Week-over-Week (lùi 7 ngày, Wave 2A `shiftMonthClamped` symmetric pattern)
 * - `'mom'` — Month-over-Month (lùi 1 calendar month với day clamp, Wave 2A fix)
 * - `'yoy'` — Year-over-Year (lùi 1 năm)
 *
 * Default 'mom' (per PRD BR-SA-14 CompareSelector default).
 */
export class ComparisonQueryDto extends AnalyticsQueryDto {
  @ApiProperty({
    description:
      'Period-over-period comparison type. wow=Week, mom=Month, yoy=Year. ' +
      'Wave 2A: mom uses shiftMonthClamped day-clamp pattern (handle May 31 → April 30).',
    enum: ['wow', 'mom', 'yoy'],
    default: 'mom',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsIn(['wow', 'mom', 'yoy'])
  compareWith?: 'wow' | 'mom' | 'yoy';
}

/**
 * Metrics block trong comparison response (cả current + previous dùng cùng shape).
 */
export class ComparisonMetricsDto {
  @ApiProperty({
    description: 'Label cho UI hiển thị (vd "Tháng 5 / 2026" hoặc "Tuần 21")',
    example: 'Tháng 5 / 2026',
  })
  label!: string;

  @ApiProperty({
    description: 'Range start ISO datetime (inclusive)',
    example: '2026-05-01T00:00:00.000Z',
  })
  from!: string;

  @ApiProperty({
    description: 'Range end ISO datetime (exclusive)',
    example: '2026-06-01T00:00:00.000Z',
  })
  to!: string;

  @ApiProperty({
    description: 'Gross merchandise value',
    example: 1500000000,
  })
  gmv!: number;

  @ApiProperty({
    description: 'Net GMV = gmv - total_discounts',
    example: 1420000000,
  })
  netGmv!: number;

  @ApiProperty({
    description:
      'Platform fee via FeeService.computeFeeForOrdersAggregate() — F-040 cascade.',
    example: 105000000,
  })
  platformFee!: number;

  @ApiProperty({
    description: 'Số đơn paid (exclude MANUAL trong revenue calc)',
    example: 2845,
  })
  orderCount!: number;
}

/**
 * Delta % giữa current vs previous. `null` khi base=0 (avoid div-by-zero).
 */
export class ComparisonDeltaDto {
  @ApiProperty({
    description: 'GMV delta % vs previous. null nếu previous.gmv = 0.',
    nullable: true,
    example: 12.5,
  })
  gmvPct!: number | null;

  @ApiProperty({
    description: 'Net GMV delta % vs previous.',
    nullable: true,
    example: 11.8,
  })
  netGmvPct!: number | null;

  @ApiProperty({
    description: 'Platform fee delta % vs previous.',
    nullable: true,
    example: 13.2,
  })
  platformFeePct!: number | null;

  @ApiProperty({
    description: 'Order count delta % vs previous.',
    nullable: true,
    example: 8.4,
  })
  orderCountPct!: number | null;
}

/**
 * F-062 Wave 2B-1 NEW response — Period comparison (BR-SA-04 v3).
 */
export class ComparisonResponseDto {
  @ApiProperty({
    type: ComparisonMetricsDto,
    description: 'Metrics cho kỳ hiện tại',
  })
  current!: ComparisonMetricsDto;

  @ApiProperty({
    type: ComparisonMetricsDto,
    description: 'Metrics cho kỳ tham chiếu (WoW/MoM/YoY)',
  })
  previous!: ComparisonMetricsDto;

  @ApiProperty({
    type: ComparisonDeltaDto,
    description: 'Delta % của 4 metrics (calcDeltaPercent guard base=0 trả null)',
  })
  delta!: ComparisonDeltaDto;
}
