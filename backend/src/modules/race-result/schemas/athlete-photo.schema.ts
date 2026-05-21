/**
 * FEATURE-047 Phase 1B — Athlete Photo collection (user-upload with moderation).
 *
 * BR-47-11..18: user-auth upload (LogtoAuthGuard) → EXIF strip via sharp →
 * S3 store → admin moderation gate (pending → approved/rejected) → signed
 * URL 24h TTL public read (Manager Adjustment #11 PII defense).
 *
 * Anti-spam: max 10 pending per athleteSlug.
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AthletePhotoType = 'selfie' | 'bib_photo' | 'finish_line';
export type AthletePhotoStatus = 'pending' | 'approved' | 'rejected';

@Schema({ collection: 'athlete_photos', timestamps: true })
export class AthletePhoto {
  @Prop({ required: true, index: true })
  athleteSlug: string; // FK to athlete_profiles.slug (NOT athleteId — survives slug rename)

  @Prop({
    required: true,
    enum: ['selfie', 'bib_photo', 'finish_line'],
  })
  type: AthletePhotoType;

  /** S3 key — NEVER public URL. Signed URL generated on read (Adjustment #11). */
  @Prop({ required: true })
  s3Key: string;

  /** mime detected from magic bytes (not header). */
  @Prop({ required: true, enum: ['image/jpeg', 'image/png', 'image/webp'] })
  mime: 'image/jpeg' | 'image/png' | 'image/webp';

  @Prop({ required: true })
  sizeBytes: number;

  @Prop({
    required: true,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true,
  })
  status: AthletePhotoStatus;

  /** Logto userId of uploader — internal only, NEVER expose public DTO. */
  @Prop({ required: true })
  uploadedByUserId: string;

  @Prop()
  raceId?: string;

  @Prop()
  bib?: string;

  /** Set true after sharp().rotate() strips EXIF. Always true post-upload. */
  @Prop({ required: true, default: true })
  exifStripped: boolean;

  /** Admin moderation metadata. */
  @Prop()
  moderatedBy?: string;

  @Prop()
  moderatedAt?: Date;

  @Prop()
  rejectionReason?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export type AthletePhotoDocument = AthletePhoto & Document;
export const AthletePhotoSchema = SchemaFactory.createForClass(AthletePhoto);

// Public read query: approved photos per slug, sort newest first
AthletePhotoSchema.index({ athleteSlug: 1, status: 1, createdAt: -1 });
// Admin moderation queue: pending photos sort oldest first (FIFO)
AthletePhotoSchema.index({ status: 1, createdAt: 1 });
// Anti-spam count query
AthletePhotoSchema.index({ athleteSlug: 1, status: 1 });
