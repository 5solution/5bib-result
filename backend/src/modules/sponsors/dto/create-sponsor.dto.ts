import { IsString, IsOptional, IsIn, IsInt, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSponsorDto {
  @ApiProperty({ description: 'Sponsor name', example: 'Adidas' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Logo URL (S3)', example: 'https://s3.amazonaws.com/bucket/logo.png' })
  @IsString()
  logoUrl: string;

  @ApiPropertyOptional({ description: 'Sponsor website', example: 'https://adidas.com' })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional({
    description: 'Sponsor level',
    enum: ['silver', 'gold', 'diamond'],
    default: 'silver',
  })
  @IsOptional()
  @IsIn(['silver', 'gold', 'diamond'])
  level?: string;

  @ApiPropertyOptional({ description: 'Display order', default: 0 })
  @IsOptional()
  @IsInt()
  order?: number;

  @ApiPropertyOptional({ description: 'Race ID (if race-specific sponsor)', example: '6651a...' })
  @IsOptional()
  @IsString()
  raceId?: string;

  @ApiPropertyOptional({ description: 'Active status', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
