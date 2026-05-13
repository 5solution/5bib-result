import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * FEATURE-027 — Promo Hub click analytics event.
 *
 * Records a single user click on a CTA / link / button rendered inside
 * a published promo hub. Separate collection from views (BR-PH-08) to
 * keep analytics queries scoped.
 *
 * Privacy:
 *   - `ip` stores SHA-256 hash, NEVER raw IP (GDPR-friendly + still
 *     supports unique-visitor counting).
 *   - `userAgent` raw (used for bot detection + device split).
 *   - `referer` raw (used for traffic source attribution).
 *
 * Retention:
 *   - 90-day TTL via index on `clickedAt` (`expireAfterSeconds: 7776000`).
 *   - Aggregated summary stored elsewhere (PromoHubAnalyticsService
 *     summary endpoint) so dropped detail events don't lose roll-ups.
 */

@Schema({ collection: 'promo_hub_clicks', timestamps: false })
export class PromoHubClick {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  hubId!: Types.ObjectId;

  /** ObjectId of the section that contained the clicked element. */
  @Prop({ type: Types.ObjectId, required: true })
  sectionId!: Types.ObjectId;

  /**
   * Human-readable label of the clicked element (e.g. button text,
   * link anchor text). Used for "top CTA labels" analytics rollup.
   */
  @Prop({ type: String, required: true, maxlength: 200 })
  label!: string;

  /**
   * Destination URL of the click. Useful for outbound link attribution.
   */
  @Prop({ type: String, required: true, maxlength: 2000 })
  url!: string;

  /** SHA-256 hash of client IP (BR-PH-08 + Plan section "IP băm"). */
  @Prop({ type: String, required: true, maxlength: 64 })
  ip!: string;

  @Prop({ type: String, maxlength: 500 })
  userAgent?: string;

  @Prop({ type: String, maxlength: 2000 })
  referer?: string;

  @Prop({ type: Date, required: true, default: () => new Date() })
  clickedAt!: Date;
}
export type PromoHubClickDocument = PromoHubClick & Document;
export const PromoHubClickSchema = SchemaFactory.createForClass(PromoHubClick);

// Analytics query: most clicks per hub in time window.
PromoHubClickSchema.index({ hubId: 1, clickedAt: -1 });

// TTL: auto-expire after 90 days (7776000 seconds).
PromoHubClickSchema.index(
  { clickedAt: 1 },
  { expireAfterSeconds: 7776000 },
);
