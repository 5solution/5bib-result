import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ExportJobDocument = ExportJob & Document;

@Schema({ timestamps: true })
export class ExportJob {
  @Prop({ required: true, unique: true, index: true })
  jobId: string;

  @Prop({ required: true, enum: ['processing', 'done', 'failed'], default: 'processing' })
  status: 'processing' | 'done' | 'failed';

  /** S3 URL of the generated ZIP (set when status = done) */
  @Prop({ default: null })
  zipUrl: string | null;

  /** S3 key of the ZIP (for cleanup) */
  @Prop({ default: null })
  zipKey: string | null;

  /** Human-readable label, e.g. "Tháng 04/2026" */
  @Prop({ default: '' })
  label: string;

  @Prop({ default: 0 })
  totalItems: number;

  @Prop({ default: 0 })
  doneItems: number;

  @Prop({ default: null })
  errorMessage: string | null;

  /** File auto-expires after 24h */
  @Prop({ required: true, index: { expireAfterSeconds: 0 } })
  expiresAt: Date;
}

export const ExportJobSchema = SchemaFactory.createForClass(ExportJob);
