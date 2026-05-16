import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PnLDashboardFilterDto } from './dashboard-filter.dto';

/**
 * FEATURE-038 — paginated contracts list filter.
 *
 * Extends `PnLDashboardFilterDto` (inherits `period` / `groupBy` / `dateFrom`
 * / `dateTo`) → adds list-specific fields:
 *   - `page` / `limit` — pagination (BR-38-06)
 *   - `sortBy` / `sortDir` — sort (BR-38-04)
 *   - `q` — combined search across contractNumber + entityName + raceName
 *     (BR-38-05) with regex escape ReDoS defense
 *
 * Status whitelist (BR-38-01) + period filter (BR-38-02) inherited from
 * `PnLDashboardFilterDto` resolved by `getContractsList()` reusing
 * `getDashboardData()` compute path.
 */
export const CONTRACTS_LIST_SORT_BY = [
  'anchorMonth',
  'profit',
  'revenue',
  'margin',
  'contractNumber',
] as const;
export type ContractsListSortBy = (typeof CONTRACTS_LIST_SORT_BY)[number];

export const SORT_DIRS = ['asc', 'desc'] as const;
export type SortDir = (typeof SORT_DIRS)[number];

export const CONTRACTS_LIST_PAGE_SIZES = [20, 50, 100] as const;

export class PnLContractsListFilterDto extends PnLDashboardFilterDto {
  @ApiPropertyOptional({
    description: 'Page number (1-indexed)',
    minimum: 1,
    maximum: 9999,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Page phải là số nguyên' })
  @Min(1, { message: 'Page tối thiểu là 1' })
  @Max(9999, { message: 'Page tối đa là 9999' })
  page?: number;

  @ApiPropertyOptional({
    description: 'Items per page',
    enum: [20, 50, 100],
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit phải là số nguyên' })
  @IsIn([20, 50, 100], { message: 'Limit không hợp lệ' })
  limit?: number;

  @ApiPropertyOptional({
    description: 'Sort column',
    enum: CONTRACTS_LIST_SORT_BY,
    default: 'anchorMonth',
  })
  @IsOptional()
  @IsEnum(CONTRACTS_LIST_SORT_BY, { message: 'SortBy không hợp lệ' })
  sortBy?: ContractsListSortBy;

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: SORT_DIRS,
    default: 'desc',
  })
  @IsOptional()
  @IsEnum(SORT_DIRS, { message: 'SortDir không hợp lệ' })
  sortDir?: SortDir;

  @ApiPropertyOptional({
    description:
      'Search keyword — match contractNumber, partnerName, raceName (case-insensitive, regex-escaped)',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Từ khoá tối đa 100 ký tự' })
  q?: string;
}
