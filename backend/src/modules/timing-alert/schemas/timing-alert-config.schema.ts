import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TimingAlertConfigDocument = HydratedDocument<TimingAlertConfig>;

/**
 * Per-race Timing Miss Alert config — **CHỈ behavior knobs**.
 *
 * **Architectural decision (Manager review 03/05/2026):**
 * Race document (`races` collection) đã có sẵn 100% data domain:
 *   - `race.courses[].apiUrl` → RaceResult endpoint (event ID + key encoded)
 *   - `race.courses[].checkpoints[]` → checkpoint list (key, name, distanceKm)
 *   - `race.courses[].cutOffTime` → cutoff TA-11
 *   - `race.startDate / endDate` → active window TA-14
 *   - `race.externalRaceId` → RR event ID
 *
 * → Timing Alert KHÔNG duplicate config. Đọc trực tiếp Race document.
 *
 * Schema này CHỈ giữ behavior knobs (alert sensitivity, polling interval)
 * + audit metadata. Race-domain config sửa qua `/admin/races/[id]/edit`.
 */
@Schema({ collection: 'timing_alert_configs', timestamps: true })
export class TimingAlertConfig {
  /**
   * Mongo race document `_id` (string ObjectId) — primary identifier.
   * Caller fetch Race document qua RaceModel.findById(race_id) để derive
   * apiUrl + checkpoints + cutoff + window.
   */
  @Prop({ required: true, index: true, unique: true })
  race_id: string;

  /** Polling interval per race (60-300s). Default 90s. */
  @Prop({ default: 90, min: 60, max: 300 })
  poll_interval_seconds: number;

  /** Overdue threshold trước khi flag (1-180 phút). Default 30. */
  @Prop({ default: 30, min: 1, max: 180 })
  overdue_threshold_minutes: number;

  /** Top N rank threshold cho CRITICAL severity (1-50). Default 3. */
  @Prop({ default: 3, min: 1, max: 50 })
  top_n_alert: number;

  /** Feature flag — bật/tắt monitoring per race. */
  @Prop({ default: false, index: true })
  enabled: boolean;

  // ── Audit ──
  @Prop()
  enabled_by_user_id: string;

  @Prop({ type: Date })
  enabled_at: Date;

  @Prop({ type: Date })
  last_polled_at: Date;
}

export const TimingAlertConfigSchema =
  SchemaFactory.createForClass(TimingAlertConfig);
