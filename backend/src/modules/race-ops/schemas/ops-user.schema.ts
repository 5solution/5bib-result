import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OpsUserDocument = HydratedDocument<OpsUser>;

export type OpsRole = 'ops_admin' | 'ops_leader' | 'ops_crew' | 'ops_tnv';

export type OpsUserStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ACTIVE';

@Schema({ _id: false })
export class OpsEmergencyContact {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  phone: string;
}
export const OpsEmergencyContactSchema = SchemaFactory.createForClass(OpsEmergencyContact);

@Schema({
  collection: 'ops_users',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class OpsUser {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true })
  phone: string; // unique per event

  @Prop()
  email?: string; // optional, used for email+password login (leader/admin)

  @Prop({ required: true })
  full_name: string;

  @Prop()
  dob?: Date;

  @Prop({
    type: String,
    enum: ['ops_admin', 'ops_leader', 'ops_crew', 'ops_tnv'],
    required: true,
    index: true,
  })
  role: OpsRole;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  event_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, default: null, index: true })
  team_id: Types.ObjectId | null;

  /**
   * bcrypt hash. Chỉ có cho `ops_admin` và `ops_leader`.
   * Crew/TNV dùng QR token (see `qr_token` below), không login password.
   */
  @Prop()
  password_hash?: string;

  /**
   * QR token = opaque UUID-like, unique globally. Crew scan QR này check-in TNV.
   * Generate khi `status → APPROVED`. Store hash, không plain.
   */
  @Prop()
  qr_token_hash?: string;

  @Prop({ type: OpsEmergencyContactSchema })
  emergency_contact?: OpsEmergencyContact;

  @Prop()
  experience?: string;

  @Prop()
  shift_preferences?: string; // raw text TNV ghi vào form

  @Prop({
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'ACTIVE'],
    default: 'PENDING',
    index: true,
  })
  status: OpsUserStatus;

  @Prop()
  rejected_reason?: string;

  @Prop({ type: Types.ObjectId, default: null })
  approved_by: Types.ObjectId | null;

  @Prop()
  approved_at?: Date;

  @Prop({ type: Date, default: null, index: true })
  deleted_at: Date | null;

  created_at: Date;
  updated_at: Date;
}

export const OpsUserSchema = SchemaFactory.createForClass(OpsUser);

OpsUserSchema.index({ event_id: 1, phone: 1 }, { unique: true });
OpsUserSchema.index({ event_id: 1, team_id: 1, role: 1 });
OpsUserSchema.index({ event_id: 1, status: 1 });
OpsUserSchema.index({ qr_token_hash: 1 }, { sparse: true, unique: true });
// Email unique sparse: only enforced when email present (admin/leader)
OpsUserSchema.index({ email: 1 }, { sparse: true, unique: true });
