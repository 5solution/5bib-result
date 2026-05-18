import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SeoSyncLogDocument = HydratedDocument<SeoSyncLog>;

/**
 * FEATURE-036 — Audit log for SEO slug sync runs (cron + manual triggers).
 *
 * Read by admin UI `/admin/seo` to show last-N runs + last failure reason.
 * Retention: indefinite (small docs, ~1KB each, weekly cadence → ~52/year).
 */
@Schema({
  collection: 'seo_sync_logs',
  timestamps: true,
  suppressReservedKeysWarning: true,
})
export class SeoSyncLog {
  @Prop({ required: true }) startedAt: Date;
  @Prop() finishedAt?: Date;
  @Prop({ required: true, enum: ['cron', 'manual'] })
  triggeredBy: 'cron' | 'manual';
  @Prop() userId?: string;
  @Prop({ default: 0 }) racesScanned: number;
  @Prop({ default: 0 }) slugsGenerated: number;
  @Prop({ type: [String], default: [] }) revalidatedPaths: string[];
  @Prop({ type: [String], default: [] }) errors: string[];
  @Prop({ default: 0 }) durationMs: number;
  @Prop({ default: false }) lockSkipped: boolean;
}

export const SeoSyncLogSchema = SchemaFactory.createForClass(SeoSyncLog);
SeoSyncLogSchema.index({ startedAt: -1 });
