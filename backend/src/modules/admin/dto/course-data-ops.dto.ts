import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * F-068 BR-68-01..06 — Course data stats response (admin polling endpoint).
 */
export class CourseDataStatsResponseDto {
  @ApiProperty({
    description: 'Số rows trong race_results cho (raceId, courseId) — real-time count, no estimate',
    example: 576,
  })
  rowCount!: number;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'ISO date của sync_log mới nhất, null nếu chưa từng sync',
    example: '2026-05-31T02:45:15.000Z',
  })
  lastSyncedAt!: string | null;

  @ApiProperty({
    nullable: true,
    enum: ['success', 'failed'],
    description: 'Status sync gần nhất',
    example: 'success',
  })
  lastSyncStatus!: 'success' | 'failed' | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'Duration ms của sync gần nhất',
    example: 987,
  })
  lastSyncDurationMs!: number | null;

  @ApiProperty({
    description: 'Có apiUrl không (empty string KHÔNG count as has apiUrl per BR-68-04)',
    example: true,
  })
  hasApiUrl!: boolean;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'Masked apiUrl prefix...suffix per BR-68-05. URL ngắn <16 chars return raw (Danny chốt C). Null nếu hasApiUrl=false.',
    example: 'https://api.raceresult.com/402892/KHV8...J4Q67MIH',
  })
  apiUrlMasked!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'ISO date next cron run, null nếu disabled hoặc in_progress',
    example: '2026-05-31T02:55:00.000Z',
  })
  nextCronAt!: string | null;

  @ApiProperty({
    enum: ['scheduled', 'in_progress', 'disabled'],
    description:
      'cronStatus per BR-68-06: scheduled=có apiUrl + cron sẽ chạy, in_progress=đang sync, disabled=no apiUrl',
    example: 'scheduled',
  })
  cronStatus!: 'scheduled' | 'in_progress' | 'disabled';
}

/**
 * F-068 BR-68-13 — Required body for race=live mutations (defense in depth).
 */
export class ClearApiUrlDto {
  @ApiPropertyOptional({
    description: 'Bắt buộc true nếu race.status=live (BR-68-13). Else 409 RACE_IS_LIVE_CONFIRM_REQUIRED.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  confirmedLive?: boolean;
}

export class ClearApiUrlResponseDto {
  @ApiProperty({ example: 'Đã tắt auto-sync course 200m' })
  message!: string;

  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Masked previous apiUrl trước khi clear (defense — không return raw)',
    example: 'https://api.raceresult.com/402892/KHV8...J4Q67MIH',
  })
  prevApiUrlMasked!: string | null;
}

export class DisableAndResetDto {
  @ApiPropertyOptional({
    description: 'Bắt buộc true nếu race.status=live (BR-68-13). Else 409.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  confirmedLive?: boolean;
}

export class DisableAndResetResponseDto {
  @ApiProperty({ example: 'Đã tắt auto-sync + xóa 576 kết quả — course 200m' })
  message!: string;

  @ApiProperty({ description: 'Số rows xóa khỏi race_results', example: 576 })
  deletedCount!: number;

  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ nullable: true, type: String, example: 'https://api.raceresult.com/402892/KHV8...J4Q67MIH' })
  prevApiUrlMasked!: string | null;

  @ApiProperty({ description: 'Tổng duration ms (clear apiUrl + wait cron + deleteMany)', example: 1234 })
  durationMs!: number;

  @ApiProperty({ description: 'Always false post-success', example: false })
  hasApiUrl!: boolean;

  @ApiProperty({ nullable: true, type: String, description: 'Always null post-success', example: null })
  nextCronAt!: string | null;
}

export class ResetDataDto {
  @ApiPropertyOptional({
    description: 'Bắt buộc true nếu race.status=live (BR-68-13). Else 409.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  confirmedLive?: boolean;
}

/**
 * F-068 BR-68-09 — EXTEND existing reset-data response with cron-aware fields.
 * Backward compat: append-only, không rename/remove field cũ.
 */
export class ResetDataResponseDto {
  @ApiProperty({ example: 'Deleted 576 results for course 200m' })
  message!: string;

  @ApiProperty({ example: 576 })
  deletedCount!: number;

  @ApiProperty({ example: true })
  success!: boolean;

  // NEW F-068 fields (append-only)
  @ApiProperty({ nullable: true, type: String, example: '2026-05-31T02:55:00.000Z' })
  nextCronAt!: string | null;

  @ApiProperty({ example: true })
  hasApiUrl!: boolean;

  @ApiProperty({ example: 1234 })
  durationMs!: number;
}
