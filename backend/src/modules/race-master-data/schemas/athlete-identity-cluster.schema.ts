/**
 * FEATURE-048 Phase 2 — Athlete Identity Cluster collection (BR-48-11/12).
 *
 * Pre-computed offline cluster (24h cron) — persistent identity ID survives
 * bib/name changes. F-047 reads this collection instead of slug-coincidence match.
 *
 * 3-tier algorithm (BR-48-12):
 *   T1 email exact      confidence 1.0  → auto-merge strong signal
 *   T2 name+DOB+gender  confidence 0.85 → auto-merge medium
 *   T3 name+gender only confidence 0.6  → manual review queue
 *   T4 single-race      confidence 0.0  → anonymous athlete scope (no merge)
 *
 * PII DEFENSE: emailHash SHA256 only — raw email NEVER stored in cluster.
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ _id: false })
export class LinkedAthleteRecord {
  @Prop({ required: true }) mysql_race_id: number;
  @Prop({ required: true }) athletes_id: number;
  @Prop({ type: String, default: null }) bib_number: string | null;
  @Prop({ type: String, default: null }) mongoRaceId: string | null;
  @Prop({ type: String, default: null }) mongoBib: string | null;
  @Prop({ type: String, default: null }) fullName: string | null;
}
export const LinkedAthleteRecordSchema =
  SchemaFactory.createForClass(LinkedAthleteRecord);

export type AthleteIdentityClusterDocument =
  HydratedDocument<AthleteIdentityCluster>;

@Schema({
  collection: 'athlete_identity_clusters',
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
})
export class AthleteIdentityCluster {
  @Prop({ required: true, unique: true, index: true })
  clusterId: string; // UUID v4

  /**
   * SHA256(email_lowercase_trim) — primary anchor T1.
   * NEVER raw email. Logger output uses [emailHash:abc12345] proxy format.
   */
  @Prop({ type: String, index: true, sparse: true })
  emailHash: string | null;

  @Prop({ type: String, default: null })
  nameSlug: string | null;

  /** Year only (e.g. 1985) — F-019 v2 DOB privacy isolation. */
  @Prop({ type: Number, default: null })
  dobYear: number | null;

  @Prop({ type: String, enum: ['male', 'female', 'other', null], default: null })
  genderNormalized: 'male' | 'female' | 'other' | null;

  @Prop({ type: [LinkedAthleteRecordSchema], default: [] })
  linkedAthleteRecords: LinkedAthleteRecord[];

  @Prop({ required: true, min: 0, max: 1 })
  confidence: number;

  @Prop({
    required: true,
    enum: ['email', 'name+dob', 'name+gender', 'manual', 'review_pending'],
    index: true,
  })
  source:
    | 'email'
    | 'name+dob'
    | 'name+gender'
    | 'manual'
    | 'review_pending';

  @Prop({ type: String, default: null })
  moderatedBy: string | null;

  @Prop({ type: Date, default: null })
  moderatedAt: Date | null;

  /** If split from parent cluster, parent clusterId reference (audit trail). */
  @Prop({ type: String, default: null })
  splitFromClusterId: string | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const AthleteIdentityClusterSchema = SchemaFactory.createForClass(
  AthleteIdentityCluster,
);

// Compound indexes for clustering algorithm lookups
AthleteIdentityClusterSchema.index({ nameSlug: 1, dobYear: 1 });
AthleteIdentityClusterSchema.index({ source: 1, confidence: -1 }); // review queue
AthleteIdentityClusterSchema.index({ updatedAt: -1 });
