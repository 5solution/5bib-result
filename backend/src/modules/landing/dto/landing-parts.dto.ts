import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { HEX_COLOR_REGEX, SUBDOMAIN_REGEX } from '../landing.constants';

export class AnalyticsInputDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  ga4MeasurementId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  fbPixelId?: string;
}

export class MetaInputDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiPropertyOptional({ enum: ['vi', 'en'] })
  @IsOptional()
  @IsIn(['vi', 'en'])
  lang?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ogImage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  favicon?: string;

  @ApiPropertyOptional({ enum: ['index,follow', 'noindex,nofollow'] })
  @IsOptional()
  @IsString()
  robots?: string;

  @ApiPropertyOptional({ type: AnalyticsInputDto })
  @IsOptional()
  @IsObject()
  analytics?: AnalyticsInputDto;
}

export class ThemeInputDto {
  @ApiPropertyOptional({ description: 'Preset quick-pick (ghi đè main+sec)' })
  @IsOptional()
  @IsString()
  preset?: string;

  /** BR-83-09 — màu chính. */
  @ApiPropertyOptional({ example: '#ea580c', pattern: '^#[0-9a-fA-F]{6}$' })
  @IsOptional()
  @Matches(HEX_COLOR_REGEX, { message: 'Mã màu chính sai (vd #ea580c)' })
  main?: string;

  /** BR-83-09 — màu phụ. */
  @ApiPropertyOptional({ example: '#1d4ed8', pattern: '^#[0-9a-fA-F]{6}$' })
  @IsOptional()
  @Matches(HEX_COLOR_REGEX, { message: 'Mã màu phụ sai (vd #1d4ed8)' })
  sec?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  fontHeading?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  fontBody?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 0.8 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.8)
  heroOverlay?: number;
}

export class DomainInputDto {
  /** BR-83-16 — uniqueness + reserved checked at service layer. */
  @ApiPropertyOptional({ pattern: '^[a-z0-9][a-z0-9-]{1,40}[a-z0-9]$' })
  @IsOptional()
  @Matches(SUBDOMAIN_REGEX, {
    message:
      'Subdomain phải gồm chữ thường + số + gạch nối, 3-42 ký tự, không bắt đầu/kết thúc bằng "-"',
  })
  subdomain?: string;
}
