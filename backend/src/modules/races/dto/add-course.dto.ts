import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CheckpointServicesDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() water?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() food?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() sleep?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() dropBag?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() medical?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class CourseCheckpointDto {
  @ApiProperty({ description: 'Timing point key', example: 'TM1' })
  @IsString()
  key: string;

  @ApiProperty({ description: 'Display name', example: 'Trạm 1 - Suối Vàng' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Distance label (display string)', example: '5K' })
  @IsOptional()
  @IsString()
  distance?: string;

  @ApiPropertyOptional({
    description: 'Distance in km (numeric, used by timing-alert pace projection)',
    example: 5.2,
  })
  @IsOptional()
  @IsNumber()
  distanceKm?: number;

  @ApiPropertyOptional({ description: 'Aid station services available at this checkpoint' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CheckpointServicesDto)
  services?: CheckpointServicesDto;
}

export class AddCourseDto {
  @ApiPropertyOptional({ description: 'Course ID (auto-generated from name if omitted)', example: '42km-full-marathon' })
  @IsOptional()
  @IsString()
  courseId?: string;

  @ApiProperty({ description: 'Course name', example: '42km Full Marathon' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Distance label', example: '42km' })
  @IsOptional()
  @IsString()
  distance?: string;

  @ApiPropertyOptional({ description: 'Distance in km', example: 42.195 })
  @IsOptional()
  @IsNumber()
  distanceKm?: number;

  @ApiPropertyOptional({ description: 'Course type', example: 'road' })
  @IsOptional()
  @IsString()
  courseType?: string;

  @ApiPropertyOptional({
    description: 'RaceResult API URL for this course',
    example: 'https://my.raceresult.com/api/results?contest=708',
  })
  @IsOptional()
  @IsString()
  apiUrl?: string;

  @ApiPropertyOptional({ description: 'API response format', example: 'json', enum: ['json', 'csv'] })
  @IsOptional()
  @IsString()
  apiFormat?: string;

  @ApiPropertyOptional({ description: 'Course cover image URL (S3)' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Total elevation gain in meters', example: 1500 })
  @IsOptional()
  @IsNumber()
  elevationGain?: number;

  @ApiPropertyOptional({ description: 'Start time', example: '05:00' })
  @IsOptional()
  @IsString()
  startTime?: string;

  @ApiPropertyOptional({ description: 'Start location', example: 'Quảng trường Lâm Viên' })
  @IsOptional()
  @IsString()
  startLocation?: string;

  @ApiPropertyOptional({ description: 'Cut-off time', example: '12:00:00' })
  @IsOptional()
  @IsString()
  cutOffTime?: string;

  @ApiPropertyOptional({ description: 'Course map image URL (S3)' })
  @IsOptional()
  @IsString()
  mapUrl?: string;

  @ApiPropertyOptional({ description: 'GPX file URL (S3)' })
  @IsOptional()
  @IsString()
  gpxUrl?: string;

  @ApiPropertyOptional({
    description: 'Course checkpoints (timing points)',
    type: [CourseCheckpointDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CourseCheckpointDto)
  checkpoints?: CourseCheckpointDto[];
}
