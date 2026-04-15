import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OpsShiftDocument = HydratedDocument<OpsShift>;

@Schema({ _id: false })
export class OpsShiftLocation {
  @Prop({ required: true })
  station_id: string;

  @Prop()
  notes?: string;
}
export const OpsShiftLocationSchema = SchemaFactory.createForClass(OpsShiftLocation);

@Schema({
  collection: 'ops_shifts',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class OpsShift {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  event_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  team_id: Types.ObjectId;

  @Prop({ required: true })
  name: string; // "Ca đêm 23:00-03:00"

  @Prop({ required: true })
  start_at: Date;

  @Prop({ required: true })
  end_at: Date;

  @Prop({ type: OpsShiftLocationSchema })
  location?: OpsShiftLocation;

  @Prop({ type: [Types.ObjectId], default: [] })
  assigned_user_ids: Types.ObjectId[];

  @Prop({ default: 0 })
  required_count: number;

  @Prop({ type: Date, default: null, index: true })
  deleted_at: Date | null;

  created_at: Date;
  updated_at: Date;
}

export const OpsShiftSchema = SchemaFactory.createForClass(OpsShift);

OpsShiftSchema.index({ event_id: 1, team_id: 1, start_at: 1 });
