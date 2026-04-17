import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export type OpsTaskStatusType = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED';

/* ───────── Create / Update ───────── */

export class CreateTaskDto {
  @ApiPropertyOptional({
    description:
      'Task event-wide (team_id=null) hoặc assign cho team cụ thể.',
  })
  @IsOptional()
  @IsMongoId()
  team_id?: string;

  @ApiProperty({ example: 'Setup cổng xuất phát' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ example: 'Dựng rào, treo cổng, check loa' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ example: '2026-04-20T03:00:00.000Z' })
  @IsDateString()
  due_at: string;

  @ApiPropertyOptional({ example: '2026-04-20T05:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  due_end_at?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'ops_users IDs được assign',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsMongoId({ each: true })
  assignee_user_ids?: string[];
}

export class UpdateTaskDto extends PartialType(CreateTaskDto) {
  @ApiPropertyOptional({
    enum: ['PENDING', 'IN_PROGRESS', 'DONE', 'BLOCKED'],
  })
  @IsOptional()
  @IsEnum(['PENDING', 'IN_PROGRESS', 'DONE', 'BLOCKED'])
  status?: OpsTaskStatusType;

  @ApiPropertyOptional({ description: 'Bắt buộc khi status=BLOCKED' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  blocker_reason?: string;
}

/* ───────── Status-only change (fast-path) ───────── */

export class UpdateTaskStatusDto {
  @ApiProperty({ enum: ['PENDING', 'IN_PROGRESS', 'DONE', 'BLOCKED'] })
  @IsEnum(['PENDING', 'IN_PROGRESS', 'DONE', 'BLOCKED'])
  status: OpsTaskStatusType;

  @ApiPropertyOptional({ description: 'Bắt buộc khi status=BLOCKED' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  blocker_reason?: string;
}

/* ───────── Query ───────── */

export class TaskListQueryDto {
  @ApiPropertyOptional({
    enum: ['PENDING', 'IN_PROGRESS', 'DONE', 'BLOCKED'],
  })
  @IsOptional()
  @IsIn(['PENDING', 'IN_PROGRESS', 'DONE', 'BLOCKED'])
  status?: OpsTaskStatusType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  team_id?: string;

  @ApiPropertyOptional({ description: 'Filter tasks chỉ của user này (assignee)' })
  @IsOptional()
  @IsMongoId()
  assignee_user_id?: string;
}

/* ───────── Excel import ───────── */

export class ImportTaskRowDto {
  @ApiProperty() title: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty({ example: '2026-04-20T03:00:00.000Z' })
  @IsDateString()
  due_at: string;
  @ApiPropertyOptional() due_end_at?: string;
  @ApiPropertyOptional() team_id?: string;
  @ApiPropertyOptional() source_excel_row?: number;
  @ApiPropertyOptional({ example: 'TIMELINE' })
  source_excel_sheet?: string;
}

export class ImportTasksDto {
  @ApiProperty({ type: [ImportTaskRowDto] })
  @IsArray()
  @ArrayMaxSize(500)
  rows: ImportTaskRowDto[];

  @ApiPropertyOptional({
    default: false,
    description:
      'true → xoá tasks có source_excel_sheet trùng trước khi import (idempotent re-import).',
  })
  @IsOptional()
  replace_by_sheet?: boolean;
}

/* ───────── Response ───────── */

export class TaskResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() event_id: string;
  @ApiProperty({ nullable: true, type: String }) team_id: string | null;
  @ApiProperty() title: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty() due_at: Date;
  @ApiPropertyOptional() due_end_at?: Date;
  @ApiProperty({ enum: ['PENDING', 'IN_PROGRESS', 'DONE', 'BLOCKED'] })
  status: OpsTaskStatusType;
  @ApiProperty({ type: [String] }) assignee_user_ids: string[];
  @ApiPropertyOptional() blocker_reason?: string;
  @ApiPropertyOptional() completed_at?: Date;
  @ApiProperty({ nullable: true, type: String }) completed_by: string | null;
  @ApiPropertyOptional() source_excel_row?: number;
  @ApiPropertyOptional() source_excel_sheet?: string;
  @ApiProperty() created_at: Date;
  @ApiProperty() updated_at: Date;
}

export class TaskListResponseDto {
  @ApiProperty({ type: [TaskResponseDto] }) items: TaskResponseDto[];
  @ApiProperty() total: number;
}

export class ImportTasksResponseDto {
  @ApiProperty() created: number;
  @ApiProperty() replaced: number;
  @ApiProperty() skipped: number;
  @ApiProperty({ type: [String] }) errors: string[];
}
