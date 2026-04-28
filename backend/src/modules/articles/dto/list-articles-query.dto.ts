import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ARTICLE_PRODUCTS, ARTICLE_STATUSES, ARTICLE_TYPES } from '../schemas/article.schema';

export class ListArticlesPublicQueryDto {
  @ApiPropertyOptional({ enum: ARTICLE_TYPES })
  @IsOptional()
  @IsIn(ARTICLE_TYPES as unknown as string[])
  type?: 'news' | 'help';

  @ApiPropertyOptional({ enum: ARTICLE_PRODUCTS })
  @IsOptional()
  @IsIn(ARTICLE_PRODUCTS as unknown as string[])
  product?: string;

  @ApiPropertyOptional({ description: 'Free-text category filter' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Page number (1-indexed)', default: 1 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Page size (max 50)', default: 12 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class LatestArticlesQueryDto {
  @ApiPropertyOptional({ enum: ARTICLE_TYPES })
  @IsOptional()
  @IsIn(ARTICLE_TYPES as unknown as string[])
  type?: 'news' | 'help';

  @ApiPropertyOptional({ enum: ARTICLE_PRODUCTS })
  @IsOptional()
  @IsIn(ARTICLE_PRODUCTS as unknown as string[])
  product?: string;

  @ApiPropertyOptional({ description: 'Limit (max 20)', default: 10 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

export class ListArticlesAdminQueryDto extends ListArticlesPublicQueryDto {
  @ApiPropertyOptional({ enum: [...ARTICLE_STATUSES, 'all'], default: 'all' })
  @IsOptional()
  @IsIn([...ARTICLE_STATUSES, 'all'] as unknown as string[])
  status?: 'draft' | 'published' | 'all';

  @ApiPropertyOptional({ description: 'Search by title (case-insensitive)' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Include soft-deleted articles', default: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeDeleted?: boolean;
}
