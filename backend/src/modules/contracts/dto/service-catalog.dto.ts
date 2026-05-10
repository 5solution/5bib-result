import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

const CATEGORIES = ['TIMING', 'RACEKIT', 'OPERATIONS', 'GENERAL'];

export class CreateServiceCatalogDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty({ enum: CATEGORIES }) @IsIn(CATEGORIES) category: string;
  @ApiPropertyOptional() @IsOptional() @IsString() unit?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) referencePrice?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() sortOrder?: number;
}

export class UpdateServiceCatalogDto extends PartialType(CreateServiceCatalogDto) {}

export class ServiceCatalogResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() category: string;
  @ApiPropertyOptional() unit?: string;
  @ApiProperty() referencePrice: number;
  @ApiPropertyOptional() description?: string;
  @ApiProperty() sortOrder: number;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
