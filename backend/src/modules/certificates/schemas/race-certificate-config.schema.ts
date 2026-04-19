import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RaceCertificateConfigDocument =
  HydratedDocument<RaceCertificateConfig>;

@Schema({ _id: false })
export class CourseTemplateOverride {
  @Prop({ required: true }) course_id: string;
  @Prop({ type: Types.ObjectId, default: null })
  template_certificate?: Types.ObjectId | null;
  @Prop({ type: Types.ObjectId, default: null })
  template_share_card?: Types.ObjectId | null;
}
export const CourseTemplateOverrideSchema = SchemaFactory.createForClass(
  CourseTemplateOverride,
);

@Schema({
  collection: 'race_certificate_configs',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class RaceCertificateConfig {
  _id: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true })
  race_id: string;

  @Prop({ type: Types.ObjectId, default: null })
  default_template_certificate?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, default: null })
  default_template_share_card?: Types.ObjectId | null;

  @Prop({ type: [CourseTemplateOverrideSchema], default: [] })
  course_overrides: CourseTemplateOverride[];

  @Prop({ default: true }) enabled: boolean;

  created_at: Date;
  updated_at: Date;
}

export const RaceCertificateConfigSchema = SchemaFactory.createForClass(
  RaceCertificateConfig,
);
