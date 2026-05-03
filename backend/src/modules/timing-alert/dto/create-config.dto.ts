import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { HasFinishCheckpoint } from './has-finish-checkpoint.validator';
import { CourseCheckpoint } from '../schemas/timing-alert-config.schema';

/**
 * POST/PUT body cho `/api/admin/races/:raceId/timing-alert/config`.
 *
 * KHÔNG validate sâu shape của `rr_api_keys` map (caller có thể truyền tên
 * course tùy ý) — chỉ require object non-empty. Giá trị plaintext API key
 * sẽ được encrypt server-side trước khi save Mongo.
 */
export class CreateTimingAlertConfigDto {
  @ApiProperty({ example: '396207', description: 'RaceResult event ID' })
  @IsString()
  @IsNotEmpty()
  rr_event_id: string;

  @ApiProperty({
    description:
      'Map course_name → RaceResult API key plaintext (sẽ được AES-256-GCM encrypt server-side trước khi save Mongo).',
    example: {
      '5KM': 'LE2KXEYOAR6H4YLKGMSXPDT989IQ7VWA',
      '42KM': 'NFSJ1OMPKSSU35EWUD8XR8NJQBOFAS1Q',
    },
  })
  @IsObject()
  rr_api_keys: Record<string, string>;

  @ApiProperty({
    description:
      'Map course_name → ordered checkpoints. Mỗi course PHẢI có entry "Finish" cuối + distance_km strictly increasing.',
    example: {
      '42KM': [
        { key: 'Start', distance_km: 0 },
        { key: 'TM1', distance_km: 10 },
        { key: 'TM2', distance_km: 21 },
        { key: 'TM3', distance_km: 32 },
        { key: 'Finish', distance_km: 42.195 },
      ],
    },
  })
  @IsObject()
  @HasFinishCheckpoint()
  course_checkpoints: Record<string, CourseCheckpoint[]>;

  @ApiPropertyOptional({
    description: 'Map course_name → cutoff time "HH:MM:SS"',
    example: { '42KM': '08:00:00' },
  })
  @IsOptional()
  @IsObject()
  cutoff_times?: Record<string, string>;

  @ApiPropertyOptional({ default: 90, minimum: 60, maximum: 300 })
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(300)
  poll_interval_seconds?: number;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(180)
  overdue_threshold_minutes?: number;

  @ApiPropertyOptional({ default: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  top_n_alert?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

/**
 * Response cho GET / POST config — KHÔNG bao giờ trả plaintext API key.
 * Trả masked preview (4-prefix + 4-suffix + length).
 */
export class TimingAlertConfigResponseDto {
  @ApiProperty()
  config_id: string;

  @ApiProperty()
  race_id: string;

  @ApiProperty()
  rr_event_id: string;

  @ApiProperty({
    description: 'Map course_name → masked API key preview (KHÔNG plaintext)',
    example: { '5KM': 'LE2K...7VWA (32 chars)' },
  })
  rr_api_keys_masked: Record<string, string>;

  @ApiProperty()
  course_checkpoints: Record<string, CourseCheckpoint[]>;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  cutoff_times: Record<string, string>;

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
