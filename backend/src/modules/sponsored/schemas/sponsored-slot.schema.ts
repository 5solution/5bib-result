import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SponsoredSlotDocument = HydratedDocument<SponsoredSlot>;

// ── Embedded item subdocument ─────────────────────────────────────────────────

@Schema({ _id: true, versionKey: false })
export class SponsoredSlotItem {
  _id: string;

  @Prop({ required: true }) race_slug: string;
  @Prop({ required: true }) event_name: string;
  @Prop({ default: null }) event_type: string | null;
  @Prop({ required: true }) event_date_start: Date;
  @Prop({ default: null }) event_date_end: Date | null;
  @Prop({ required: true }) event_location: string;
  @Prop({ required: true }) cover_image_url: string;
  @Prop({ required: true }) price_from: number;
  @Prop({ default: 'Đăng ký →' }) cta_text: string;
  @Prop({ default: null }) cta_url: string | null;
  @Prop({ default: null }) promo_label: string | null;
  @Prop({ default: null }) promo_label_expires_at: Date | null;
  @Prop({ type: [String], default: [] }) badge_labels: string[];
  @Prop({ default: false }) show_countdown: boolean;
  @Prop({ default: null }) countdown_target_at: Date | null;
  @Prop({ required: true, default: 1 }) item_order: number;
}

export const SponsoredSlotItemSchema = SchemaFactory.createForClass(SponsoredSlotItem);

// ── Parent slot document ──────────────────────────────────────────────────────

@Schema({
  collection: 'sponsored_slots',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  versionKey: false,
})
export class SponsoredSlot {
  @Prop({ required: true, enum: ['diamond', 'gold', 'silver'] })
  package_tier: string;

  @Prop({ required: true, default: 99 })
  display_order: number;

  @Prop({ required: true, default: false })
  is_hero: boolean;

  @Prop({ required: true, default: 5, min: 3, max: 30 })
  rotation_interval_seconds: number;

  @Prop({ required: true })
  display_start_at: Date;

  @Prop({ required: true })
  display_end_at: Date;

  @Prop({ default: true })
  is_active: boolean;

  @Prop({ type: [SponsoredSlotItemSchema], default: [] })
  items: SponsoredSlotItem[];

  created_at: Date;
  updated_at: Date;
}

export const SponsoredSlotSchema = SchemaFactory.createForClass(SponsoredSlot);

SponsoredSlotSchema.index({ is_active: 1, display_start_at: 1, display_end_at: 1, display_order: 1 });
SponsoredSlotSchema.index({ package_tier: 1, is_active: 1 });
