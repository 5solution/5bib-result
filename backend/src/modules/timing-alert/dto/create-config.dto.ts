import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

/**
 * POST/PUT body cho `/api/admin/races/:raceId/timing-alert/config`.
 *
 * Manager refactor 03/05/2026: chỉ behavior knobs.
 * Race-domain config (apiUrl, checkpoints, cutoff, window) sửa qua
 * `/admin/races/[id]/edit`.
 */
export class CreateTimingAlertConfigDto {
  @ApiPropertyOptional({
    description: 'Polling interval (60-300s)',
    default: 90,
    minimum: 60,
    maximum: 300,
  })
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(300)
  poll_interval_seconds?: number;

  @ApiPropertyOptional({
    description: 'Overdue threshold trước khi flag (1-180 phút)',
    default: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(180)
  overdue_threshold_minutes?: number;

  @ApiPropertyOptional({
    description: 'Top N rank threshold cho CRITICAL severity',
    default: 3,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  top_n_alert?: number;

  @ApiPropertyOptional({
    description:
      'Bật/tắt monitoring per race. Cron tick mỗi 30s sẽ poll race.courses[].apiUrl khi true.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  // ── F-010 — Formula Correction & Config Upgrade ──

  @ApiPropertyOptional({
    description:
      'F-010 BR-FC-08 — Course type preset. Indicator only — admin chọn preset → auto-fill 4 values, có thể override.',
    enum: ['ROAD', 'TRAIL', 'ULTRA'],
    default: null,
  })
  @IsOptional()
  @IsIn(['ROAD', 'TRAIL', 'ULTRA'])
  course_type?: 'ROAD' | 'TRAIL' | 'ULTRA';

  @ApiPropertyOptional({
    description:
      'F-010 BR-FC-08/09 — Pace buffer multiplier dùng trong MissDetector. Range 1.01-2.00. Defaults: ROAD=1.10, TRAIL=1.35, ULTRA=1.50.',
    default: 1.1,
    minimum: 1.01,
    maximum: 2.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(1.01)
  @Max(2.0)
  pace_buffer?: number;

  @ApiPropertyOptional({
    description:
      'F-010 BR-FC-10/11 — isPaceAlert threshold. Range 0.20-0.95. Defaults: ROAD=0.80, TRAIL=0.45, ULTRA=0.40.',
    default: 0.8,
    minimum: 0.2,
    maximum: 0.95,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.2)
  @Max(0.95)
  pace_alert_threshold?: number;

  @ApiPropertyOptional({
    description:
      'F-010 BR-FC-15/16 — Confidence multiplier cho ProjectedRankService. Range 0.05-1.00. Default 0.20.',
    default: 0.2,
    minimum: 0.05,
    maximum: 1.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.05)
  @Max(1.0)
  confidence_multiplier?: number;
}

export class TimingAlertConfigResponseDto {
  @ApiProperty()
  config_id: string;

  @ApiProperty()
  race_id: string;

  @ApiProperty()
  poll_interval_seconds: number;

  @ApiProperty()
  overdue_threshold_minutes: number;

  @ApiProperty()
  top_n_alert: number;

  @ApiProperty()
  enabled: boolean;

  @ApiProperty({ type: String, nullable: true })
  enabled_by_user_id: string | null;

  @ApiProperty({ type: Date, nullable: true })
  enabled_at: Date | null;

  @ApiProperty({ type: Date, nullable: true })
  last_polled_at: Date | null;

  // ── F-010 ──

  @ApiProperty({
    enum: ['ROAD', 'TRAIL', 'ULTRA'],
    nullable: true,
    type: String,
    description: 'F-010 — course type preset, null nếu admin chưa chọn preset',
  })
  course_type: 'ROAD' | 'TRAIL' | 'ULTRA' | null;

  @ApiProperty({
    description: 'F-010 BR-FC-08/09 — pace buffer multiplier (1.01-2.00)',
  })
  pace_buffer: number;

  @ApiProperty({
    description: 'F-010 BR-FC-10/11 — pace alert threshold (0.20-0.95)',
  })
  pace_alert_threshold: number;

  @ApiProperty({
    description:
      'F-010 BR-FC-15/16 — confidence multiplier cho projected rank (0.05-1.00)',
  })
  confidence_multiplier: number;
}
