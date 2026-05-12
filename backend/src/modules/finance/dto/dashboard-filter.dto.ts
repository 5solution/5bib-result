import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

/**
 * F-028 Phase 2 — query filter cho aggregated dashboard.
 *
 * `period` enum convention F-026 analytics. `dateFrom/dateTo` cho custom
 * range YYYY-MM-DD. `groupBy` quyết định default tab phía UI (server vẫn
 * trả về cả 3 chiều — type / partner / month).
 */
export const DASHBOARD_PERIODS = [
  'current_month',
  'last_3_months',
  'last_6_months',
  'last_12_months',
  'ytd',
  'custom',
] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export const DASHBOARD_GROUP_BYS = ['type', 'partner', 'month'] as const;
export type DashboardGroupBy = (typeof DASHBOARD_GROUP_BYS)[number];

export class PnLDashboardFilterDto {
  @ApiProperty({
    enum: DASHBOARD_PERIODS,
    required: false,
    default: 'last_3_months',
  })
  @IsOptional()
  @IsIn(DASHBOARD_PERIODS as unknown as string[])
  period?: DashboardPeriod = 'last_3_months';

  @ApiProperty({
    enum: DASHBOARD_GROUP_BYS,
    required: false,
    default: 'month',
    description: 'Default tab focus phía UI — server vẫn trả cả 3 chiều',
  })
  @IsOptional()
  @IsIn(DASHBOARD_GROUP_BYS as unknown as string[])
  groupBy?: DashboardGroupBy = 'month';

  @ApiProperty({
    required: false,
    example: '2026-01-01',
    description: 'ISO YYYY-MM-DD — chỉ dùng khi period=custom',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateFrom?: string;

  @ApiProperty({
    required: false,
    example: '2026-05-31',
    description: 'ISO YYYY-MM-DD — chỉ dùng khi period=custom',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateTo?: string;
}
