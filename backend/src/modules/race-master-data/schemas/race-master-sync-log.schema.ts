import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type RaceMasterSyncLogDocument = HydratedDocument<RaceMasterSyncLog>;

export type SyncType = 'ATHLETE_FULL' | 'ATHLETE_DELTA' | 'MANUAL';
export type SyncStatus = 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED';

/**
 * Audit log immutable. Mỗi sync action (cron / manual / lazy init) tạo 1 entry.
 * Admin UI có 1 page xem history sync.
 */
@Schema({
  collection: 'race_master_sync_logs',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class RaceMasterSyncLog {
  @Prop({ required: true, index: true })
  mysql_race_id: number;

  @Prop({
    required: true,
    enum: ['ATHLETE_FULL', 'ATHLETE_DELTA', 'MANUAL'] as SyncType[],
  })
  sync_type: SyncType;

  @Prop({
    required: true,
    enum: ['RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED'] as SyncStatus[],
    default: 'RUNNING',
  })
  status: SyncStatus;

  @Prop({ required: true })
  started_at: Date;

  @Prop({ type: Date, default: null })
  completed_at: Date | null;

  @Prop({ default: 0 })
  rows_fetched: number;

  @Prop({ default: 0 })
  rows_inserted: number;

  @Prop({ default: 0 })
  rows_updated: number;

  @Prop({ default: 0 })
  rows_skipped: number;

  @Prop({ default: 0 })
  duration_ms: number;

  @Prop({ type: String, default: null })
  error_message: string | null;

  /** 'cron' | 'admin:userId' | 'system:chip-verify-enable:userId' | 'lazy:lookupByBib' */
  @Prop({ required: true })
  triggered_by: string;
}

export const RaceMasterSyncLogSchema =
  SchemaFactory.createForClass(RaceMasterSyncLog);

RaceMasterSyncLogSchema.index({ mysql_race_id: 1, started_at: -1 });
RaceMasterSyncLogSchema.index({ status: 1, started_at: -1 });

/**
 * S-10 fix — TTL index 90 days. Sync logs là audit data ngắn hạn — sau 90
 * ngày không còn hữu dụng debug (race đã end, athletes đã sync). Không
 * có TTL → table grow vô hạn → admin sync-logs page slow + Mongo storage.
 *
 * MongoDB tự DELETE doc khi `started_at + 90d < now`. Background scan ~1min
 * → eventual consistency, không impact write path.
 */
RaceMasterSyncLogSchema.index(
  { started_at: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 },
);
