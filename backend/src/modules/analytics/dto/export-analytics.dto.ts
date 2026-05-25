import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { AnalyticsQueryDto } from './analytics-query.dto';

/**
 * F-062 Wave 2C-3 NEW DTO — Export Analytics query (BR-SA-10 v3).
 *
 * Extends AnalyticsQueryDto thêm format + reportType per spec line 301.
 * Returns file download stream — Content-Type per format.
 */
export class ExportAnalyticsQueryDto extends AnalyticsQueryDto {
  @ApiPropertyOptional({
    description: 'File format',
    enum: ['csv', 'xlsx'],
    default: 'xlsx',
  })
  @IsOptional()
  @IsString()
  @IsIn(['csv', 'xlsx'])
  format?: 'csv' | 'xlsx';

  @ApiPropertyOptional({
    description: 'Report type',
    enum: ['overview', 'revenue', 'races', 'merchants', 'funnel', 'runners'],
    default: 'overview',
  })
  @IsOptional()
  @IsString()
  @IsIn(['overview', 'revenue', 'races', 'merchants', 'funnel', 'runners'])
  reportType?:
    | 'overview'
    | 'revenue'
    | 'races'
    | 'merchants'
    | 'funnel'
    | 'runners';
}
