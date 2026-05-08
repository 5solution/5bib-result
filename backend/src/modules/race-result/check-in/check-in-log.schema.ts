import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CheckInLogDocument = HydratedDocument<CheckInLog>;

/**
 * F-015 BR-CK-15 — Audit log for every successful check-in.
 *
 * Retention: forever (race-day audit trail). Does NOT store name / CMND /
 * email — only `athlete_id` FK to RaceMasterData athlete (BR-CK-10 PII
 * boundary). Athlete deletion is handled at user/athlete schema level.
 *
 * Schema NOTE: race id is `mysql_race_id: number` to match RaceMasterData
 * convention (vendor MySQL legacy IDs are numeric, NOT Mongo ObjectIds).
 *
 * Indexes:
 *  - {mysql_race_id: 1, checked_in_at: -1} → recent feed queries
 *  - {mysql_race_id: 1, bib_number: 1} → per-BIB audit lookup
 */
@Schema({
  collection: 'check_in_logs',
  timestamps: { createdAt: 'created_at', updatedAt: false },
})
export class CheckInLog {
  /** FK to legacy `races.race_id`. Matches RaceMasterData. */
  @Prop({ required: true, index: true })
  mysql_race_id: number;

  @Prop({ required: true })
  bib_number: string;

  /** FK to RaceAthlete.athletes_id (NOT name / CMND). */
  @Prop({ required: true })
  athletes_id: number;

  @Prop({ required: true, default: () => new Date() })
  checked_in_at: Date;

  /** LogtoAdmin user id (BR-CK-11). Optional null for system writes. */
  @Prop({ type: String, default: null })
  checked_in_by: string | null;

  /** Station ID 1-10. */
  @Prop({ required: true })
  station_id: string;

  /** BR-CK source field — qr | bib | cmnd. */
  @Prop({ required: true, enum: ['qr', 'bib', 'cmnd'] })
  source: 'qr' | 'bib' | 'cmnd';

  /** Phase 1 always 'synced'; Phase 2 will use queued/synced/failed for offline. */
  @Prop({ required: true, default: 'synced' })
  sync_status: string;

  created_at?: Date;
}

export const CheckInLogSchema = SchemaFactory.createForClass(CheckInLog);
CheckInLogSchema.index({ mysql_race_id: 1, checked_in_at: -1 });
CheckInLogSchema.index({ mysql_race_id: 1, bib_number: 1 });
