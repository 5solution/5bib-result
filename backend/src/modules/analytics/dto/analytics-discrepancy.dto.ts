import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Matches, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * F-058 BR-58-08 — DTO cho `GET /api/analytics/discrepancy-check`.
 * Finance admin ad-hoc check để compare Analytics aggregate vs Reconciliation totals.
 */

export class DiscrepancyCheckQueryDto {
  @ApiProperty({ description: 'Tenant ID MySQL platform', example: 123 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  tenantId!: number;

  @ApiProperty({
    description: 'Tháng cần check, format YYYY-MM',
    example: '2026-06',
    pattern: '^\\d{4}-\\d{2}$',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'month phải format YYYY-MM' })
  month!: string;
}

export class FeeBreakdownAggregateDto {
  @ApiProperty({ description: 'Tổng service fee VND' })
  totalServiceFee!: number;

  @ApiProperty({ description: 'Tổng manual fee VND' })
  totalManualFee!: number;

  @ApiProperty({ description: 'Tổng VAT VND' })
  totalVat!: number;

  @ApiProperty({ description: 'Tổng fee = service + manual + vat' })
  totalFee!: number;
}

export class ReconciliationAggregateDto extends FeeBreakdownAggregateDto {
  @ApiProperty({ description: 'Tổng net GMV VND' })
  totalNetGmv!: number;

  @ApiProperty({ description: 'Số reconciliation doc đã match tháng đó' })
  reconCount!: number;

  @ApiProperty({ type: [String], description: 'Mongo _id của các reconciliation đã aggregate' })
  reconciliationIds!: string[];
}

export class DeltaDto {
  @ApiProperty({ description: 'Delta tuyệt đối VND = analytics.totalFee - recon.totalFee' })
  absVnd!: number;

  @ApiProperty({
    description: 'Delta % vs reconciliation (rounded 2 decimals)',
    nullable: true,
  })
  pctOfReconciliation!: number | null;
}

export type DiscrepancyVerdict = 'MATCH' | 'MINOR_DRIFT' | 'MAJOR_DRIFT' | 'NO_RECONCILIATION';

export class DiscrepancyCheckResponseDto {
  @ApiProperty()
  tenantId!: number;

  @ApiProperty({ example: '2026-06' })
  month!: string;

  @ApiProperty({ type: () => FeeBreakdownAggregateDto })
  analyticsAggregate!: FeeBreakdownAggregateDto;

  @ApiProperty({ type: () => ReconciliationAggregateDto })
  reconciliationAggregate!: ReconciliationAggregateDto;

  @ApiProperty({ type: () => DeltaDto, nullable: true })
  delta!: DeltaDto | null;

  @ApiProperty({
    enum: ['MATCH', 'MINOR_DRIFT', 'MAJOR_DRIFT', 'NO_RECONCILIATION'],
    description: 'MATCH = abs<=threshold AND pct<=thresholdPct; MINOR = pct<1%; MAJOR = pct>=1%; NO_RECONCILIATION = chưa có recon doc',
  })
  verdict!: DiscrepancyVerdict;

  @ApiProperty({ description: 'Threshold absolute VND default 1000' })
  thresholdAbsVnd!: number;

  @ApiProperty({ description: 'Threshold % default 0.1' })
  thresholdPct!: number;
}
