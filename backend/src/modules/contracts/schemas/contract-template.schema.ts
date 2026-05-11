import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ContractTemplateDocument = HydratedDocument<ContractTemplate>;

@Schema({ _id: false })
export class TemplateVariable {
  @Prop({ required: true }) key: string;
  @Prop({ required: true }) label: string;
  @Prop() source: string;
}
export const TemplateVariableSchema =
  SchemaFactory.createForClass(TemplateVariable);

/**
 * F-024 UX-39 v3 Task 3 — Default line items per template.
 *
 * Mỗi contract type có thể có default `lineItems` config (cột STT / Mô tả /
 * ĐVT / Số lượng / Đơn giá / Thành tiền). Khi admin tạo HĐ mới, line items
 * sẽ pre-populate từ default này → user sửa per HĐ. Lưu ở template level
 * vì line items thường lặp lại (chip + cổng + nhân sự cho TIMING, etc.).
 */
@Schema({ _id: false })
export class LineItemTemplate {
  @Prop({ required: true }) description: string;
  @Prop({ default: '' }) unit: string;
  @Prop({ default: 1 }) quantity: number;
  @Prop({ default: 0 }) unitPrice: number;
  @Prop({ default: 0 }) discount: number;
  @Prop({ default: '' }) note: string;
}
export const LineItemTemplateSchema =
  SchemaFactory.createForClass(LineItemTemplate);

@Schema({
  collection: 'contract_templates',
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
})
export class ContractTemplate {
  _id: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['TICKET_SALES', 'TIMING', 'RACEKIT', 'OPERATIONS'],
    unique: true,
    index: true,
  })
  contractType: string;

  /** Map<articleKey, articleText>. Override of default-templates.ts */
  @Prop({ type: Object, default: {} })
  articles: Record<string, string>;

  @Prop({ type: [TemplateVariableSchema], default: [] })
  variables: TemplateVariable[];

  /**
   * F-024 UX-39 v3 Task 3 — Default phụ lục line items config.
   * Empty array = admin nhập per HĐ qua Service Catalog (giữ behavior cũ).
   */
  @Prop({ type: [LineItemTemplateSchema], default: [] })
  defaultLineItems: LineItemTemplate[];

  @Prop() lastEditedBy: string;

  createdAt: Date;
  updatedAt: Date;
}

export const ContractTemplateSchema =
  SchemaFactory.createForClass(ContractTemplate);
