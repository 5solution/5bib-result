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

  // ── F-010 Formula Correction & Config Upgrade (Race Ops Timing Intelligence) ──
  // Tất cả 4 fields OPTIONAL với defaults — backward compat 195 existing races,
  // không cần migration. Code fallback to defaults khi config doc thiếu fields.

  /**
   * F-010 BR-FC-08 — Course type preset (ROAD | TRAIL | ULTRA).
   * Indicator only — KHÔNG enforce. Admin select preset → auto-fill 4 values
   * dưới đây nhưng có thể override individual values sau.
   */
  @Prop({
    required: false,
    enum: ['ROAD', 'TRAIL', 'ULTRA'],
    default: null,
    type: String,
  })
  course_type: 'ROAD' | 'TRAIL' | 'ULTRA' | null;

  /**
   * F-010 BR-FC-08/09 — Pace buffer multiplier dùng trong MissDetector.
   * Replace static `MissDetectorService.PACE_BUFFER = 1.05`. Range 1.01–2.00.
   * Defaults: ROAD=1.10, TRAIL=1.35 (Danny chốt), ULTRA=1.50 (Danny chốt).
   */
  @Prop({ required: false, type: Number, default: 1.10, min: 1.01, max: 2.0 })
  pace_buffer: number;

  /**
   * F-010 BR-FC-10/11 — isPaceAlert threshold dùng trong race-result service
   * `getAthleteDetail()`. Replace hardcoded `0.8`. Range 0.20–0.95.
   * Defaults: ROAD=0.80, TRAIL=0.45 (Danny chốt), ULTRA=0.40.
   */
  @Prop({ required: false, type: Number, default: 0.80, min: 0.2, max: 0.95 })
  pace_alert_threshold: number;

  /**
   * F-010 BR-FC-15/16 — Confidence multiplier cho ProjectedRankService.
   * `confidence = MIN(1.0, totalFinishers / (totalRegistered × multiplier))`.
   * Range 0.05–1.00. Defaults: ROAD/TRAIL=0.20, ULTRA=0.15.
   */
  @Prop({ required: false, type: Number, default: 0.20, min: 0.05, max: 1.0 })
  confidence_multiplier: number;

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
