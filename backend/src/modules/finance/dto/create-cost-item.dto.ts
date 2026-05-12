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
 * F-028 BR-PNL-03 — payload tạo cost item. Validation strict tránh garbage in.
 */
export class CreateCostItemDto {
  @ApiProperty({ example: 'Vật tư biển báo race 30/4', maxLength: 500 })
  @IsString()
  @MaxLength(500)
  description!: string;

  @ApiProperty({ enum: COST_CATEGORIES, example: 'MATERIAL' })
  @IsEnum(COST_CATEGORIES)
  category!: CostCategory;

  @ApiProperty({
    example: 15_000_000,
    description: 'VND, include VAT (BR-PNL-02). Min 0, max 10^12.',
  })
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiProperty({ required: false, maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiProperty({
    required: false,
    example: '15/05/2026',
    description: 'Free-format theo precedent F-024 raceDate',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  incurredDate?: string;
}
