import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

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
}
