import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SearchRacesDto {
  @ApiPropertyOptional({
    description: 'Search by race title',
    example: 'Marathon',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Filter by status',
    example: 'COMPLETE',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter by province',
    example: 'Tp Hải Phòng',
  })
  @IsOptional()
  @IsString()
  province?: string;

  @ApiPropertyOptional({
    description: 'Filter by season',
    example: '2026',
  })
  @IsOptional()
  @IsString()
  season?: string;

  @ApiPropertyOptional({
    description: 'Filter by race type',
    example: 'ROAD_HALF_MARATHON',
  })
  @IsOptional()
  @IsString()
  race_type?: string;

  @ApiPropertyOptional({
    description: 'Page number (0-indexed)',
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  page?: number = 0;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    default: 10,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 10;
}
