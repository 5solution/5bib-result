/**
 * FEATURE-047 Phase 1B — Athlete Profile collection schema.
 *
 * Cross-race identity persistence: links multiple race_results (multiple bibs)
 * to single canonical athlete profile via SHA256-hashed email (BR-47-08).
 *
 * **PII DEFENSE (Manager Adjustment #10):**
 * - `canonicalEmailHash` SHA256 — raw email NEVER stored
 * - Public DTO strip: name/bib/chipTime/gender/AG/club/PR/history allowed
 * - `linkedRaceIds` denormalized aggregate (cross-bib athletes get full history)
 * - `active` privacy opt-out flag (BR-47-05 → 404 when false)
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'athlete_profiles', timestamps: true })
export class AthleteProfile {
  @Prop({ required: true, unique: true, index: true })
  slug: string; // `<bib>-<name-kebab>` BR-47-01

  @Prop({ required: true })
  canonicalName: string;

  @Prop({ required: true })
  primaryBib: string; // most-recent race bib

  /** SHA256(email) — PII defense Adjustment #10. NEVER raw email. */
  @Prop({ index: true, sparse: true })
  canonicalEmailHash?: string;

  @Prop({ type: [String], default: [] })
  linkedBibs: string[]; // all bibs cross-linked via email hash

  @Prop({ type: [String], default: [] })
  linkedRaceIds: string[]; // MongoDB raceIds (Phase 1B) + MySQL race_ids (Phase 1B+1)

  @Prop({ enum: ['male', 'female', 'other'], required: false })
  gender?: 'male' | 'female' | 'other' | null;

  @Prop()
  nationality?: string;

  @Prop()
  club?: string;

  @Prop()
  ageGroupSnapshot?: string;

  @Prop({ required: true, default: 0 })
  totalRaces: number;

  @Prop({ required: true, default: 0 })
  totalFinished: number;

  @Prop({ required: true, default: 0 })
  totalDNF: number;

  /** Denormalized PR records [{distance, chipTime, raceId, raceSlug, raceDate}] */
  @Prop({ type: [Object], default: [] })
  prRecords: Array<{
    distance: '5K' | '10K' | 'HM' | 'FM';
    chipTime: string;
    raceId: string;
    raceSlug: string;
    raceTitle?: string;
    raceDate?: Date;
  }>;

  @Prop()
  avatarUrl?: string;

  @Prop()
  lastRaceDate?: Date;

  /** BR-47-05 privacy opt-out — false returns 404 on public profile read. */
  @Prop({ required: true, default: true, index: true })
  active: boolean;

  /** Soft delete marker. */
  @Prop()
  deletedAt?: Date;

  /** Cache marker — last time backfill cron recomputed this profile. */
  @Prop({ required: true })
  computedAt: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export type AthleteProfileDocument = AthleteProfile & Document;
export const AthleteProfileSchema =
  SchemaFactory.createForClass(AthleteProfile);

// Compound index for sitemap query (active + sort by lastRaceDate DESC)
AthleteProfileSchema.index({ active: 1, lastRaceDate: -1 });
// Compound for soft-delete filtering
AthleteProfileSchema.index({ deletedAt: 1, active: 1 });
