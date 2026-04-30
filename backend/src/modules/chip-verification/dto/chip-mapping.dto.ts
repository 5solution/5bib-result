import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ListChipMappingsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50, maximum: 200 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number = 50;

  @ApiPropertyOptional({ description: 'Search chip_id or bib_number (prefix)' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class ChipMappingItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  mysql_race_id: number;

  @ApiProperty()
  chip_id: string;

  @ApiProperty()
  bib_number: string;

  @ApiProperty({ enum: ['ACTIVE', 'DISABLED'] })
  status: 'ACTIVE' | 'DISABLED';

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;
}

export class ListChipMappingsResponseDto {
  @ApiProperty({ type: [ChipMappingItemDto] })
  items: ChipMappingItemDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;
}

export class UpdateChipMappingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{2,31}$/, {
    message: 'chip_id must be 4-32 chars alphanumeric/_/- (no leading dash)',
  })
  chip_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,32}$/, {
    message: 'bib_number must be 1-32 alphanumeric/_/-',
  })
  bib_number?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'DISABLED'] })
  @IsOptional()
  @IsEnum(['ACTIVE', 'DISABLED'])
  status?: 'ACTIVE' | 'DISABLED';
}
