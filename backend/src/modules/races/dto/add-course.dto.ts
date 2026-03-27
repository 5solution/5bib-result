import { IsString, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
}
