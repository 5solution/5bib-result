import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const;
export type ShirtSizeEnum = (typeof SHIRT_SIZES)[number];

export class ShirtStockRowInputDto {
  @ApiProperty({ enum: SHIRT_SIZES })
  @IsEnum(SHIRT_SIZES)
  size!: ShirtSizeEnum;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  quantity_planned!: number;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  quantity_ordered!: number;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  quantity_received!: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpsertShirtStockDto {
  @ApiProperty({ type: [ShirtStockRowInputDto] })
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => ShirtStockRowInputDto)
  sizes!: ShirtStockRowInputDto[];
}

export class ShirtAggregateRowDto {
  @ApiProperty({ enum: SHIRT_SIZES }) size!: ShirtSizeEnum;
  @ApiProperty() registered!: number;
  @ApiProperty() planned!: number;
  @ApiProperty() ordered!: number;
  @ApiProperty() received!: number;
  @ApiProperty() surplus!: number;
  @ApiProperty({ required: false, nullable: true })
  notes!: string | null;
}

export class ShirtAggregateDto {
  @ApiProperty({ type: [ShirtAggregateRowDto] })
  by_size!: ShirtAggregateRowDto[];
  @ApiProperty() total_registered!: number;
  @ApiProperty() total_planned!: number;
  @ApiProperty() total_ordered!: number;
  @ApiProperty() total_received!: number;
  @ApiProperty() last_updated!: string;
}
