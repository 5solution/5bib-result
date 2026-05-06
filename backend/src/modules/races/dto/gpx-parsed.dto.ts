import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * GPX track bounding box (WGS84). All coordinates are decimal degrees.
 * Used by Leaflet `fitBounds` on both admin preview and frontend public map.
 */
export class GpxBoundsDto {
  @ApiProperty({ description: 'Northernmost latitude', example: 21.0285 })
  @IsNumber()
  north!: number;

  @ApiProperty({ description: 'Southernmost latitude', example: 20.9612 })
  @IsNumber()
  south!: number;

  @ApiProperty({ description: 'Easternmost longitude', example: 105.8542 })
  @IsNumber()
  east!: number;

  @ApiProperty({ description: 'Westernmost longitude', example: 105.7842 })
  @IsNumber()
  west!: number;
}

/**
 * Server-side parsed GPX/KML metadata, persisted alongside the course.
 * Distance/elevation computed via @turf + custom <ele> noise filter.
 *
 * Elevation fields are nullable when the source file has no `<ele>` tags
 * (BR-CM-06) — frontend renders "Không có dữ liệu độ cao" placeholder.
 */
export class GpxParsedDto {
  @ApiProperty({ description: 'Original track point count', example: 12450 })
  @IsNumber()
  trackPoints!: number;

  @ApiProperty({
    description: 'Simplified point count after Douglas-Peucker (≤ 5000)',
    example: 1820,
  })
  @IsNumber()
  simplifiedPoints!: number;

  @ApiProperty({
    description: 'Total course distance in kilometres (great-circle)',
    example: 42.195,
  })
  @IsNumber()
  totalDistanceKm!: number;

  @ApiPropertyOptional({
    description: 'Total elevation gain in metres (positive deltas, noise-filtered). Null when no <ele> tag.',
    nullable: true,
    example: 850,
  })
  @IsOptional()
  @IsNumber()
  elevationGain!: number | null;

  @ApiPropertyOptional({
    description: 'Total elevation loss in metres (absolute negative deltas). Null when no <ele> tag.',
    nullable: true,
    example: 850,
  })
  @IsOptional()
  @IsNumber()
  elevationLoss!: number | null;

  @ApiPropertyOptional({
    description: 'Highest point above sea level (metres). Null when no <ele> tag.',
    nullable: true,
    example: 1240,
  })
  @IsOptional()
  @IsNumber()
  maxElevation!: number | null;

  @ApiPropertyOptional({
    description: 'Lowest point above sea level (metres). Null when no <ele> tag.',
    nullable: true,
    example: 850,
  })
  @IsOptional()
  @IsNumber()
  minElevation!: number | null;

  @ApiProperty({ type: GpxBoundsDto, description: 'Track bounding box (WGS84)' })
  @ValidateNested()
  @Type(() => GpxBoundsDto)
  bounds!: GpxBoundsDto;
}
