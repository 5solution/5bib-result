import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, IsInt, Min, IsIn } from 'class-validator';

export class GetRaceResultsDto {
  @ApiPropertyOptional({ description: 'Course ID', example: '708' })
  @IsOptional()
  @IsString()
  course_id?: string;

  @ApiPropertyOptional({ description: 'Search by name', example: 'DƯƠNG' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Filter by gender',
    example: 'Female',
    enum: ['Male', 'Female'],
  })
  @IsOptional()
  @IsIn(['Male', 'Female'])
  gender?: string;

  @ApiPropertyOptional({
    description: 'Filter by category',
    example: 'Female 30-39',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageNo?: number = 1;

  @ApiPropertyOptional({
    description: 'Page size',
    default: 10,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 10;

  @ApiPropertyOptional({
    description: 'Sort field',
    default: 'OverallRank',
    example: 'OverallRank',
  })
  @IsOptional()
  @IsString()
  sortField?: string = 'OverallRank';

  @ApiPropertyOptional({
    description: 'Sort direction',
    default: 'ASC',
    enum: ['ASC', 'DESC'],
  })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortDirection?: 'ASC' | 'DESC' = 'ASC';
}
