import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateMerchantCompanyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  legal_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tax_code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  business_address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  representative_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  representative_title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bank_account?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bank_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bank_branch?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  admin_note?: string;
}
