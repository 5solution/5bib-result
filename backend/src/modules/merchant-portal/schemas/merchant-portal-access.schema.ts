import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export const MERCHANT_PORTAL_PERMISSION_VALUES = [
  'ticket_report',
  'revenue_report',
] as const;

export type MerchantPortalPermission =
  (typeof MERCHANT_PORTAL_PERMISSION_VALUES)[number];

@Schema({ _id: false })
export class RaceOverrides {
  @Prop({ type: [Number], default: [] })
  include: number[];

  @Prop({ type: [Number], default: [] })
  exclude: number[];
}

export const RaceOverridesSchema = SchemaFactory.createForClass(RaceOverrides);

@Schema({ collection: 'merchant_portal_access', timestamps: true })
export class MerchantPortalAccess {
  @Prop({ type: String, required: true, index: true })
  userId: string;

  @Prop({ type: String, required: true })
  userName: string;

  @Prop({ type: String, required: true })
  email: string;

  @Prop({ type: [Number], default: [] })
  tenantIds: number[];

  @Prop({
    type: RaceOverridesSchema,
    default: () => ({ include: [], exclude: [] }),
  })
  raceOverrides: RaceOverrides;

  @Prop({
    type: [String],
    enum: MERCHANT_PORTAL_PERMISSION_VALUES,
    default: ['ticket_report'],
  })
  permissions: MerchantPortalPermission[];

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: String, required: true })
  createdBy: string;

  @Prop({ type: String })
  updatedBy?: string;

  createdAt: Date;
  updatedAt: Date;
}

export type MerchantPortalAccessDocument =
  HydratedDocument<MerchantPortalAccess>;

export const MerchantPortalAccessSchema =
  SchemaFactory.createForClass(MerchantPortalAccess);

MerchantPortalAccessSchema.index({ userId: 1 }, { unique: true });
MerchantPortalAccessSchema.index({ tenantIds: 1 });
MerchantPortalAccessSchema.index({ isActive: 1, userId: 1 });
