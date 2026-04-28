import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { BUG_CATEGORIES, BUG_SEVERITIES, BUG_STATUSES, BugCategory, BugSeverity, BugStatus } from '../schemas/bug-report.schema';

export class ListBugReportsQueryDto {
  @ApiProperty({ enum: BUG_STATUSES, required: false })
  @IsOptional()
  @IsEnum(BUG_STATUSES)
  status?: BugStatus;

  @ApiProperty({ enum: BUG_SEVERITIES, required: false })
  @IsOptional()
  @IsEnum(BUG_SEVERITIES)
  severity?: BugSeverity;

  @ApiProperty({ enum: BUG_CATEGORIES, required: false })
  @IsOptional()
  @IsEnum(BUG_CATEGORIES)
  category?: BugCategory;

  @ApiProperty({ required: false, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, default: 20, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeDeleted?: boolean = false;
}
