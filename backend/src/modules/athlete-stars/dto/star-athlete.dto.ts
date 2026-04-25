import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class StarAthleteDto {
  @ApiProperty({ description: 'Race Mongo _id', example: '67abc123...' })
  @IsString()
  @IsNotEmpty()
  raceId: string;

  @ApiProperty({ description: 'Course ID slug', example: '1-5km' })
  @IsString()
  @IsNotEmpty()
  courseId: string;

  @ApiProperty({ description: 'Bib number', example: '123' })
  @IsString()
  @IsNotEmpty()
  bib: string;
}
