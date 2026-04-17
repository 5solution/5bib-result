import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OpsSupplyItemDocument = HydratedDocument<OpsSupplyItem>;

/**
 * Master SKU list per event. Admin setup trước khi Leader order.
 * Excel `Tổng` sheet của file "Order Vật Tư" parse vào collection này ở Sprint 4.
 */
@Schema({
  collection: 'ops_supply_items',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class OpsSupplyItem {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  event_id: Types.ObjectId;

  @Prop({ required: true })
  sku: string; // "WATER_500ML", "BARRIER_FENCE"

  @Prop({ required: true })
  name: string; // "Nước Lavie 500ml"

  @Prop()
  description?: string;

  @Prop({ required: true })
  unit: string; // "thùng", "chai", "cái", "cuộn"

  @Prop({ required: true, index: true })
  category: string; // "nước", "y_tế", "cone", "đàm"

  @Prop()
  default_price?: number;

  @Prop({ type: Date, default: null, index: true })
  deleted_at: Date | null;

  created_at: Date;
  updated_at: Date;
}

export const OpsSupplyItemSchema = SchemaFactory.createForClass(OpsSupplyItem);

// Unique chỉ enforce trên SKU chưa soft-delete — cho phép recreate sau khi archive.
OpsSupplyItemSchema.index(
  { event_id: 1, sku: 1 },
  { unique: true, partialFilterExpression: { deleted_at: null } },
);
OpsSupplyItemSchema.index({ event_id: 1, category: 1 });
