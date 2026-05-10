import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PartnerDocument = HydratedDocument<Partner>;

@Schema({
  collection: 'partners',
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
})
export class Partner {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true }) entityName: string;
  @Prop() shortName: string;
  @Prop({ index: true, sparse: true }) taxId: string;
  @Prop() address: string;
  @Prop() representative: string;
  @Prop() position: string;
  @Prop() bankAccount: string;
  @Prop() bankName: string;
  @Prop() phone: string;
  @Prop() email: string;
  @Prop() notes: string;
  @Prop() createdBy: string;
  @Prop({ index: true }) deletedAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const PartnerSchema = SchemaFactory.createForClass(Partner);
