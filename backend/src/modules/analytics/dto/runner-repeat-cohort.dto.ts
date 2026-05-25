import { ApiProperty } from '@nestjs/swagger';

/**
 * F-062 Wave 2C-2 NEW DTO — Repeat Cohort tier (BR-SA-20c v3).
 *
 * 4 tiers: 1 / 2 / 3-4 / 5+ races per unique runner.
 * Unique runner = distinct `user_id` từ paid orders trong period.
 */
export class RunnerRepeatCohortTierDto {
  @ApiProperty({
    description: 'Tier key',
    enum: ['1', '2', '3-4', '5+'],
    example: '1',
  })
  tier!: '1' | '2' | '3-4' | '5+';

  @ApiProperty({ description: 'VN label cho UI', example: '1 giải' })
  label!: string;

  @ApiProperty({ description: 'Số runner trong tier', example: 8500 })
  count!: number;

  @ApiProperty({
    description: '% của totalUniqueRunners (rounded 2 decimals)',
    example: 83.8,
  })
  percentage!: number;
}

export class RunnerRepeatCohortResponseDto {
  @ApiProperty({ type: RunnerRepeatCohortTierDto, isArray: true })
  tiers!: RunnerRepeatCohortTierDto[];

  @ApiProperty({
    description: 'Total unique runners (distinct user_id paid orders)',
    example: 10145,
  })
  totalUniqueRunners!: number;
}
