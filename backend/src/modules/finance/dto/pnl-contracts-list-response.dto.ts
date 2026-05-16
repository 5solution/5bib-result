import { ApiProperty } from '@nestjs/swagger';
import {
  DashboardContractItemDto,
  DashboardTotalsDto,
} from './dashboard-response.dto';

/**
 * FEATURE-038 — paginated contracts list response.
 *
 * Reuses `DashboardContractItemDto` (per-row shape) + `DashboardTotalsDto`
 * (aggregate totals) from F-028 Phase 2 → KHÔNG duplicate types. `totals`
 * aggregates across ALL filtered contracts (NOT just current page) để footer
 * summary trên admin UI hiển thị đúng tổng deals matching filter.
 */
export class PnLContractsListResponseDto {
  @ApiProperty({ description: 'Resolved period (echoes filter input)' })
  period!: string;

  @ApiProperty({ description: 'Resolved ISO date period start YYYY-MM-DD' })
  dateFrom!: string;

  @ApiProperty({ description: 'Resolved ISO date period end YYYY-MM-DD' })
  dateTo!: string;

  @ApiProperty({ description: 'Generation timestamp ISO 8601' })
  generatedAt!: string;

  @ApiProperty({
    type: [DashboardContractItemDto],
    description: 'Paginated list — current page only',
  })
  items!: DashboardContractItemDto[];

  @ApiProperty({
    description: 'Total contracts matching filter (before pagination)',
  })
  total!: number;

  @ApiProperty({ description: 'Current page (1-indexed)' })
  page!: number;

  @ApiProperty({ description: 'Items per page' })
  limit!: number;

  @ApiProperty({ description: 'Total pages = ceil(total / limit)' })
  totalPages!: number;

  @ApiProperty({
    type: DashboardTotalsDto,
    description:
      'Aggregate totals across ALL matching contracts (NOT just current page) — for footer summary',
  })
  totals!: DashboardTotalsDto;
}
