import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsHexColor,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CATEGORY_TYPES } from '../schemas/article-category.schema';

export class CreateArticleCategoryDto {
  @ApiProperty({ description: 'Display name (Vietnamese)', example: 'Đăng ký giải' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @ApiPropertyOptional({
    description: 'URL-safe slug. Auto-generated from name if omitted.',
    example: 'dang-ky-giai',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug chỉ được chứa chữ thường, số, và dấu gạch ngang' })
  @MaxLength(80)
  slug?: string;

  @ApiPropertyOptional({ enum: CATEGORY_TYPES, default: 'both' })
  @IsOptional()
  @IsIn(CATEGORY_TYPES as unknown as string[])
  type?: 'help' | 'news' | 'both';

  @ApiPropertyOptional({ description: 'Emoji or icon name', example: '📖' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  icon?: string;

  @ApiPropertyOptional({ description: 'Hex tint for public hero grid card', example: '#1D49FF' })
  @IsOptional()
  @IsHexColor()
  tint?: string;

  @ApiPropertyOptional({ description: 'Sub-text under the name', example: 'Hướng dẫn từ A-Z' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  description?: string;

  @ApiPropertyOptional({ description: 'Sort order (ascending)', default: 0 })
  @IsOptional()
  @IsInt()
  order?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateArticleCategoryDto extends PartialType(CreateArticleCategoryDto) {}

export class ReorderItemDto {
  @ApiProperty() @IsString() id: string;
  @ApiProperty() @IsInt() order: number;
}

export class ReorderArticleCategoriesDto {
  @ApiProperty({ type: [ReorderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items: ReorderItemDto[];
}

export class ArticleCategoryResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() slug: string;
  @ApiProperty() name: string;
  @ApiProperty({ enum: CATEGORY_TYPES }) type: 'help' | 'news' | 'both';
  @ApiProperty() icon: string;
  @ApiProperty() tint: string;
  @ApiProperty() description: string;
  @ApiProperty() order: number;
  @ApiProperty() isActive: boolean;
  @ApiProperty() articleCount: number;
}
