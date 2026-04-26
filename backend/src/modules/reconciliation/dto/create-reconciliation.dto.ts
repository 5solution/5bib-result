import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsDateString,
} from 'class-validator';
import { PreviewReconciliationDto } from './preview-reconciliation.dto';

export class CreateReconciliationDto extends PreviewReconciliationDto {
  @ApiPropertyOptional({ description: 'Fee rate % (null = no fee)', example: 3.5, nullable: true })
  @IsOptional()
  @IsNumber()
  fee_rate_applied: number | null;

  @ApiProperty({ description: 'Manual fee per ticket in VND', example: 5000 })
  @IsNumber()
  manual_fee_per_ticket: number;

  @ApiProperty({ description: 'VAT on fee %', example: 0 })
  @IsNumber()
  fee_vat_rate: number;

  @ApiPropertyOptional({ description: 'Manual payout adjustment in VND', example: 0 })
  @IsOptional()
  @IsNumber()
  manual_adjustment: number;

  @ApiPropertyOptional({ description: 'Note for adjustment', nullable: true })
  @IsOptional()
  @IsString()
  adjustment_note: string | null;

  @ApiPropertyOptional({ description: 'Signed date for DOCX display YYYY-MM-DD', nullable: true })
  @IsOptional()
  @IsDateString()
  signed_date_str: string | null;

  @ApiPropertyOptional({ description: 'Generate XLSX file', default: true })
  @IsOptional()
  @IsBoolean()
  generate_xlsx: boolean;

  @ApiPropertyOptional({ description: 'Generate DOCX file', default: true })
  @IsOptional()
  @IsBoolean()
  generate_docx: boolean;

  @ApiPropertyOptional({
    description: 'Admin user id — Mongo ObjectId string (set from JWT in controller)',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  created_by: string | null;
}
