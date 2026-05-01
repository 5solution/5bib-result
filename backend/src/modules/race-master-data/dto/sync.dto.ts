import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import type { SyncStatus, SyncType } from '../schemas/race-master-sync-log.schema';

export class TriggerSyncRequestDto {
  @ApiProperty({
    enum: ['ATHLETE_FULL', 'ATHLETE_DELTA'],
    default: 'ATHLETE_FULL',
  })
  @IsOptional()
  @IsEnum(['ATHLETE_FULL', 'ATHLETE_DELTA'])
  syncType?: 'ATHLETE_FULL' | 'ATHLETE_DELTA';
}

export class SyncLogDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  mysql_race_id!: number;

  @ApiProperty({ enum: ['ATHLETE_FULL', 'ATHLETE_DELTA', 'MANUAL'] })
  sync_type!: SyncType;

  @ApiProperty({ enum: ['RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED'] })
  status!: SyncStatus;

  @ApiProperty()
  started_at!: Date;

  @ApiProperty({ type: Date, nullable: true })
  completed_at!: Date | null;

  @ApiProperty()
  rows_fetched!: number;

  @ApiProperty()
  rows_inserted!: number;

  @ApiProperty()
  rows_updated!: number;

  @ApiProperty()
  rows_skipped!: number;

  @ApiProperty()
  duration_ms!: number;

  @ApiProperty({ type: String, nullable: true })
  error_message!: string | null;

  @ApiProperty()
  triggered_by!: string;
}

export class SyncLogListDto {
  @ApiProperty({ type: [SyncLogDto] })
  items!: SyncLogDto[];

  @ApiProperty()
  total!: number;
}

export class TriggerSyncResponseDto {
  @ApiProperty({ type: SyncLogDto })
  log!: SyncLogDto;
}
