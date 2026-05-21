/**
 * FEATURE-046 — Recap Insight DTOs (public/admin/upsert).
 * BR-46-13/15..18, Manager Plan Adjustment #2.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class RecapInsightPublicDto {
  @ApiPropertyOptional() insightMarkdown?: string | null;
  @ApiPropertyOptional() insightHtml?: string | null;
  @ApiPropertyOptional() publishedAt?: string | null;
  @ApiPropertyOptional() updatedAt?: string | null;
  @ApiPropertyOptional() authorName?: string | null;
}

export class RecapInsightAdminDto {
  @ApiProperty() id!: string;
  @ApiProperty() raceId!: string;
  @ApiPropertyOptional() courseId?: string | null;
  @ApiProperty() insightMarkdown!: string;
  @ApiProperty() insightHtml!: string;
  @ApiProperty({ enum: ['draft', 'published'] })
  status!: 'draft' | 'published';
  @ApiPropertyOptional() publishedAt?: string | null;
  @ApiProperty() updatedAt!: string;
  @ApiProperty() authorName!: string;
  @ApiProperty() version!: number;
}

export class UpsertRecapInsightDto {
  @ApiProperty({ minLength: 1, maxLength: 2000 })
  @IsString()
  @IsNotEmpty({ message: 'Insight không được rỗng' })
  @MaxLength(2000, { message: 'Vượt quá 2000 ký tự' })
  insightMarkdown!: string;

  @ApiProperty()
  @IsBoolean()
  publish!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}
