import { ApiProperty } from '@nestjs/swagger';

/**
 * F-062 Wave 2C-2 NEW DTO — Runner Summary 4 KPIs (BR-SA-20f v3).
 *
 * Tab 4 header KPI strip:
 *   - uniqueRunners: distinct user_id từ paid orders
 *   - repeatRate: % runners có ≥2 races
 *   - avgLeadTime: avg days từ order.created_at → race.event_start_date
 *   - avgOrdersPerRunner: totalOrders / uniqueRunners
 *
 * Mỗi KPI có delta MoM % (nullable when previous period base = 0).
 */
export class RunnerSummaryKpiResponseDto {
  @ApiProperty({
    description: 'Distinct user_id paid orders trong period',
    example: 10145,
  })
  uniqueRunners!: number;

  @ApiProperty({
    description: '% runners có ≥2 races đã tham gia',
    example: 16.2,
  })
  repeatRate!: number;

  @ApiProperty({
    description: 'Trung bình lead time = race.event_start_date - order.payment_on (days)',
    example: 42.5,
    nullable: true,
  })
  avgLeadTime!: number | null;

  @ApiProperty({
    description: 'Trung bình orders mỗi runner = totalOrders / uniqueRunners',
    example: 1.34,
  })
  avgOrdersPerRunner!: number;

  @ApiProperty({
    description: 'Delta MoM % cho 4 KPIs (nullable khi previous = 0)',
    nullable: true,
    type: 'object',
    additionalProperties: { type: 'number', nullable: true },
    example: {
      uniqueRunnersPct: 8.5,
      repeatRatePct: 1.2,
      avgLeadTimePct: -3.5,
      avgOrdersPerRunnerPct: null,
    },
  })
  deltaMoM!: {
    uniqueRunnersPct: number | null;
    repeatRatePct: number | null;
    avgLeadTimePct: number | null;
    avgOrdersPerRunnerPct: number | null;
  };
}
