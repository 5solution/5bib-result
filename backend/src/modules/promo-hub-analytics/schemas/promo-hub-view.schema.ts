import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * FEATURE-027 — Promo Hub page view analytics event.
 *
 * Records a single page-view of a published promo hub. Tracked via
 * client-side `<PromoHubTracker>` component on mount.
 *
 * Rate-limited per IP+slug: only 1 view per 5 minutes (BR-PH-09) via
 * Redis key `ratelimit:promo-view:<slug>:<ip-hash>` TTL 300s.
 *
 * Privacy: SHA-256 hashed IP per BR-PH-08 + Plan "IP băm" section.
 *
 * Retention: 90-day TTL via index on `viewedAt`.
 */

@Schema({ collection: 'promo_hub_views', timestamps: false })
export class PromoHubView {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  hubId!: Types.ObjectId;

  /** SHA-256 hash of client IP (BR-PH-08). */
  @Prop({ type: String, required: true, maxlength: 64 })
  ip!: string;

  @Prop({ type: String, maxlength: 500 })
  userAgent?: string;

  @Prop({ type: String, maxlength: 2000 })
  referer?: string;

  @Prop({ type: Date, required: true, default: () => new Date() })
  viewedAt!: Date;
}
export type PromoHubViewDocument = PromoHubView & Document;
export const PromoHubViewSchema = SchemaFactory.createForClass(PromoHubView);

// Analytics query: view trend per hub in time window.
PromoHubViewSchema.index({ hubId: 1, viewedAt: -1 });

// TTL: auto-expire after 90 days.
PromoHubViewSchema.index(
  { viewedAt: 1 },
  { expireAfterSeconds: 7776000 },
);
