import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SyncLogDocument = HydratedDocument<SyncLog>;

@Schema({
  collection: 'sync_logs',
  timestamps: { createdAt: 'created_at' },
})
export class SyncLog {
  _id: string;
  @Prop({ required: true }) raceId: string;
  @Prop({ required: true }) courseId: string;
  @Prop({ required: true }) status: string; // success | failed
  @Prop() resultCount: number;
  @Prop() durationMs: number;
  @Prop() errorMessage: string;
  created_at: Date;
}

export const SyncLogSchema = SchemaFactory.createForClass(SyncLog);
