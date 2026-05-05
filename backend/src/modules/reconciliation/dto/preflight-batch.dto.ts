import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { IsPeriodString } from '../../../common/validators/period.validator';

export class PreflightBatchDto {
  @ApiProperty({ example: '2026-04', description: 'Period as YYYY-MM (single month)' })
  @IsPeriodString()
  period: string;

  @ApiProperty({ description: 'Array of merchant IDs or "all"' })
  @IsOptional()
  merchant_ids: number[] | 'all';
}
