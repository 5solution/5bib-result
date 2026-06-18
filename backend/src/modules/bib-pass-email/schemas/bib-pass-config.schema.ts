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
 * FEATURE-091 — phôi Border Pass nhúng trong config (decouple race_id của
 * CertificateTemplate). Reuse các sub-schema từ certificates (giống F-090
 * CrewTemplate). Map sang `RenderableTemplate` khi render.
 */
@Schema({ _id: false })
export class BibPassTemplate {
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
export const BibPassTemplateSchema = SchemaFactory.createForClass(BibPassTemplate);

/**
 * FEATURE-091 — các trường tĩnh admin nhập per-race (token render). VĐV name/bib
 * lấy tự động từ athletes; những trường này admin tự cấu hình.
 */
@Schema({ _id: false })
export class BibPassStaticFields {
  @Prop({ type: String, default: '' })
  location!: string;

  @Prop({ type: String, default: '' })
  raceDay!: string;

  @Prop({ type: String, default: '' })
  distance!: string;

  /** Tiền tố passport: render {passport_no} = passportPrefix + bib. */
  @Prop({ type: String, default: '' })
  passportPrefix!: string;
}
export const BibPassStaticFieldsSchema =
  SchemaFactory.createForClass(BibPassStaticFields);

/** FEATURE-091 — nội dung email kèm pass. */
@Schema({ _id: false })
export class BibPassEmail {
  @Prop({ type: String, default: '[5BIB] Border Pass của bạn' })
  subject!: string;

  /** HTML body. Token {name}/{bib}/{event_name} interpolate khi gửi. */
  @Prop({ type: String, default: '' })
  bodyHtml!: string;

  @Prop({ type: String, default: '5BIB' })
  fromName!: string;
}
export const BibPassEmailSchema = SchemaFactory.createForClass(BibPassEmail);

/**
 * FEATURE-091 — `bib_pass_configs`: 1 doc = cấu hình Border Pass cho 1 giải
 * (raceId = mysql `races.race_id`). `enabled` per-race switch (default false).
 */
@Schema({ collection: 'bib_pass_configs', timestamps: true })
export class BibPassConfig {
  /** mysql races.race_id — duy nhất 1 config / giải. */
  @Prop({ type: Number, required: true, unique: true, index: true })
  raceId!: number;

  /** Cache tên giải cho UI (không phải source-of-truth). */
  @Prop({ type: String, default: '' })
  raceName!: string;

  @Prop({ type: Boolean, required: true, default: false })
  enabled!: boolean;

  @Prop({ type: BibPassTemplateSchema, default: null })
  template?: BibPassTemplate | null;

  @Prop({ type: BibPassStaticFieldsSchema, default: () => ({}) })
  staticFields!: BibPassStaticFields;

  @Prop({ type: BibPassEmailSchema, default: () => ({}) })
  email!: BibPassEmail;

  /** Tên file PNG đính kèm (interpolate {bib}). */
  @Prop({ type: String, default: 'border-pass-{bib}.png' })
  attachmentFilename!: string;

  /** Logto userId — internal, KHÔNG leak public. */
  @Prop({ type: String })
  createdBy?: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export type BibPassConfigDocument = BibPassConfig & Document;
export const BibPassConfigSchema = SchemaFactory.createForClass(BibPassConfig);
