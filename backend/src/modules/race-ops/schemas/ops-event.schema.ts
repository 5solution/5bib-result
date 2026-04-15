import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OpsEventDocument = HydratedDocument<OpsEvent>;

export type OpsEventStatus = 'DRAFT' | 'LIVE' | 'ENDED';

/** Course cự ly — sub-document */
@Schema({ _id: false })
export class OpsEventCourse {
  @Prop({ required: true })
  name: string; // "42KM", "21KM", "10KM", "5KM"

  @Prop({ required: true })
  distance_km: number;

  @Prop({ required: true })
  start_time: Date;
}
export const OpsEventCourseSchema = SchemaFactory.createForClass(OpsEventCourse);

/** Location sub-document */
@Schema({ _id: false })
export class OpsEventLocation {
  @Prop({ required: true })
  name: string;

  @Prop({ type: { lat: Number, lng: Number }, _id: false })
  geo?: { lat: number; lng: number };
}
export const OpsEventLocationSchema = SchemaFactory.createForClass(OpsEventLocation);

/**
 * Station registry per event (extracted from Excel `TRẠM NƯỚC & Y TẾ`).
 * Mỗi event có list station riêng (N00-N11...), dùng cho `ops_teams.station_ids`,
 * incident `station_id`, và hiển thị map Phase 2.
 */
@Schema({ _id: false })
export class OpsEventStation {
  @Prop({ required: true })
  station_id: string; // "N00", "N01", "Y01", "TP42.1"

  @Prop({ required: true })
  name: string; // "Quảng trường Hồ Chí Minh"

  @Prop()
  description?: string;

  @Prop({ type: [String], default: [] })
  courses_served: string[]; // ["42KM", "21KM"]

  @Prop({ type: { lat: Number, lng: Number }, _id: false })
  geo?: { lat: number; lng: number };
}
export const OpsEventStationSchema = SchemaFactory.createForClass(OpsEventStation);

@Schema({
  collection: 'ops_events',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class OpsEvent {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true })
  tenant_id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, index: true })
  slug: string;

  @Prop({ required: true, index: true })
  date: Date;

  @Prop({ type: OpsEventLocationSchema, required: true })
  location: OpsEventLocation;

  @Prop({ type: [OpsEventCourseSchema], default: [] })
  courses: OpsEventCourse[];

  @Prop({ type: [OpsEventStationSchema], default: [] })
  stations: OpsEventStation[];

  @Prop({
    type: String,
    enum: ['DRAFT', 'LIVE', 'ENDED'],
    default: 'DRAFT',
    index: true,
  })
  status: OpsEventStatus;

  @Prop({ type: Types.ObjectId, required: true })
  created_by: Types.ObjectId;

  @Prop({ type: Date, default: null, index: true })
  deleted_at: Date | null;

  created_at: Date;
  updated_at: Date;
}

export const OpsEventSchema = SchemaFactory.createForClass(OpsEvent);

// Compound indexes per PRD §4.2
OpsEventSchema.index({ tenant_id: 1, slug: 1 }, { unique: true });
OpsEventSchema.index({ date: -1 });
OpsEventSchema.index({ status: 1, deleted_at: 1 });
