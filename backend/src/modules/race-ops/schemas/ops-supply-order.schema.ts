import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OpsSupplyOrderDocument = HydratedDocument<OpsSupplyOrder>;

export type OpsSupplyOrderStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'DISPATCHED'
  | 'RECEIVED';

/** Line item — snapshot tại thời điểm order, không ref SKU document. */
@Schema({ _id: false })
export class OpsSupplyOrderItem {
  @Prop({ required: true })
  sku: string;

  @Prop({ required: true })
  name: string; // snapshot — tránh lệch khi master SKU rename

  @Prop({ required: true })
  unit: string; // snapshot

  @Prop({ required: true, min: 1 })
  quantity: number; // BR-04: quantity ≥ 1

  @Prop()
  note?: string;
}
export const OpsSupplyOrderItemSchema = SchemaFactory.createForClass(OpsSupplyOrderItem);

@Schema({
  collection: 'ops_supply_orders',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class OpsSupplyOrder {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  event_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  team_id: Types.ObjectId;

  // Unique index declared below với partialFilterExpression (soft-delete aware)
  @Prop({ required: true })
  order_code: string; // "ORD-WATER-20260415-001"

  @Prop({ type: Types.ObjectId, required: true })
  created_by: Types.ObjectId;

  @Prop({ type: [OpsSupplyOrderItemSchema], default: [] })
  items: OpsSupplyOrderItem[];

  @Prop({
    type: String,
    enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'DISPATCHED', 'RECEIVED'],
    default: 'DRAFT',
    index: true,
  })
  status: OpsSupplyOrderStatus;

  @Prop()
  submitted_at?: Date;

  @Prop()
  approved_at?: Date;

  @Prop({ type: Types.ObjectId, default: null })
  approved_by: Types.ObjectId | null;

  @Prop()
  rejected_reason?: string;

  @Prop()
  dispatched_at?: Date;

  @Prop({ type: Types.ObjectId, default: null })
  dispatched_by: Types.ObjectId | null;

  @Prop()
  received_at?: Date;

  @Prop({ type: Types.ObjectId, default: null })
  received_by: Types.ObjectId | null;

  @Prop({ type: [String], default: [] })
  received_proof_urls: string[]; // S3 URLs (prefix /race-ops/{eventId}/supply/)

  @Prop({ type: Date, default: null, index: true })
  deleted_at: Date | null;

  created_at: Date;
  updated_at: Date;
}

export const OpsSupplyOrderSchema = SchemaFactory.createForClass(OpsSupplyOrder);

OpsSupplyOrderSchema.index({ event_id: 1, team_id: 1, status: 1 });
OpsSupplyOrderSchema.index({ event_id: 1, status: 1 });
OpsSupplyOrderSchema.index({ event_id: 1, created_at: -1 });
// Order code globally unique nhưng chỉ enforce trên doc chưa soft-delete
OpsSupplyOrderSchema.index(
  { order_code: 1 },
  { unique: true, partialFilterExpression: { deleted_at: null } },
);
