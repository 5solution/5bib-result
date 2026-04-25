import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CertificateTemplateDocument = HydratedDocument<CertificateTemplate>;

export const TEMPLATE_TYPES = ['certificate', 'share_card'] as const;
export type TemplateType = (typeof TEMPLATE_TYPES)[number];

export const LAYER_TYPES = ['text', 'image', 'shape', 'photo'] as const;
export type LayerType = (typeof LAYER_TYPES)[number];

export const SHAPE_TYPES = ['rect', 'rounded_rect', 'circle', 'line'] as const;
export type ShapeType = (typeof SHAPE_TYPES)[number];

export const TEXT_ALIGNS = ['left', 'center', 'right'] as const;
export type TextAlign = (typeof TEXT_ALIGNS)[number];

@Schema({ _id: false })
export class TemplateCanvas {
  @Prop({ required: true, min: 100, max: 4096 }) width: number;
  @Prop({ required: true, min: 100, max: 4096 }) height: number;
  @Prop({ default: '#ffffff' }) backgroundColor: string;
  @Prop() backgroundImageUrl?: string;
}
export const TemplateCanvasSchema = SchemaFactory.createForClass(TemplateCanvas);

@Schema({ _id: false })
export class TemplateLayer {
  @Prop({ required: true, enum: LAYER_TYPES }) type: LayerType;
  @Prop({ required: true }) x: number;
  @Prop({ required: true }) y: number;
  @Prop() width?: number;
  @Prop() height?: number;
  @Prop({ default: 1, min: 0, max: 1 }) opacity?: number;
  @Prop({ default: 0 }) rotation?: number;

  // Text layer fields
  @Prop() text?: string; // Static text OR template with {variable} tokens
  @Prop() fontFamily?: string; // e.g. "Inter", "Be Vietnam Pro"
  @Prop() fontSize?: number;
  @Prop() fontWeight?: string; // "400" | "700" | "900" | "bold"
  @Prop({ enum: TEXT_ALIGNS }) textAlign?: TextAlign;
  @Prop() color?: string;
  @Prop() letterSpacing?: number;
  @Prop() lineHeight?: number;

  // Image layer fields
  @Prop() imageUrl?: string;

  // Shape layer fields
  @Prop({ enum: SHAPE_TYPES }) shape?: ShapeType;
  @Prop() fill?: string;
  @Prop() stroke?: string;
  @Prop() strokeWidth?: number;
  @Prop() borderRadius?: number;

  // Photo layer fields (runner photo slot)
  @Prop() photoBorderRadius?: number;
  @Prop() photoBorderColor?: string;
  @Prop() photoBorderWidth?: number;
}
export const TemplateLayerSchema = SchemaFactory.createForClass(TemplateLayer);

@Schema({ _id: false })
export class PhotoArea {
  @Prop({ required: true }) x: number;
  @Prop({ required: true }) y: number;
  @Prop({ required: true }) width: number;
  @Prop({ required: true }) height: number;
  @Prop({ default: 0 }) borderRadius?: number;
}
export const PhotoAreaSchema = SchemaFactory.createForClass(PhotoArea);

@Schema({
  collection: 'certificate_templates',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class CertificateTemplate {
  _id: Types.ObjectId;

  @Prop({ required: true, trim: true }) name: string;

  @Prop({ required: true, index: true }) race_id: string;

  @Prop({ default: null, index: true }) course_id?: string | null;

  @Prop({ required: true, enum: TEMPLATE_TYPES, index: true })
  type: TemplateType;

  @Prop({ type: TemplateCanvasSchema, required: true })
  canvas: TemplateCanvas;

  @Prop({ type: [TemplateLayerSchema], default: [] })
  layers: TemplateLayer[];

  @Prop({ type: PhotoAreaSchema, default: null })
  photo_area?: PhotoArea | null;

  @Prop() placeholder_photo_url?: string;

  /**
   * When true, photo_area and "photo" layers are rendered BELOW
   * canvas.backgroundImageUrl. Use when the bg image frame is a transparent
   * PNG with a cut-out window for the athlete photo (e.g., VMM finisher frame).
   */
  @Prop({ default: false }) photo_behind_background: boolean;

  @Prop({ default: false }) is_archived: boolean;

  created_at: Date;
  updated_at: Date;
}

export const CertificateTemplateSchema =
  SchemaFactory.createForClass(CertificateTemplate);

CertificateTemplateSchema.index({ race_id: 1, type: 1, is_archived: 1 });
CertificateTemplateSchema.index({ race_id: 1, course_id: 1, type: 1 });
