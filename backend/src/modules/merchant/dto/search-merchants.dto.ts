import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchMerchantsDto {
  @ApiPropertyOptional({ description: 'Tìm theo tên, email, mã số thuế' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: ['all', 'approved', 'pending'], default: 'all' })
  @IsOptional()
  @IsIn(['all', 'approved', 'pending'])
  approval?: string;

  @ApiPropertyOptional({ enum: ['all', 'pending', 'active', 'suspended', 'terminated'] })
  @IsOptional()
  @IsIn(['all', 'pending', 'active', 'suspended', 'terminated'])
  contract_status?: string;

  @ApiPropertyOptional({ enum: ['all', 'has_fee', 'no_fee'], default: 'all' })
  @IsOptional()
  @IsIn(['all', 'has_fee', 'no_fee'])
  fee_status?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  page?: number = 0;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  pageSize?: number = 20;
}
