import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CostItemDocument = HydratedDocument<CostItem>;

export type CostCategory =
  | 'LABOR'
  | 'MATERIAL'
  | 'VENDOR'
  | 'OUTSOURCE'
  | 'OTHER';

export const COST_CATEGORIES: CostCategory[] = [
  'LABOR',
  'MATERIAL',
  'VENDOR',
  'OUTSOURCE',
  'OTHER',
];

/**
 * F-028 BR-PNL-03 — Cost item per contract.
 *
 * Lý do tách collection riêng (KHÔNG nhúng `Contract`): cost items có lifecycle
 * độc lập (edit anytime kể cả contract COMPLETED — BR-PNL-11) + audit log emit
 * mỗi mutation (BR-PNL-09) + soft delete (BR-PNL-10). Schema fields strict
 * theo PRD 4.1 — KHÔNG thêm field ngoài spec (PAUSE-CODE-028-A resolved
 * default: index `{ contractId: 1, deletedAt: 1 }` + `{ category: 1 }` +
 * `{ createdAt: -1 }`).
 */
@Schema({ collection: 'cost_items', timestamps: true })
export class CostItem {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Contract', required: true, index: true })
  contractId: Types.ObjectId;

  @Prop({ required: true, maxlength: 500 })
  description: string;

  @Prop({ required: true, enum: COST_CATEGORIES, index: true })
  category: CostCategory;

  @Prop({ required: true, min: 0 })
  amount: number; // VND, include VAT (BR-PNL-02)

  @Prop({ maxlength: 1000 })
  note?: string;

  /**
   * Free-format string theo precedent F-024 `Contract.raceDate` — admin nhập
   * "15/05/2026" hoặc "Tuần 1 tháng 5" tự do. KHÔNG ép Date format.
   */
  @Prop({ maxlength: 100 })
  incurredDate?: string;

  @Prop({ required: true })
  createdBy: string;

  @Prop()
  updatedBy?: string;

  /** Mongoose timestamps */
  createdAt: Date;
  updatedAt: Date;

  /** Soft delete (BR-PNL-10). null = active. */
  @Prop({ default: null, index: true })
  deletedAt: Date | null;
}

export const CostItemSchema = SchemaFactory.createForClass(CostItem);

// Compound query "active cost items per contract" — query path nóng nhất.
CostItemSchema.index({ contractId: 1, deletedAt: 1 });
CostItemSchema.index({ createdAt: -1 });
