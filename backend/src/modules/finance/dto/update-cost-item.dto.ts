import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { COST_CATEGORIES, CostCategory } from '../schemas/cost-item.schema';

/**
 * F-028 BR-PNL-11 — edit anytime kể cả COMPLETED. Tất cả field optional
 * (PATCH semantics) — admin chỉ gửi field muốn update.
 */
export class UpdateCostItemDto {
  @ApiProperty({ required: false, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ required: false, enum: COST_CATEGORIES })
  @IsOptional()
  @IsEnum(COST_CATEGORIES)
  category?: CostCategory;

  @ApiProperty({ required: false, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiProperty({ required: false, maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiProperty({ required: false, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  incurredDate?: string;
}
