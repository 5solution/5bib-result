import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class PreviewReconciliationDto {
  @ApiProperty({ description: 'MySQL tenant.id', example: 1 })
  @IsNumber()
  tenant_id: number;

  @ApiProperty({ description: 'MySQL race_course.race_id', example: 42 })
  @IsNumber()
  mysql_race_id: number;

  @ApiProperty({ description: 'Race title for display', example: 'VPBank Hanoi Marathon 2025' })
  @IsString()
  race_title: string;

  @ApiProperty({ description: 'Period start date YYYY-MM-DD', example: '2025-01-01' })
  @IsDateString()
  period_start: string;

  @ApiProperty({ description: 'Period end date YYYY-MM-DD', example: '2025-03-31' })
  @IsDateString()
  period_end: string;

  @ApiPropertyOptional({ description: 'Override fee rate % (e.g. 6.5 for 6.5%)', example: 6.5 })
  @IsOptional()
  @IsNumber()
  fee_rate_applied?: number;

  @ApiPropertyOptional({ description: 'Override manual fee per ticket', example: 5000 })
  @IsOptional()
  @IsNumber()
  manual_fee_per_ticket?: number;

  @ApiPropertyOptional({ description: 'Override VAT rate % on fees', example: 8 })
  @IsOptional()
  @IsNumber()
  fee_vat_rate?: number;
}
