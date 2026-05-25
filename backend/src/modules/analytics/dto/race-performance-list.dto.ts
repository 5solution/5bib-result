import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AnalyticsQueryDto } from './analytics-query.dto';

/**
 * F-062 Wave 2C-1 NEW DTO — Race Performance List query (BR-SA-21c v3).
 *
 * Extends AnalyticsQueryDto (from/to/month/tenantId) thêm filter + pagination:
 *   - raceType — filter theo race type machine key
 *   - sortBy / sortOrder — sort field + direction
 *   - page / limit — pagination (default 12, max 50 per spec line 551)
 */
export class RacePerformanceListQueryDto extends AnalyticsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter theo race type',
    enum: ['ROAD_MARATHON', 'ROAD_HALF_MARATHON', 'ULTRA_TRAIL_RACE', 'TRAIL_RACE'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['ROAD_MARATHON', 'ROAD_HALF_MARATHON', 'ULTRA_TRAIL_RACE', 'TRAIL_RACE'])
  raceType?:
    | 'ROAD_MARATHON'
    | 'ROAD_HALF_MARATHON'
    | 'ULTRA_TRAIL_RACE'
    | 'TRAIL_RACE';

  @ApiPropertyOptional({
    description: 'Sort field (default gmv)',
    enum: ['gmv', 'orders', 'fee', 'avgPerOrder', 'voidedPct'],
    default: 'gmv',
  })
  @IsOptional()
  @IsString()
  @IsIn(['gmv', 'orders', 'fee', 'avgPerOrder', 'voidedPct'])
  sortBy?: 'gmv' | 'orders' | 'fee' | 'avgPerOrder' | 'voidedPct';

  @ApiPropertyOptional({
    description: 'Sort direction (default desc)',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({
    description: 'Page number (1-indexed, default 1)',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Page size (default 12, max 50)',
    minimum: 1,
    maximum: 50,
    default: 12,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

/**
 * F-062 Wave 2C-1 NEW DTO — Race performance row (BR-SA-21c v3).
 *
 * 10 fields per spec line 553. Phí 5BIB qua FeeService.computeFeeForOrdersAggregate
 * (BR-SA mandate). voidedPct = voided / (paid + voided) × 100.
 */
export class RacePerformanceItemDto {
  @ApiProperty({ description: 'Race ID', example: 1042 })
  raceId!: number;

  @ApiProperty({
    description: 'Race title',
    example: 'VnExpress Marathon 2026',
  })
  raceName!: string;

  @ApiProperty({
    description: 'Merchant name (tenant.name)',
    example: 'Sun Sports Vietnam',
  })
  merchant!: string;

  @ApiProperty({
    description: 'Race type machine key',
    enum: [
      'ROAD_MARATHON',
      'ROAD_HALF_MARATHON',
      'ULTRA_TRAIL_RACE',
      'TRAIL_RACE',
      'OTHER',
    ],
    example: 'ROAD_MARATHON',
  })
  raceType!:
    | 'ROAD_MARATHON'
    | 'ROAD_HALF_MARATHON'
    | 'ULTRA_TRAIL_RACE'
    | 'TRAIL_RACE'
    | 'OTHER';

  @ApiProperty({
    description: 'Race date proxy (latest paid order date) ISO YYYY-MM-DD',
    example: '2026-04-15',
    nullable: true,
  })
  date!: string | null;

  @ApiProperty({ description: 'Số đơn paid (exclude MANUAL)', example: 2845 })
  orders!: number;

  @ApiProperty({
    description: 'GMV paid (exclude MANUAL)',
    example: 1500000000,
  })
  gmv!: number;

  @ApiProperty({
    description: 'Platform fee via FeeService.computeFeeForOrdersAggregate()',
    example: 105000000,
  })
  platformFee!: number;

  @ApiProperty({
    description: 'Average GMV per order (gmv / orders)',
    example: 527241,
  })
  avgPerOrder!: number;

  @ApiProperty({
    description: 'Voided rate % = voided / (paid + voided) × 100',
    example: 4.5,
  })
  voidedPct!: number;
}

/**
 * F-062 Wave 2C-1 NEW response wrapper — paginated list (BR-SA-21c v3).
 */
export class RacePerformanceListResponseDto {
  @ApiProperty({
    type: RacePerformanceItemDto,
    isArray: true,
    description: 'Race rows for current page',
  })
  data!: RacePerformanceItemDto[];

  @ApiProperty({
    description: 'Total rows across all pages (after filters)',
    example: 195,
  })
  total!: number;

  @ApiProperty({ description: 'Current page (1-indexed)', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Page size', example: 12 })
  limit!: number;

  @ApiProperty({
    description: 'ceil(total / limit)',
    example: 17,
  })
  totalPages!: number;
}
