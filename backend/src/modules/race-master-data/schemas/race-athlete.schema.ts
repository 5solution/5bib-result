import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type RaceAthleteDocument = HydratedDocument<RaceAthlete>;

/**
 * Cached athlete snapshot per race. Single source of truth cho athlete
 * pre-race data (BIB, name, course, racekit status). Đọc từ MySQL legacy
 * `'platform'` connection → cache vào MongoDB → consumer modules
 * (chip-verify, checkpoint-capture) chỉ inject `RaceAthleteLookupService`.
 *
 * PII fields (email/phone/cccd) marked `select: false` — public view
 * KHÔNG return. Admin caller phải explicit `.select('+email')` hoặc dùng
 * lookupByBibAdmin().
 */
@Schema({
  collection: 'race_athletes',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class RaceAthlete {
  /** FK to legacy `races.race_id`. */
  @Prop({ required: true, index: true })
  mysql_race_id: number;

  /** FK to legacy `athletes.athletes_id`. PRIMARY identifier. */
  @Prop({ required: true })
  athletes_id: number;

  @Prop({ type: String, default: null })
  bib_number: string | null;

  // ── Display fields (allowlist — KHÔNG có PII) ──

  /** Display priority: bib_name fallback full_name. Used by kiosk + leaderboard. */
  @Prop({ type: String, default: null })
  display_name: string | null;

  /** Tên trên BIB từ subinfo.name_on_bib (có thể là nickname). */
  @Prop({ type: String, default: null })
  bib_name: string | null;

  /** Họ tên đầy đủ từ athletes.name — verify CCCD. */
  @Prop({ type: String, default: null })
  full_name: string | null;

  /** Normalized: 'Nam' | 'Nữ' | 'Khác' | null. */
  @Prop({ type: String, default: null })
  gender: string | null;

  @Prop({ type: Number, default: null })
  course_id: number | null;

  @Prop({ type: String, default: null })
  course_name: string | null;

  @Prop({ type: String, default: null })
  course_distance: string | null;

  @Prop({ type: String, default: null })
  club: string | null;

  @Prop({ type: Number, default: null })
  ticket_type_id: number | null;

  /**
   * Vật phẩm BTC giao kèm racekit từ MySQL legacy `athlete_subinfo.achievements`.
   * Free-form text (VD: "Mũ", "Áo+Mũ"). Display-only — KHÔNG parse, FE render raw.
   * Race 192 pilot 2026-05-02: 930/3267 = "Mũ".
   */
  @Prop({ type: String, default: null })
  items: string | null;

  // ── Status fields ──

  @Prop({ type: String, default: null })
  last_status: string | null;

  @Prop({ default: false })
  racekit_received: boolean;

  @Prop({ type: Date, default: null })
  racekit_received_at: Date | null;

  // ── Sync metadata ──

  @Prop({ required: true, default: 'mysql_platform' })
  source: string;

  @Prop({ type: Date, default: null })
  legacy_modified_on: Date | null;

  @Prop({ required: true, default: () => new Date() })
  synced_at: Date;

  @Prop({ default: 1 })
  sync_version: number;

  // ── Optional PII fields (admin only — select: false) ──

  @Prop({ type: String, select: false, default: null })
  email: string | null;

  @Prop({ type: String, select: false, default: null })
  contact_phone: string | null;

  @Prop({ type: String, select: false, default: null })
  id_number: string | null;
}

export const RaceAthleteSchema = SchemaFactory.createForClass(RaceAthlete);

// Composite uniques + lookup indexes.
// `athletes_id` là primary identifier (always present). `bib_number` có thể null
// trước khi BTC gán BIB ở Bàn 1 → partial filter để cho phép multiple null.
RaceAthleteSchema.index(
  { mysql_race_id: 1, athletes_id: 1 },
  { unique: true },
);
RaceAthleteSchema.index(
  { mysql_race_id: 1, bib_number: 1 },
  {
    unique: true,
    partialFilterExpression: { bib_number: { $type: 'string' } },
  },
);
RaceAthleteSchema.index({ mysql_race_id: 1, course_id: 1 });
RaceAthleteSchema.index({ mysql_race_id: 1, last_status: 1 });
RaceAthleteSchema.index({ legacy_modified_on: 1 });
