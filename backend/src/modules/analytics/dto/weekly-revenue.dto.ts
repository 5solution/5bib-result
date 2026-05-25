import { ApiProperty } from '@nestjs/swagger';

/**
 * F-062 Wave 2B-1 NEW DTO — Weekly revenue aggregation point (BR-SA-02 v3).
 *
 * Một item = 1 ISO 8601 week (Thứ 2 → Chủ nhật) trong period.
 * Group by `YEARWEEK(payment_on, 3)` (Wave 1 resolveBucketSize 'weekly').
 *
 * Bucket key format `YYYY-Www` (vd `2026-W21` cho tuần 21 năm 2026).
 */
export class WeeklyRevenuePointDto {
  @ApiProperty({
    description: 'ISO 8601 week key',
    example: '2026-W21',
  })
  week!: string;

  @ApiProperty({
    description: 'First day of week (Monday) YYYY-MM-DD',
    example: '2026-05-18',
  })
  weekStart!: string;

  @ApiProperty({
    description: 'Last day of week (Sunday) YYYY-MM-DD',
    example: '2026-05-24',
  })
  weekEnd!: string;

  @ApiProperty({
    description: 'Gross merchandise value (sum total_price)',
    example: 381990000,
  })
  gmv!: number;

  @ApiProperty({
    description: 'Net GMV = gmv - total_discounts',
    example: 365000000,
  })
  netGmv!: number;

  @ApiProperty({
    description:
      'Platform fee via FeeService.computeFeeForOrdersAggregate() — F-040 cascade. ' +
      'KHÔNG inline tính phí.',
    example: 28878444,
  })
  platformFee!: number;

  @ApiProperty({
    description: 'Số đơn paid (exclude MANUAL trong revenue calc per business invariant)',
    example: 713,
  })
  orderCount!: number;
}
