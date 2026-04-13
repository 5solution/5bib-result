import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class ExportZipByIdsDto {
  @ApiProperty({ description: 'Array of reconciliation MongoDB IDs', type: [String] })
  @IsArray()
  @IsString({ each: true })
  ids: string[];

  @ApiProperty({ required: false, description: 'Human-readable label for the ZIP' })
  @IsOptional()
  @IsString()
  label?: string;
}

export class ExportZipByPeriodDto {
  @ApiProperty({ description: 'Period start date YYYY-MM-DD', example: '2026-04-01' })
  @IsString()
  periodStart: string;

  @ApiProperty({ description: 'Period end date YYYY-MM-DD', example: '2026-04-30' })
  @IsString()
  periodEnd: string;

  @ApiProperty({ required: false, description: 'Human-readable label for the ZIP' })
  @IsOptional()
  @IsString()
  label?: string;
}
