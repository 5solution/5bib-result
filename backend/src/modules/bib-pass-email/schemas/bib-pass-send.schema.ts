import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BibPassSendStatus = 'sent' | 'failed' | 'skipped';

/**
 * FEATURE-091 — `bib_pass_sends`: idempotency ledger. 1 doc = 1 lần gửi (hoặc
 * thử gửi) Border Pass cho 1 VĐV trong 1 giải. Unique index {raceId, athletesId}
 * đảm bảo KHÔNG gửi trùng (BR-04): trước khi gửi, sender insert doc; trùng
 * (E11000) → coi như đã gửi → skip.
 */
@Schema({ collection: 'bib_pass_sends', timestamps: true })
export class BibPassSend {
  @Prop({ type: Number, required: true, index: true })
  raceId!: number;

  /** mysql athletes.athletes_id — khoá idempotency cùng raceId. */
  @Prop({ type: Number, required: true })
  athletesId!: number;

  @Prop({ type: String, default: '' })
  bib!: string;

  /** Email đích (log/troubleshoot — KHÔNG leak public). */
  @Prop({ type: String, default: '' })
  email!: string;

  @Prop({ type: String, required: true, default: 'sent' })
  status!: BibPassSendStatus;

  /** Lý do fail/skip (vd 'no_email', 'mail_error', 'kill_switch'). */
  @Prop({ type: String, default: null })
  failReason?: string | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type BibPassSendDocument = BibPassSend & Document;
export const BibPassSendSchema = SchemaFactory.createForClass(BibPassSend);
// BR-04 — idempotency: 1 VĐV / giải chỉ ghi 1 lần.
BibPassSendSchema.index({ raceId: 1, athletesId: 1 }, { unique: true });
