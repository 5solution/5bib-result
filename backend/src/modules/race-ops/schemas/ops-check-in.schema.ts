import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OpsCheckInDocument = HydratedDocument<OpsCheckIn>;

export type OpsCheckInMethod = 'QR' | 'MANUAL';

@Schema({ _id: false })
export class OpsCheckInGeo {
  @Prop({ required: true })
  lat: number;

  @Prop({ required: true })
  lng: number;
}
export const OpsCheckInGeoSchema = SchemaFactory.createForClass(OpsCheckInGeo);

@Schema({
  collection: 'ops_check_ins',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class OpsCheckIn {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  event_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  user_id: Types.ObjectId; // TNV được check-in

  @Prop({ type: Types.ObjectId, required: true, index: true })
  team_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, default: null })
  shift_id: Types.ObjectId | null;

  @Prop({ required: true })
  checked_in_at: Date;

  @Prop({ type: Types.ObjectId, required: true })
  checked_in_by: Types.ObjectId; // Crew/Leader scan

  @Prop({
    type: String,
    enum: ['QR', 'MANUAL'],
    required: true,
  })
  method: OpsCheckInMethod;

  @Prop({ type: OpsCheckInGeoSchema })
  geo?: OpsCheckInGeo;

  created_at: Date;
  updated_at: Date;
}

export const OpsCheckInSchema = SchemaFactory.createForClass(OpsCheckIn);

OpsCheckInSchema.index({ event_id: 1, user_id: 1, checked_in_at: -1 });
OpsCheckInSchema.index({ event_id: 1, team_id: 1, checked_in_at: -1 });
