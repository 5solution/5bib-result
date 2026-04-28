import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ARTICLE_PRODUCTS, ARTICLE_TYPES } from '../schemas/article.schema';

export class CreateArticleDto {
  @ApiProperty({ description: 'Article title', example: 'Hướng dẫn đăng ký giải chạy 5BIB' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({
    description: 'URL-safe slug. Auto-generated from title if omitted. Pattern: ^[a-z0-9-]+$',
    example: 'huong-dan-dang-ky-giai-chay',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug chỉ được chứa chữ thường, số, và dấu gạch ngang' })
  @MaxLength(120)
  slug?: string;

  @ApiProperty({ enum: ARTICLE_TYPES, description: 'Article type' })
  @IsIn(ARTICLE_TYPES as unknown as string[])
  type: 'news' | 'help';

  @ApiProperty({
    description: 'Product tags (one article can target multiple)',
    type: [String],
    enum: ARTICLE_PRODUCTS,
    example: ['5bib', '5sport'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsIn(ARTICLE_PRODUCTS as unknown as string[], { each: true })
  products: string[];

  @ApiPropertyOptional({ description: 'Free-text category', example: 'Đăng ký giải' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @ApiPropertyOptional({ description: 'HTML content (sanitized server-side)' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'Short excerpt for listings + social', example: 'Cách đăng ký giải chạy nhanh nhất' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  excerpt?: string;

  @ApiPropertyOptional({ description: 'Cover image URL (1200×630 OG image)' })
  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @ApiPropertyOptional({ description: 'SEO title (max 60 chars)', maxLength: 60 })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  seoTitle?: string;

  @ApiPropertyOptional({ description: 'SEO description (max 160 chars)', maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  seoDescription?: string;

  @ApiPropertyOptional({ description: 'Featured flag — show in hero section' })
  @IsOptional()
  @IsBoolean()
  featured?: boolean;
}
