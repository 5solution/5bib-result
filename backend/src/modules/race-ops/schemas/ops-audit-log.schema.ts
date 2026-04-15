import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OpsAuditLogDocument = HydratedDocument<OpsAuditLog>;

/**
 * Audit log — mọi mutation state machine (approve/reject/dispatch/...) ghi vào đây.
 * TTL 1 năm (index { created_at: -1 } với expireAfterSeconds).
 */
@Schema({
  collection: 'ops_audit_logs',
  timestamps: { createdAt: 'created_at', updatedAt: false },
})
export class OpsAuditLog {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  event_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  user_id: Types.ObjectId;

  @Prop({ required: true })
  action: string; // "APPROVE_SUPPLY_ORDER", "REJECT_APPLICATION"

  @Prop({ required: true })
  entity_type: string; // "ops_supply_orders"

  @Prop({ type: Types.ObjectId, required: true, index: true })
  entity_id: Types.ObjectId;

  @Prop()
  from_state?: string;

  @Prop()
  to_state?: string;

  /**
   * Flexible payload — lưu snapshot request body, reason, diff.
   * Mongoose SchemaTypes.Mixed cho phép any JSON.
   */
  @Prop({ type: Object, default: {} })
  payload: Record<string, unknown>;

  @Prop()
  ip?: string;

  @Prop()
  user_agent?: string;

  created_at: Date;
}

export const OpsAuditLogSchema = SchemaFactory.createForClass(OpsAuditLog);

OpsAuditLogSchema.index({ event_id: 1, entity_type: 1, entity_id: 1 });
// TTL: auto-delete entries older than 1 year
OpsAuditLogSchema.index(
  { created_at: -1 },
  { expireAfterSeconds: 365 * 24 * 60 * 60 },
);
