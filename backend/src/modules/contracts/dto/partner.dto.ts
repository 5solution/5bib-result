import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreatePartnerDto {
  @ApiProperty({
    description: 'Tên pháp nhân đầy đủ',
    example: 'CÔNG TY CỔ PHẦN TÂM AN MEDIA',
    maxLength: 255,
  })
  @IsString()
  @MinLength(1, { message: 'Tên đối tác là bắt buộc' })
  @MaxLength(255, { message: 'Tên đối tác tối đa 255 ký tự' })
  entityName: string;

  /**
   * FEATURE-066 BR-66-11: shortName dùng cho token CLIENT trong số HĐ.
   * Format: A-Z 0-9, tối đa 16 ký tự. Để trống → fallback stripCompanyPrefix(entityName).
   */
  @ApiPropertyOptional({
    description:
      'Tên viết tắt dùng cho số HĐ (uppercase, A-Z 0-9). Để trống → tự sinh từ entityName bỏ prefix pháp nhân.',
    example: 'TAM',
    maxLength: 16,
    pattern: '^[A-Z0-9]+$',
  })
  @IsOptional()
  @IsString()
  @MaxLength(16, { message: 'Tên viết tắt tối đa 16 ký tự' })
  @Matches(/^[A-Z0-9]+$/, {
    message: 'Tên viết tắt phải in hoa và chỉ gồm A-Z 0-9',
  })
  shortName?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() taxId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() representative?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() position?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bankAccount?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bankName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  // L-02 QC fix: enforce email format (was @IsString)
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class UpdatePartnerDto extends PartialType(CreatePartnerDto) {}

export class PartnerResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() entityName: string;
  @ApiPropertyOptional() shortName?: string;
  @ApiPropertyOptional() taxId?: string;
  @ApiPropertyOptional() address?: string;
  @ApiPropertyOptional() representative?: string;
  @ApiPropertyOptional() position?: string;
  @ApiPropertyOptional() bankAccount?: string;
  @ApiPropertyOptional() bankName?: string;
  @ApiPropertyOptional() phone?: string;
  @ApiPropertyOptional() email?: string;
  @ApiPropertyOptional() notes?: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
