import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsHexColor,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  PROMO_HUB_LAYOUTS,
  PROMO_HUB_STATUSES,
  PromoHubLayout,
  PromoHubStatus,
} from '../schemas/promo-hub.schema';
import { SectionInputDto } from './section.dto';

/**
 * BR-PH-02 — slug regex: lowercase alphanumeric + hyphens only,
 * no leading/trailing hyphens, no consecutive hyphens, 3-100 chars.
 */
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class PromoHubSeoInputDto {
  @ApiPropertyOptional({ maxLength: 70 })
  @IsOptional()
  @IsString()
  @MaxLength(70)
  metaTitle?: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  metaDescription?: string;

  @ApiPropertyOptional({ description: 'S3 URL for OpenGraph image' })
  @IsOptional()
  @IsString()
  ogImage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  canonicalUrl?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'JSON-LD structured data',
  })
  @IsOptional()
  @IsObject()
  structuredData?: Record<string, unknown>;
}

export class PromoHubThemeInputDto {
  @ApiPropertyOptional({ default: '#1d4ed8' })
  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @ApiPropertyOptional({ default: '#ea580c' })
  @IsOptional()
  @IsHexColor()
  secondaryColor?: string;

  @ApiPropertyOptional({ default: 'Be Vietnam Pro' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fontFamily?: string;

  @ApiPropertyOptional({ enum: PROMO_HUB_LAYOUTS, default: 'standard' })
  @IsOptional()
  @IsEnum(PROMO_HUB_LAYOUTS)
  layout?: PromoHubLayout;

  @ApiPropertyOptional({
    description:
      'Custom CSS injected into page <style> tag. Sanitized server-side via sanitize-html (strip <script>, javascript: URIs, event handlers).',
    maxLength: 10000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  customCss?: string;
}

export class CreatePromoHubDto {
  @ApiProperty({
    description:
      'URL-friendly slug. Lowercase alphanumeric + hyphens. Public path 5bib.com/hub/<slug>.',
    example: 'utmb-vietnam-2026',
    minLength: 3,
    maxLength: 100,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @Matches(SLUG_REGEX, {
    message:
      'slug phải gồm chữ thường + số + dấu gạch nối (vd "utmb-vietnam-2026"). KHÔNG khoảng trắng, dấu cách, ký tự đặc biệt.',
  })
  slug!: string;

  @ApiProperty({ minLength: 1, maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ enum: PROMO_HUB_STATUSES, default: 'draft' })
  @IsOptional()
  @IsEnum(PROMO_HUB_STATUSES)
  status?: PromoHubStatus;

  @ApiPropertyOptional({ type: [SectionInputDto], default: [] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionInputDto)
  sections?: SectionInputDto[];

  @ApiPropertyOptional({ type: PromoHubSeoInputDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PromoHubSeoInputDto)
  seo?: PromoHubSeoInputDto;

  @ApiPropertyOptional({ type: PromoHubThemeInputDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PromoHubThemeInputDto)
  theme?: PromoHubThemeInputDto;
}
