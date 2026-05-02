import { IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AnalyticsQueryDto {
  @ApiPropertyOptional({
    example: '2026-04-01',
    description: 'Start date (YYYY-MM-DD). Defaults to 30 days ago.',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-04-30',
    description: 'End date (YYYY-MM-DD). Defaults to today.',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}
