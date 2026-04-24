import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ShareEventDocument = HydratedDocument<ShareEvent>;

/**
 * Analytics log — one document per share / download of a Result Image.
 * Written fire-and-forget from the frontend after a successful share action.
 *
 * Indexes (defined below):
 *   { raceId: 1, createdAt: -1 }  — admin widget "per race"
 *   { template: 1, createdAt: -1 } — admin widget "top templates"
 *   { bib: 1, raceId: 1 }          — per-athlete share history
 */
@Schema({
  collection: 'share_events',
  timestamps: { createdAt: 'createdAt', updatedAt: false },
})
export class ShareEvent {
  _id: string;
  @Prop({ required: true }) raceId: string;
  @Prop({ required: true }) bib: string;
  @Prop({ required: true }) template: string;
  /** 'download' | 'web-share' | 'copy-link' | 'unknown' */
  @Prop({ required: true }) channel: string;
  @Prop() gradient?: string;
  @Prop() size?: string;
  /** True when backend fell back to classic (template ineligible) */
  @Prop({ default: false }) templateFallback: boolean;
  /** User agent (truncated to 255 chars) */
  @Prop() userAgent?: string;
  createdAt: Date;
}

export const ShareEventSchema = SchemaFactory.createForClass(ShareEvent);

ShareEventSchema.index({ raceId: 1, createdAt: -1 });
ShareEventSchema.index({ template: 1, createdAt: -1 });
ShareEventSchema.index({ bib: 1, raceId: 1 });
