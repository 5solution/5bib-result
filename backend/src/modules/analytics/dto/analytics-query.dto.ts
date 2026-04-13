import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsNumber,
  IsIn,
  Min,
  Max,
} from 'class-validator';

export class AnalyticsQueryDto {
  @ApiProperty({
    description: 'Month filter in YYYY-MM format (used for overview)',
    example: '2026-03',
    required: false,
  })
  @IsOptional()
  @IsString()
  month?: string;

  @ApiProperty({
    description: 'Start date filter in YYYY-MM-DD format',
    example: '2026-03-01',
    required: false,
  })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiProperty({
    description: 'End date filter in YYYY-MM-DD format',
    example: '2026-03-31',
    required: false,
  })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiProperty({
    description: 'Filter by tenant ID',
    example: 42,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tenantId?: number;

  @ApiProperty({
    description: 'Filter by race ID',
    example: 101,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  raceId?: number;

  @ApiProperty({
    description: 'Filter by race type (e.g. TRAIL_RACE, ROAD_MARATHON)',
    example: 'TRAIL_RACE',
    required: false,
  })
  @IsOptional()
  @IsString()
  raceType?: string;

  @ApiProperty({
    description: 'Filter by race status (e.g. GENERATED_CODE, COMPLETE)',
    example: 'GENERATED_CODE',
    required: false,
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({
    description: 'Sort field (e.g. grossGmv, paidOrders, eventStartDate)',
    example: 'grossGmv',
    required: false,
  })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiProperty({
    description: 'Sort direction',
    example: 'DESC',
    required: false,
    enum: ['ASC', 'DESC'],
  })
  @IsOptional()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  sortOrder?: string;

  @ApiProperty({
    description: 'Page number (1-based)',
    example: 1,
    required: false,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  page?: number = 0;

  @ApiProperty({
    description: 'Items per page (max 100)',
    example: 20,
    required: false,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
