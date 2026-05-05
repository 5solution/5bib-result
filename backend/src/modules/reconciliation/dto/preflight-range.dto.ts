import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';
import {
  IsPeriodBoundaryDate,
  IsValidPeriodRange,
} from '../../../common/validators/period.validator';

export class PreflightRangeDto {
  @ApiProperty({ description: 'MySQL tenant.id', example: 47 })
  @IsNumber()
  tenant_id: number;

  @ApiProperty({ description: 'MySQL race_course.race_id', example: 148 })
  @IsNumber()
  mysql_race_id: number;

  @ApiProperty({
    description: 'Period start YYYY-MM-DD (must be the 1st of a month)',
    example: '2026-01-01',
  })
  @IsPeriodBoundaryDate('start')
  period_start: string;

  @ApiProperty({
    description: 'Period end YYYY-MM-DD (must be the last day of a month, span ≤ 12 months)',
    example: '2026-03-31',
  })
  @IsPeriodBoundaryDate('end')
  @IsValidPeriodRange()
  period_end: string;
}

export class RangeOverlapWarningDto {
  @ApiProperty({ description: 'Existing reconciliation _id (Mongo ObjectId string)' })
  existing_id: string;

  @ApiProperty({ description: 'Existing period_start YYYY-MM-DD' })
  existing_period_start: string;

  @ApiProperty({ description: 'Existing period_end YYYY-MM-DD' })
  existing_period_end: string;

  @ApiProperty({ description: 'Existing reconciliation status' })
  existing_status: string;
}
