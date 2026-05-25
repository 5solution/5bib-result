import { ApiProperty } from '@nestjs/swagger';

/**
 * F-062 Wave 2B-2 NEW DTO — Health Score distribution bucket (BR-SA-22b v3).
 *
 * 5 tiers per BR-SA-07 healthScore thresholds (0-19, 20-39, 40-59, 60-79, 80-100).
 * UI horizontal-bars chart: mỗi bar = 1 tier, width proportional to count.
 *
 * `color` field = Tailwind class name (vd `green-600`, `red-500`) per design palette
 * — design system mapping kept consistent giữa scatter labels + bar fill colors.
 */
export class MerchantHealthDistributionTierDto {
  @ApiProperty({
    description: 'Tier code (machine key)',
    enum: ['EXCELLENT', 'GOOD', 'AVERAGE', 'WEAK', 'AT_RISK_SCORE'],
    example: 'EXCELLENT',
  })
  tier!: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'WEAK' | 'AT_RISK_SCORE';

  @ApiProperty({
    description: 'VN label cho UI display',
    example: 'Xuất sắc',
  })
  label!: string;

  @ApiProperty({
    description: 'Min score inclusive cho tier (per BR-SA-07)',
    example: 80,
  })
  min!: number;

  @ApiProperty({
    description: 'Max score inclusive cho tier',
    example: 100,
  })
  max!: number;

  @ApiProperty({
    description: 'Số merchant rơi vào tier này trong period',
    example: 12,
  })
  count!: number;

  @ApiProperty({
    description: 'Tailwind color class name (per design palette)',
    example: 'green-600',
  })
  color!: string;
}
