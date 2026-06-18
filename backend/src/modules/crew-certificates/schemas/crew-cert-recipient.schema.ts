import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * FEATURE-090 — `crew_cert_recipients`: 1 doc = 1 crew trong 1 đợt GCN.
 * `normalizedName` = slugifyVN(fullName) cho tìm kiếm diacritic-insensitive.
 */
@Schema({ collection: 'crew_cert_recipients', timestamps: true })
export class CrewCertRecipient {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  batchId!: Types.ObjectId;

  @Prop({ type: String, required: true })
  fullName!: string;

  /** slugifyVN(fullName) — index cho search. */
  @Prop({ type: String, required: true, index: true })
  normalizedName!: string;

  @Prop({ type: String, required: true })
  position!: string;

  /** Cột tự do từ roster: key = slugifyVN(header). */
  @Prop({ type: Object, default: {} })
  extraFields!: Record<string, string>;

  @Prop({ type: String, default: null })
  photoUrl?: string | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type CrewCertRecipientDocument = CrewCertRecipient & Document;
export const CrewCertRecipientSchema =
  SchemaFactory.createForClass(CrewCertRecipient);
CrewCertRecipientSchema.index({ batchId: 1, normalizedName: 1 });
