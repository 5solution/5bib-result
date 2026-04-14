import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, IsInt, Min, IsIn, Max } from 'class-validator';

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
    description: 'Page size (max 100)',
    default: 10,
    minimum: 1,
    maximum: 100,
    enum: [10, 25, 50, 100],
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 10;

  @ApiPropertyOptional({
    description: 'Filter by result type',
    enum: ['finisher', 'dnf', 'dns', 'dsq'],
  })
  @IsOptional()
  @IsIn(['finisher', 'dnf', 'dns', 'dsq'])
  type?: 'finisher' | 'dnf' | 'dns' | 'dsq';

  @ApiPropertyOptional({
    description: 'Filter by nationality code (e.g. VN, JP)',
    example: 'VN',
  })
  @IsOptional()
  @IsString()
  nationality?: string;

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
