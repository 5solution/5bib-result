import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class ListStarsQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageNo?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 20;
}

export class AthleteStarResponseDto {
  @ApiPropertyOptional() _id: string;
  @ApiPropertyOptional() userId: string;
  @ApiPropertyOptional() raceId: string;
  @ApiPropertyOptional() courseId: string;
  @ApiPropertyOptional() bib: string;
  @ApiPropertyOptional() athleteName: string;
  @ApiPropertyOptional() athleteGender: string;
  @ApiPropertyOptional() athleteCategory: string;
  @ApiPropertyOptional() raceName: string;
  @ApiPropertyOptional() raceSlug: string;
  @ApiPropertyOptional() courseName: string;
  @ApiPropertyOptional() starred_at: Date;
}

export class AthleteStarListResponseDto {
  @ApiPropertyOptional({ type: [AthleteStarResponseDto] })
  data: AthleteStarResponseDto[];

  @ApiPropertyOptional({ example: 42 })
  total: number;

  @ApiPropertyOptional({ example: 1 })
  pageNo: number;

  @ApiPropertyOptional({ example: 20 })
  pageSize: number;
}
