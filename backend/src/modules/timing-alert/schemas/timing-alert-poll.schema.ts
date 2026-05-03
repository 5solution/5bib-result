import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TimingAlertPollDocument = HydratedDocument<TimingAlertPoll>;

export type TimingAlertPollStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED';

/**
 * Audit log mỗi poll cycle (1 cycle = 1 race + 1 course + 1 RR API call).
 * Dùng cho admin debug + analytics "miss rate per race day".
 *
 * **Retention:** 90d TTL via index expireAfterSeconds — sau 90d Mongo
 * tự DELETE. Audit data ngắn hạn, race ended thì không còn debug giá trị.
 */
@Schema({
  collection: 'timing_alert_polls',
  timestamps: { createdAt: 'started_at' },
})
export class TimingAlertPoll {
  @Prop({ required: true, index: true })
  mysql_race_id: number;

  @Prop({ required: true })
  course_name: string;

  @Prop({ required: true, enum: ['SUCCESS', 'PARTIAL', 'FAILED'] })
  status: TimingAlertPollStatus;

  @Prop({ type: Number, default: 0 })
  athletes_fetched: number;

  @Prop({ type: Number, default: 0 })
  alerts_created: number;

  @Prop({ type: Number, default: 0 })
  alerts_resolved: number;

  @Prop({ type: Number, default: 0 })
  alerts_unchanged: number;

  @Prop({ type: Number, default: 0 })
  duration_ms: number;

  /** Set automatically by timestamps. */
  started_at?: Date;

  @Prop({ type: Date })
  completed_at: Date;

  @Prop({ type: String, default: null })
  error_message: string | null;
}

export const TimingAlertPollSchema =
  SchemaFactory.createForClass(TimingAlertPoll);

/** Sort recent + filter per race. */
TimingAlertPollSchema.index({ mysql_race_id: 1, started_at: -1 });

/**
 * TTL 90 days — Mongo background scan ~1min, auto DELETE entries quá hạn.
 * Audit log ngắn hạn, race day data hết giá trị sau 3 tháng.
 */
TimingAlertPollSchema.index(
  { started_at: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 },
);
