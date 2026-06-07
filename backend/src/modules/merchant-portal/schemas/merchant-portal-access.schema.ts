import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * F-069 M2a BR-MP-04 — Merchant Portal Access Config schema.
 *
 * Maps Logto user → assigned tenants/races + permission level. 5BIB Back-Office
 * Admin (admin.5bib.com `/merchant-portal` route) manages this collection.
 *
 * Resolution logic (BR-MP-05 R1) — `MerchantPortalService.resolveAccessibleRaces`:
 *   assignedRaces = (all non-draft races của tenantIds[])
 *                   ∪ raceOverrides.include[]
 *                   − raceOverrides.exclude[]
 *
 * Indexes:
 *  - { userId: 1 } unique — primary lookup by Logto userId
 *  - { tenantIds: 1 } multi-key — reverse lookup "tenant X có user nào"
 *  - { isActive: 1, userId: 1 } compound — active user filter cho auth flow
 *
 * Hard delete strategy (BR-MP-16): admin "Xóa" → record removed permanently.
 * Audit log persists history. Inactive toggle (`isActive=false`) for "tạm vô hiệu hóa".
 */

export const MERCHANT_PORTAL_PERMISSION_VALUES = [
  'ticket_report',
  'revenue_report',
] as const;

export type MerchantPortalPermission =
  (typeof MERCHANT_PORTAL_PERMISSION_VALUES)[number];

@Schema({ _id: false })
export class RaceOverrides {
  @Prop({ type: [Number], default: [] })
  include!: number[];

  @Prop({ type: [Number], default: [] })
  exclude!: number[];
}

export const RaceOverridesSchema = SchemaFactory.createForClass(RaceOverrides);

@Schema({ collection: 'merchant_portal_access', timestamps: true })
export class MerchantPortalAccess {
  @Prop({ type: String, required: true, index: true })
  userId!: string;

  @Prop({ type: String, required: true })
  userName!: string;

  @Prop({ type: String, required: true })
  email!: string;

  /** MySQL tenant_id array. Cross-tenant allowed (agency model — BR-MP-21). */
  @Prop({ type: [Number], default: [] })
  tenantIds!: number[];

  /** Per-race override (Option C — Danny chốt PAUSE-069-02). */
  @Prop({ type: RaceOverridesSchema, default: () => ({ include: [], exclude: [] }) })
  raceOverrides!: RaceOverrides;

  /**
   * Permission levels:
   *   ['ticket_report']                    → viewer-equivalent (ticket sales only)
   *   ['ticket_report', 'revenue_report']  → finance-equivalent (full reports)
   *
   * NOTE: Permission tier mirrors Logto role (`merchant_viewer` / `merchant_finance`).
   * Source of truth cho enforcement is Logto role + scope (M1 guards). This field
   * is DENORMALIZED admin config to drive UI render logic (which tab visible) and
   * data scoping (which endpoints user can call). Drift acceptable — guards reject
   * mismatched roles regardless.
   */
  @Prop({
    type: [String],
    enum: MERCHANT_PORTAL_PERMISSION_VALUES,
    default: ['ticket_report'],
  })
  permissions!: MerchantPortalPermission[];

  /** Soft disable (BR-MP-20). Admin toggle without delete. */
  @Prop({ type: Boolean, default: true })
  isActive!: boolean;

  /** Admin userId who created (BR-MP-17 audit). */
  @Prop({ type: String, required: true })
  createdBy!: string;

  /** Admin userId who last updated (BR-MP-17 audit). */
  @Prop({ type: String })
  updatedBy?: string;

  /**
   * Mongoose `timestamps: true` auto-injects these at runtime. Explicit
   * declaration here lets TypeScript see them so service mapping doesn't
   * need narrowed casts.
   */
  createdAt!: Date;
  updatedAt!: Date;
}

export type MerchantPortalAccessDocument =
  HydratedDocument<MerchantPortalAccess>;
export const MerchantPortalAccessSchema =
  SchemaFactory.createForClass(MerchantPortalAccess);

// Indexes per BR-MP-04
MerchantPortalAccessSchema.index({ userId: 1 }, { unique: true });
MerchantPortalAccessSchema.index({ tenantIds: 1 });
MerchantPortalAccessSchema.index({ isActive: 1, userId: 1 });
