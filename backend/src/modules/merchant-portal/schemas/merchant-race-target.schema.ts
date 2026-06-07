import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * F-070 BR-70-07/08/09 — Merchant per-race ticket target.
 *
 * BTC (Race Organizer) tự nhập mục tiêu số vé cho 1 giải. Forecast chart dùng
 * giá trị này làm mốc tham chiếu (đường target). KHÔNG ảnh hưởng projection.
 *
 * Store strategy (Manager APPROVED 2026-06-07): collection MỚI, empty-start,
 * upsert dần (KHÔNG migration data). 1 doc / raceId (unique index).
 *
 * Write path: `MerchantPortalService.setTicketTarget` — assertRaceForUser TRƯỚC
 * upsert (BR-70-08 IDOR). `target=0` ⇒ forecast output target=null (xoá mục tiêu).
 *
 * Indexes:
 *  - { raceId: 1 } unique — 1 target / race, upsert idempotent (BR-70-10 concurrent).
 */
@Schema({ collection: 'merchant_race_target', timestamps: true })
export class MerchantRaceTarget {
  /** MySQL race_id. Unique — 1 target per race. */
  @Prop({ type: Number, required: true })
  raceId!: number;

  /** Mục tiêu vé (integer ≥ 0). 0 = forecast hiển thị target=null. */
  @Prop({ type: Number, required: true, default: 0 })
  target!: number;

  /** Logto userId của BTC đã set mục tiêu (BR-70-08 audit). */
  @Prop({ type: String, required: true })
  updatedBy!: string;

  /**
   * Mongoose `timestamps: true` auto-injects these at runtime. Explicit
   * declaration here lets TypeScript see them so service mapping doesn't
   * need narrowed casts.
   */
  createdAt!: Date;
  updatedAt!: Date;
}

export type MerchantRaceTargetDocument = HydratedDocument<MerchantRaceTarget>;
export const MerchantRaceTargetSchema =
  SchemaFactory.createForClass(MerchantRaceTarget);

// BR-70-07 — 1 target per race, upsert idempotent under concurrent writes.
MerchantRaceTargetSchema.index({ raceId: 1 }, { unique: true });
