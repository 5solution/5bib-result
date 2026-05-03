import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TimingAlertDocument = HydratedDocument<TimingAlert>;

export type TimingAlertSeverity = 'CRITICAL' | 'HIGH' | 'WARNING' | 'INFO';
export type TimingAlertStatus = 'OPEN' | 'RESOLVED' | 'FALSE_ALARM';

/**
 * Audit log entry cho mọi state transition (detect / re-detect / resolve /
 * false alarm). Append-only, tăng theo thời gian.
 */
export interface TimingAlertAuditEntry {
  action: string;
  by: string;
  at: Date;
  note?: string;
}

/**
 * Per-detection alert. 1 OPEN alert per (race, bib) — re-detect tăng
 * `detection_count` thay vì tạo doc mới.
 *
 * Athlete metadata SNAPSHOT từ RR API tại thời điểm detect — KHÔNG live
 * lookup. Reason: trace nguồn data + fix legacy MySQL không cần thiết
 * (module hoàn toàn KHÔNG đụng MySQL).
 */
@Schema({
  collection: 'timing_alerts',
  timestamps: { createdAt: 'first_detected_at', updatedAt: 'last_checked_at' },
})
export class TimingAlert {
  @Prop({ required: true, index: true })
  race_id: string;

  @Prop({ required: true, index: true })
  bib_number: string;

  /** Optional — RR có thể trả Bib=0 → service fallback parse certificate URL. */
  @Prop({ type: Number, default: null })
  athletes_id: number | null;

  // ── Athlete snapshot (từ RR API at detect time) ──
  @Prop({ type: String, default: null })
  athlete_name: string | null; // "Firstname Lastname" hoặc fallback Name field

  @Prop({ type: String, default: null })
  contest: string | null; // "42KM"

  @Prop({ type: String, default: null })
  age_group: string | null; // RR Category field — "Nam 40-49"

  @Prop({ type: String, default: null })
  gender: string | null;

  // ── Detection ──
  @Prop({ required: true })
  last_seen_point: string;

  @Prop({ required: true })
  last_seen_time: string;

  @Prop({ required: true })
  missing_point: string;

  // ── Projection ──
  @Prop({ type: String, default: null })
  projected_finish_time: string | null;

  @Prop({ type: Number, default: null })
  projected_overall_rank: number | null;

  @Prop({ type: Number, default: null })
  projected_age_group_rank: number | null;

  /** 0..1 confidence dựa % course đã có finisher ở thời điểm detect. */
  @Prop({ type: Number, default: null })
  projected_confidence: number | null;

  @Prop({ type: Number, default: 0 })
  overdue_minutes: number;

  // ── Severity + Status ──
  @Prop({
    required: true,
    enum: ['CRITICAL', 'HIGH', 'WARNING', 'INFO'],
    index: true,
  })
  severity: TimingAlertSeverity;

  @Prop({ type: String, default: null })
  reason: string | null;

  @Prop({
    required: true,
    enum: ['OPEN', 'RESOLVED', 'FALSE_ALARM'],
    default: 'OPEN',
    index: true,
  })
  status: TimingAlertStatus;

  @Prop({ type: String, default: null })
  resolved_by: string | null;

  @Prop({ type: Date, default: null })
  resolved_at: Date | null;

  @Prop({ type: String, default: null })
  resolution_note: string | null;

  // ── Audit log ──
  @Prop({ type: [Object], default: [] })
  audit_log: TimingAlertAuditEntry[];

  // ── Meta (timestamps wired) ──
  /** Set on create. */
  first_detected_at?: Date;
  /** Updated on every re-detect / status change. */
  last_checked_at?: Date;

  @Prop({ default: 1 })
  detection_count: number;

  /**
   * Snapshot raw RR API athlete record cho debug — chứa Chiptimes JSON +
   * raw fields. Lưu Object để Mongoose store flexible JSON.
   */
  @Prop({ type: Object })
  rr_api_snapshot: Record<string, unknown>;
}

export const TimingAlertSchema = SchemaFactory.createForClass(TimingAlert);

// ── Indexes ──

/**
 * Unique partial: chỉ 1 alert OPEN per (race, bib). Re-detect cùng BIB →
 * service tăng `detection_count` thay vì insert mới (atomic findOneAndUpdate).
 *
 * partialFilterExpression cho phép multiple RESOLVED/FALSE_ALARM cùng BIB
 * (history archive).
 */
TimingAlertSchema.index(
  { race_id: 1, bib_number: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'OPEN' },
  },
);

/** Admin filter — list alerts theo severity + status nhanh. */
TimingAlertSchema.index({ race_id: 1, severity: 1, status: 1 });

/** Sort recent — admin dashboard "alerts gần nhất". */
TimingAlertSchema.index({ first_detected_at: -1 });
