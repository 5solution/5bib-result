import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const PACKAGES = ['basic', 'advanced', 'professional', 'unspecified'] as const;
type Package = (typeof PACKAGES)[number];

export class CreateLeadDto {
  @ApiProperty({ example: 'Nguyễn Văn A', maxLength: 100 })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập họ tên' })
  @MaxLength(100)
  full_name: string;

  @ApiProperty({ example: '0909000000', maxLength: 20 })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập số điện thoại' })
  @Matches(/^(0|\+84)[0-9]{8,10}$/, {
    message: 'Số điện thoại không hợp lệ',
  })
  phone: string;

  @ApiProperty({ example: 'CLB Chạy Bộ Hà Nội', maxLength: 200 })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên tổ chức' })
  @MaxLength(200)
  organization: string;

  @ApiProperty({ required: false, example: '500 – 1,000 VĐV' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  athlete_count_range?: string;

  @ApiProperty({ required: false, enum: PACKAGES, default: 'unspecified' })
  @IsOptional()
  @IsEnum(PACKAGES)
  package_interest?: Package;

  @ApiProperty({ required: false, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  /** Honeypot — bots fill this; real users leave it empty. */
  @ApiProperty({ required: false, description: 'Honeypot — leave empty' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  website?: string;
}
