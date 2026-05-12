import { ApiProperty } from '@nestjs/swagger';

/**
 * F-028 Phase 2 — aggregated dashboard response shapes.
 *
 * Server compute từ contracts collection ($lookup cost_items) một lần rồi
 * cho UI 3 chiều xem (Type / Partner / Time) + Top profit/Loss-making.
 *
 * Mỗi contract entry chứa đủ field FE render bảng — KHÔNG cần round-trip
 * /pnl per row (BR-PNL-13 cache 120s aggregated).
 */

export class DashboardContractItemDto {
  @ApiProperty() contractId!: string;
  @ApiProperty({ nullable: true }) contractNumber?: string | null;
  @ApiProperty({ nullable: true }) partnerName?: string | null;
  @ApiProperty({ nullable: true }) raceName?: string | null;
  @ApiProperty({ enum: ['TICKET_SALES', 'TIMING', 'RACEKIT', 'OPERATIONS'] })
  contractType!: 'TICKET_SALES' | 'TIMING' | 'RACEKIT' | 'OPERATIONS';
  @ApiProperty() status!: string;
  @ApiProperty() revenue!: number;
  @ApiProperty({ enum: ['ESTIMATED', 'ACTUAL'] })
  revenueSource!: 'ESTIMATED' | 'ACTUAL';
  @ApiProperty() totalCost!: number;
  @ApiProperty() profit!: number;
  @ApiProperty({ nullable: true }) margin!: number | null;
  @ApiProperty({ enum: ['loss', 'thin', 'healthy', 'neutral'] })
  marginTier!: 'loss' | 'thin' | 'healthy' | 'neutral';
  @ApiProperty({
    description: 'Anchor month YYYY-MM (signDate fallback createdAt)',
    nullable: true,
  })
  anchorMonth!: string | null;
}

export class DashboardGroupBucketDto {
  @ApiProperty({ description: 'Group key — contractType | partnerName | YYYY-MM' })
  key!: string;
  @ApiProperty({ description: 'Display label tiếng Việt (vd "Vé/đăng ký")' })
  label!: string;
  @ApiProperty() contractCount!: number;
  @ApiProperty() totalRevenue!: number;
  @ApiProperty() totalCost!: number;
  @ApiProperty() totalProfit!: number;
  @ApiProperty({ nullable: true }) avgMargin!: number | null;
}

export class DashboardTotalsDto {
  @ApiProperty() contractCount!: number;
  @ApiProperty() totalRevenue!: number;
  @ApiProperty() totalCost!: number;
  @ApiProperty() totalProfit!: number;
  @ApiProperty({ nullable: true }) avgMargin!: number | null;
  @ApiProperty({
    description: 'Cost by category aggregated cho donut chart',
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { LABOR: 0, MATERIAL: 0, VENDOR: 0, OUTSOURCE: 0, OTHER: 0 },
  })
  costByCategory!: Record<string, number>;
}

export class PnLDashboardResponseDto {
  @ApiProperty() period!: string;
  @ApiProperty() dateFrom!: string;
  @ApiProperty() dateTo!: string;
  @ApiProperty()
  generatedAt!: string;
  @ApiProperty({ type: DashboardTotalsDto })
  totals!: DashboardTotalsDto;
  @ApiProperty({ type: [DashboardGroupBucketDto] })
  byType!: DashboardGroupBucketDto[];
  @ApiProperty({ type: [DashboardGroupBucketDto] })
  byPartner!: DashboardGroupBucketDto[];
  @ApiProperty({ type: [DashboardGroupBucketDto], description: 'Sort ASC by key YYYY-MM' })
  byMonth!: DashboardGroupBucketDto[];
  @ApiProperty({ type: [DashboardContractItemDto], description: 'Top 10 profit DESC' })
  topProfit!: DashboardContractItemDto[];
  @ApiProperty({ type: [DashboardContractItemDto], description: 'margin < 0' })
  lossMaking!: DashboardContractItemDto[];
}
