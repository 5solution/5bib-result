import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  BUG_CATEGORIES,
  BUG_SEVERITIES,
  BUG_STATUSES,
  BugCategory,
  BugSeverity,
  BugStatus,
} from '../schemas/bug-report.schema';

export class UpdateBugStatusDto {
  @ApiProperty({ enum: BUG_STATUSES })
  @IsEnum(BUG_STATUSES)
  toStatus!: BugStatus;

  @ApiProperty({ required: false, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  // Required only when toStatus = 'duplicate'
  @ApiProperty({ required: false, maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  duplicateOfPublicId?: string;
}

export class UpdateBugAssigneeDto {
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  assigneeId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  assigneeName?: string | null;
}

export class UpdateBugTriageDto {
  @ApiProperty({ enum: BUG_SEVERITIES, required: false })
  @IsOptional()
  @IsEnum(BUG_SEVERITIES)
  severity?: BugSeverity;

  @ApiProperty({ enum: BUG_CATEGORIES, required: false })
  @IsOptional()
  @IsEnum(BUG_CATEGORIES)
  category?: BugCategory;
}
