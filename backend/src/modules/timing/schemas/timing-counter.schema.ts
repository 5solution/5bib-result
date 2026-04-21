import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TimingCounterDocument = HydratedDocument<TimingCounter>;

/**
 * Atomic counter used to generate monotonically-increasing lead_number.
 * Single document with _id = 'timing_lead' and a `seq` field.
 */
@Schema({ collection: 'timing_counters', timestamps: false })
export class TimingCounter {
  @Prop({ required: true })
  _id: string;

  @Prop({ required: true, default: 0 })
  seq: number;
}

export const TimingCounterSchema = SchemaFactory.createForClass(TimingCounter);
