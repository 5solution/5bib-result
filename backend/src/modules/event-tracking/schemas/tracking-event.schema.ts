import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TrackingEventDocument = HydratedDocument<TrackingEvent>;

@Schema({
  collection: 'tracking_events',
  timestamps: { createdAt: 'created_at', updatedAt: false },
  versionKey: false,
})
export class TrackingEvent {
  @Prop({ required: true, index: true })
  event_name: string;

  @Prop({ required: true, index: true })
  event_category: string;

  @Prop({ required: true, index: true })
  session_id: string;

  @Prop({ required: true })
  timestamp: Date;

  @Prop({ required: true })
  page_url: string;

  @Prop({ required: true, index: true })
  page_path: string;

  @Prop({ index: true, sparse: true, default: null })
  user_id: string | null;

  @Prop({ default: null })
  referrer: string | null;

  @Prop({ index: true, default: null })
  utm_source: string | null;

  @Prop({ default: null })
  utm_medium: string | null;

  @Prop({ index: true, default: null })
  utm_campaign: string | null;

  @Prop({ default: null })
  utm_content: string | null;

  @Prop({ default: null })
  utm_term: string | null;

  @Prop({ index: true, sparse: true, default: null })
  ref_code: string | null;

  @Prop({ enum: ['mobile', 'tablet', 'desktop'], default: null })
  device_type: string | null;

  @Prop({ type: Object, default: {} })
  event_data: Record<string, unknown>;

  created_at: Date;
}

export const TrackingEventSchema = SchemaFactory.createForClass(TrackingEvent);

TrackingEventSchema.index({ event_name: 1, timestamp: -1 });
TrackingEventSchema.index({ session_id: 1, timestamp: 1 });
TrackingEventSchema.index({ utm_source: 1, event_name: 1, timestamp: -1 });
TrackingEventSchema.index({ 'event_data.event_id': 1, event_name: 1 });
TrackingEventSchema.index({ ref_code: 1, event_name: 1 });
