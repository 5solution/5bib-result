import {
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  Min,
  IsIn,
  IsBoolean,
  IsArray,
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
    enum: ['draft', 'pre_race', 'live', 'ended'],
    default: 'pre_race',
  })
  @IsOptional()
  @IsIn(['draft', 'pre_race', 'live', 'ended'])
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

  @ApiPropertyOptional({ description: 'Banner URL (S3)' })
  @IsOptional()
  @IsString()
  bannerUrl?: string;

  @ApiPropertyOptional({ description: 'Race description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Race season', example: '2026' })
  @IsOptional()
  @IsString()
  season?: string;

  @ApiPropertyOptional({ description: 'Sponsor banner URLs (S3)', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sponsorBanners?: string[];

  @ApiPropertyOptional({ description: 'Enable E-Certificate', default: false })
  @IsOptional()
  @IsBoolean()
  enableEcert?: boolean;

  @ApiPropertyOptional({ description: 'Enable result claims', default: false })
  @IsOptional()
  @IsBoolean()
  enableClaim?: boolean;

  @ApiPropertyOptional({ description: 'Enable live tracking', default: false })
  @IsOptional()
  @IsBoolean()
  enableLiveTracking?: boolean;

  @ApiPropertyOptional({ description: 'Enable 5Pix photos', default: false })
  @IsOptional()
  @IsBoolean()
  enable5pix?: boolean;

  @ApiPropertyOptional({ description: '5Pix event URL' })
  @IsOptional()
  @IsString()
  pixEventUrl?: string;

  @ApiPropertyOptional({ description: 'Cache TTL in seconds', default: 60 })
  @IsOptional()
  @IsInt()
  @Min(1)
  cacheTtlSeconds?: number;
}
