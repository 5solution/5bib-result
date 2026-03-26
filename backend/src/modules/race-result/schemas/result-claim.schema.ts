import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ResultClaimDocument = HydratedDocument<ResultClaim>;

@Schema({
  collection: 'result_claims',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class ResultClaim {
  _id: string;
  @Prop({ required: true }) raceId: string;
  @Prop({ required: true }) courseId: string;
  @Prop({ required: true }) bib: string;
  @Prop({ required: true }) name: string;
  @Prop({ required: true }) email: string;
  @Prop({ required: true }) description: string;
  @Prop({ default: 'pending' }) status: string; // pending | resolved | rejected
  @Prop() adminNote: string;
  created_at: Date;
  updated_at: Date;
}

export const ResultClaimSchema = SchemaFactory.createForClass(ResultClaim);
