import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OpsIncidentDocument = HydratedDocument<OpsIncident>;

export type OpsIncidentPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type OpsIncidentStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

@Schema({
  collection: 'ops_incidents',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class OpsIncident {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  event_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  reported_by: Types.ObjectId;

  @Prop({ type: Types.ObjectId, default: null, index: true })
  team_id: Types.ObjectId | null;

  @Prop({ index: true })
  station_id?: string; // "N05", "N0 ĐÍCH"

  @Prop({
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH'],
    required: true,
    index: true,
  })
  priority: OpsIncidentPriority;

  @Prop({ required: true })
  description: string;

  @Prop({ type: [String], default: [] })
  photo_urls: string[]; // S3 URLs, max 3

  @Prop({
    type: String,
    enum: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'],
    default: 'OPEN',
    index: true,
  })
  status: OpsIncidentStatus;

  @Prop({ type: Types.ObjectId, default: null })
  acknowledged_by: Types.ObjectId | null;

  @Prop()
  acknowledged_at?: Date;

  @Prop({ type: Types.ObjectId, default: null })
  resolved_by: Types.ObjectId | null;

  @Prop()
  resolved_at?: Date;

  @Prop()
  resolution_note?: string;

  @Prop({ type: Date, default: null, index: true })
  deleted_at: Date | null;

  created_at: Date;
  updated_at: Date;
}

export const OpsIncidentSchema = SchemaFactory.createForClass(OpsIncident);

OpsIncidentSchema.index({ event_id: 1, priority: 1, status: 1 });
OpsIncidentSchema.index({ event_id: 1, created_at: -1 });
