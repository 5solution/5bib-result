import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AthleteStarDocument = HydratedDocument<AthleteStar>;

@Schema({
  collection: 'athlete_stars',
  timestamps: { createdAt: 'starred_at', updatedAt: 'updated_at' },
})
export class AthleteStar {
  /** Clerk user ID */
  @Prop({ required: true, index: true })
  userId: string;

  /** Race Mongo _id (string) */
  @Prop({ required: true })
  raceId: string;

  @Prop({ required: true })
  courseId: string;

  @Prop({ required: true })
  bib: string;

  // ── Denormalized snapshot (do not re-sync) ──
  @Prop()
  athleteName: string;

  @Prop()
  athleteGender: string;

  @Prop()
  athleteCategory: string;

  @Prop()
  raceName: string;

  @Prop()
  raceSlug: string;

  @Prop()
  courseName: string;
}

export const AthleteStarSchema = SchemaFactory.createForClass(AthleteStar);

// Compound unique — 1 user không star trùng athlete
AthleteStarSchema.index(
  { userId: 1, raceId: 1, courseId: 1, bib: 1 },
  { unique: true },
);

// Query nhanh: danh sách của user theo thời gian
AthleteStarSchema.index({ userId: 1, starred_at: -1 });

// Query nhanh: check bib[] đã star trong course
AthleteStarSchema.index({ userId: 1, raceId: 1, courseId: 1 });
