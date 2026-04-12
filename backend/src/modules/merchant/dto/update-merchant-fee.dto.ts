import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsDateString,
  MinLength,
} from 'class-validator';

/**
 * Dùng để cập nhật bất kỳ hoặc tất cả fee fields.
 * Ít nhất một trong 3 fee fields phải được cung cấp.
 * Ghi chú (note) bắt buộc.
 */
export class UpdateMerchantFeeDto {
  @ApiPropertyOptional({ description: 'Tỉ lệ phí dịch vụ mới (%)', minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  service_fee_rate?: number;

  @ApiPropertyOptional({ description: 'Phí vé thủ công mới (VNĐ/vé)', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  manual_fee_per_ticket?: number;

  @ApiPropertyOptional({ description: 'VAT trên phí mới (%)', minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  fee_vat_rate?: number;

  @ApiPropertyOptional({ description: 'Ngày áp dụng phí mới' })
  @IsOptional()
  @IsDateString()
  fee_effective_date?: string;

  @ApiProperty({ description: 'Lý do thay đổi phí — bắt buộc', minLength: 3 })
  @IsString()
  @MinLength(3)
  note: string;
}
