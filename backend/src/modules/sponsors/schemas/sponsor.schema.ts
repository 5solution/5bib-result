import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SponsorDocument = HydratedDocument<Sponsor>;

@Schema({
  collection: 'sponsors',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class Sponsor {
  _id: string;

  @Prop({ required: true }) name: string;
  @Prop({ required: true }) logoUrl: string;
  @Prop() website: string;
  @Prop({ required: true, enum: ['silver', 'gold', 'diamond'], default: 'silver' })
  level: string;
  @Prop({ default: 0 }) order: number;
  @Prop() raceId: string; // Optional: if set, sponsor is race-specific; if null/empty, it's global
  @Prop({ default: true }) isActive: boolean;

  created_at: Date;
  updated_at: Date;
}

export const SponsorSchema = SchemaFactory.createForClass(Sponsor);
