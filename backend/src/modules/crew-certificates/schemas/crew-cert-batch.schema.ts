import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import {
  PhotoArea,
  PhotoAreaSchema,
  TemplateCanvas,
  TemplateCanvasSchema,
  TemplateLayer,
  TemplateLayerSchema,
} from '../../certificates/schemas/certificate-template.schema';

/**
 * FEATURE-090 — embedded template của đợt GCN (decouple race_id của
 * CertificateTemplate). Reuse các sub-schema từ certificates. Map sang
 * `RenderableTemplate` khi gọi CertificateRenderService.render().
 */
@Schema({ _id: false })
export class CrewTemplate {
  @Prop({ type: TemplateCanvasSchema, required: true })
  canvas!: TemplateCanvas;

  @Prop({ type: [TemplateLayerSchema], default: [] })
  layers!: TemplateLayer[];

  @Prop({ type: PhotoAreaSchema, default: null })
  photoArea?: PhotoArea | null;

  @Prop({ type: String, default: null })
  placeholderPhotoUrl?: string | null;

  @Prop({ type: Boolean, default: false })
  photoBehindBackground?: boolean;
}
export const CrewTemplateSchema = SchemaFactory.createForClass(CrewTemplate);

/** FEATURE-090 — `crew_cert_batches`: 1 doc = 1 đợt GCN cho 1 sự kiện. */
@Schema({ collection: 'crew_cert_batches', timestamps: true })
export class CrewCertBatch {
  @Prop({ type: String, required: true, unique: true, index: true })
  slug!: string;

  @Prop({ type: String, required: true })
  eventName!: string;

  @Prop({ type: CrewTemplateSchema, default: null })
  template?: CrewTemplate | null;

  /** Nhãn các cột thông tin thêm (extraFields) — hiển thị admin. */
  @Prop({ type: [String], default: [] })
  extraFields!: string[];

  @Prop({ type: Boolean, required: true, default: true })
  active!: boolean;

  /** Logto userId — internal, KHÔNG leak. */
  @Prop({ type: String })
  createdBy?: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export type CrewCertBatchDocument = CrewCertBatch & Document;
export const CrewCertBatchSchema = SchemaFactory.createForClass(CrewCertBatch);
