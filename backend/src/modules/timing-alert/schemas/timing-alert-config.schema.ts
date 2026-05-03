import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TimingAlertConfigDocument = HydratedDocument<TimingAlertConfig>;

/**
 * Course checkpoint definition — match cấu trúc course timing points.
 * `key` PHẢI khớp với RaceResult `Chiptimes` JSON keys (VD "Start", "TM1",
 * "Finish"). `distance_km` dùng để compute pace + projected finish.
 *
 * VALIDATION: array PHẢI có entry `Finish` (key chính xác hoặc case-insensitive
 * — RR vendor mixed Case "Finish"/"FINISH"). Validate ở DTO layer trước khi
 * tới schema (CreateConfigDto.course_checkpoints custom validator).
 */
export interface CourseCheckpoint {
  key: string;
  distance_km: number;
}

/**
 * Per-race config cho Timing Miss Alert. Lưu RR API keys ENCRYPTED + course
 * checkpoint metadata + cutoff times.
 *
 * **Security:** field `rr_api_keys` map chứa CIPHERTEXT (format
 * `<iv>:<tag>:<ct>`), NEVER plaintext. Decrypt chỉ trong service layer khi
 * gọi RR API. Admin UI hiển thị MASKED preview qua `ApiKeyCrypto.mask()`.
 */
@Schema({ collection: 'timing_alert_configs', timestamps: true })
export class TimingAlertConfig {
  /**
   * Mongo race document `_id` (string ObjectId) — primary identifier.
   * Match pattern existing race-result module + admin URL `/admin/races/[id]/...`.
   *
   * Module này KHÔNG đụng MySQL legacy → KHÔNG dùng `mysql_race_id` numeric.
   * Mọi query downstream (race_results cho projected rank, races cho course
   * config) đều dùng Mongo ID native.
   */
  @Prop({ required: true, index: true, unique: true })
  race_id: string;

  /** RaceResult event ID, VD "396207" — public, KHÔNG sensitive. */
  @Prop({ required: true })
  rr_event_id: string;

  /**
   * Map course_name → encrypted API key.
   * Format value: `<iv>:<authTag>:<ciphertext>` (3 base64 parts).
   * NEVER store plaintext at rest.
   */
  @Prop({ type: Object, required: true })
  rr_api_keys: Record<string, string>;

  /** Map course_name → ordered checkpoints. PHẢI có entry "Finish" cuối. */
  @Prop({ type: Object, required: true })
  course_checkpoints: Record<string, CourseCheckpoint[]>;

  /** Map course_name → cutoff time (ISO duration "PT8H" hoặc "08:00:00"). */
  @Prop({ type: Object, default: {} })
  cutoff_times: Record<string, string>;

  /**
   * TA-14: Active race window — cron skip race khi `now` ngoài
   * `[event_start_iso - 1h, event_end_iso + 2h]`. Tiết kiệm RR API call
   * cho race draft / future / đã end.
   *
   * Cả 2 null/undefined → cron luôn poll (legacy behavior). Set giá trị →
   * filter active.
   */
  @Prop({ type: Date, default: null })
  event_start_iso: Date | null;

  @Prop({ type: Date, default: null })
  event_end_iso: Date | null;

  @Prop({ default: 90, min: 60, max: 300 })
  poll_interval_seconds: number;

  @Prop({ default: 30 })
  overdue_threshold_minutes: number;

  /** Top N rank threshold cho CRITICAL severity (default 3). */
  @Prop({ default: 3 })
  top_n_alert: number;

  @Prop({ default: false, index: true })
  enabled: boolean;

  @Prop()
  enabled_by_user_id: string;

  @Prop({ type: Date })
  enabled_at: Date;

  @Prop({ type: Date })
  last_polled_at: Date;
}

export const TimingAlertConfigSchema =
  SchemaFactory.createForClass(TimingAlertConfig);
