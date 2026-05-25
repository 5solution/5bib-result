import { ApiProperty } from '@nestjs/swagger';

/**
 * F-062 Wave 2B-1 NEW DTO — Monthly revenue aggregation point (BR-SA-03 v3).
 *
 * Một item = 1 calendar month trong period.
 * Group by `DATE_FORMAT(payment_on, '%Y-%m')` (Wave 1 resolveBucketSize 'monthly').
 *
 * Bucket key format `YYYY-MM` (vd `2026-05` cho tháng 5 năm 2026).
 */
export class MonthlyRevenuePointDto {
  @ApiProperty({
    description: 'Calendar month key',
    example: '2026-05',
  })
  month!: string;

  @ApiProperty({
    description: 'Gross merchandise value (sum total_price)',
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
      'Platform fee via FeeService.computeFeeForOrdersAggregate() — F-040 cascade. ' +
      'KHÔNG inline tính phí.',
    example: 105000000,
  })
  platformFee!: number;

  @ApiProperty({
    description: 'Số đơn paid (exclude MANUAL trong revenue calc per business invariant)',
    example: 2845,
  })
  orderCount!: number;
}
