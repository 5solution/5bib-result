import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsBoolean,
  IsIn,
  IsDateString,
} from 'class-validator';

export class CreateMerchantDto {
  @ApiProperty({ description: 'Tên công ty' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Mã số thuế / mã DN (field vat)' })
  @IsOptional()
  @IsString()
  tax_code?: string; // maps to tenant.vat

  // ── Metadata fields ─────────────────────────────────────────
  @ApiProperty({ description: 'Họ tên người liên hệ' })
  @IsString()
  contact_name: string;

  @ApiProperty({ description: 'Email liên hệ' })
  @IsEmail()
  contact_email: string;

  @ApiProperty({ description: 'Số điện thoại liên hệ' })
  @IsString()
  contact_phone: string;

  @ApiPropertyOptional({ description: 'Địa chỉ' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Website' })
  @IsOptional()
  @IsString()
  website?: string;

  // ── Fee fields ───────────────────────────────────────────────
  @ApiProperty({ description: 'Tỉ lệ phí dịch vụ (%), VD: 6.5', minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  service_fee_rate: number;

  @ApiPropertyOptional({ description: 'Phí vé thủ công VNĐ/vé, default 5000', default: 5000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  manual_fee_per_ticket?: number;

  @ApiPropertyOptional({ description: 'VAT trên phí dịch vụ (%), thường 0 hoặc 8', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  fee_vat_rate?: number;

  @ApiPropertyOptional({ description: 'Ngày áp dụng phí (ISO date)' })
  @IsOptional()
  @IsDateString()
  fee_effective_date?: string;

  @ApiPropertyOptional({ description: 'Ghi chú về phí' })
  @IsOptional()
  @IsString()
  fee_note?: string;

  // ── Status ───────────────────────────────────────────────────
  @ApiPropertyOptional({ description: 'Duyệt ngay khi tạo', default: false })
  @IsOptional()
  @IsBoolean()
  is_approved?: boolean;

  @ApiPropertyOptional({
    description: 'Trạng thái hợp đồng',
    enum: ['pending', 'active'],
    default: 'pending',
  })
  @IsOptional()
  @IsIn(['pending', 'active'])
  contract_status?: string;
}
