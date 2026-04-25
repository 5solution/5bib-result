import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  IsISO8601,
  IsUrl,
  IsArray,
  Matches,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateSponsoredItemDto {
  @ApiProperty({ example: 'vietnam-mountain-marathon-2026' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  race_slug: string;

  @ApiProperty({ example: 'Vietnam Mountain Marathon 2026' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  event_name: string;

  @ApiPropertyOptional({ example: 'ULTRA TRAIL · UTMB 4★', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  event_type?: string | null;

  @ApiProperty({ example: '2026-09-12T00:00:00.000Z' })
  @IsISO8601()
  event_date_start: string;

  @ApiPropertyOptional({ example: '2026-09-14T00:00:00.000Z', nullable: true })
  @IsOptional()
  @IsISO8601()
  event_date_end?: string | null;

  @ApiProperty({ example: 'Mù Cang Chải, Yên Bái' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  event_location: string;

  @ApiProperty({ example: 'https://s3.amazonaws.com/bucket/cover.jpg' })
  @IsUrl()
  cover_image_url: string;

  @ApiProperty({ example: 550000, description: 'Price in VNĐ (integer)' })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  price_from: number;

  @ApiPropertyOptional({ default: 'Đăng ký →' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  cta_text?: string;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Absolute (https://…) or relative (/races/{slug}) URL. null → auto-build /races/{race_slug}',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(/^(https?:\/\/.+|\/[^\s]*)$/, {
    message: 'cta_url must be an absolute URL (http/https) or a relative path starting with "/"',
  })
  cta_url?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'GIẢM 15%' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  promo_label?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2026-05-31T23:59:59.000Z' })
  @IsOptional()
  @IsISO8601()
  promo_label_expires_at?: string | null;

  @ApiPropertyOptional({ type: [String], example: ['UTMB', 'Trail', 'VN Exclusive'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  badge_labels?: string[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  show_countdown?: boolean;

  @ApiPropertyOptional({ nullable: true, example: '2026-09-12T05:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  countdown_target_at?: string | null;

  @ApiPropertyOptional({ description: 'Auto-set to max(item_order) + 1 if omitted' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  item_order?: number;
}
