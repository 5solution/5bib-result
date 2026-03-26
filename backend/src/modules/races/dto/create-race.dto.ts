import {
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  Min,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRaceDto {
  @ApiProperty({ description: 'Race title', example: 'Vietnam Mountain Marathon 2026' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'URL-friendly slug', example: 'vietnam-mountain-marathon-2026' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({
    description: 'Race status',
    enum: ['pre_race', 'live', 'ended'],
    default: 'pre_race',
  })
  @IsOptional()
  @IsIn(['pre_race', 'live', 'ended'])
  status?: string;

  @ApiPropertyOptional({ description: 'Race type', example: 'running' })
  @IsOptional()
  @IsString()
  raceType?: string;

  @ApiPropertyOptional({ description: 'Province', example: 'Lào Cai' })
  @IsOptional()
  @IsString()
  province?: string;

  @ApiPropertyOptional({ description: 'Start date (ISO)', example: '2026-04-01T06:00:00Z' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO)', example: '2026-04-02T18:00:00Z' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Race location', example: 'Sa Pa, Lào Cai' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'Race organizer', example: 'Topas' })
  @IsOptional()
  @IsString()
  organizer?: string;

  @ApiPropertyOptional({ description: 'Image URL' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Logo URL' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Brand color hex', example: '#FF5722' })
  @IsOptional()
  @IsString()
  brandColor?: string;

  @ApiPropertyOptional({ description: 'Cache TTL in seconds', default: 60 })
  @IsOptional()
  @IsInt()
  @Min(1)
  cacheTtlSeconds?: number;
}
