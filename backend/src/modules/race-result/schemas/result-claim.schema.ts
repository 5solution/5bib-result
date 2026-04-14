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
  @Prop({ required: true }) phone: string;
  @Prop({ required: true }) description: string;
  @Prop({ type: [String], default: [] }) attachments: string[]; // S3 URLs for tracklog files
  @Prop({ default: 'pending', index: true }) status: string; // pending | approved | rejected
  @Prop() adminNote: string;
  // Resolution fields (PRD BR-04)
  @Prop() resolvedBy: string;  // userId admin
  @Prop() resolvedAt: Date;
  @Prop() resolutionNote: string;
  @Prop({ default: false }) autoUpdated: boolean; // true when approved + result updated
  created_at: Date;
  updated_at: Date;
}

export const ResultClaimSchema = SchemaFactory.createForClass(ResultClaim);
