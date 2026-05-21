/**
 * FEATURE-046 — Race Recap Insight Schema (editorial 70/30 layer).
 * Per Manager Plan Adjustment #2 + #5: backend pre-render markdown → insightHtml,
 * publishedAt stays original on re-edit. BR-46-13/15..18/31..33.
 *
 * FEATURE-056 — ADD optional `spotlightStories` sub-document array (BR-56-03/20/23).
 * Backward-compat: existing docs without field stay readable; admin upsert flow
 * unchanged (field only written when admin curates).
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type RaceRecapInsightDocument = HydratedDocument<RaceRecapInsight>;

@Schema({ _id: false })
export class RecapSpotlightStorySub {
  @Prop({ required: true })
  courseId!: string;

  @Prop({ required: true, enum: ['M', 'F'] })
  gender!: 'M' | 'F';

  @Prop({ required: true })
  winnerBib!: string;

  @Prop({ required: true, maxlength: 600 })
  markdown!: string;

  @Prop({ required: true })
  html!: string;
}

export const RecapSpotlightStorySubSchema =
  SchemaFactory.createForClass(RecapSpotlightStorySub);

@Schema({
  collection: 'race_recap_insights',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class RaceRecapInsight {
  _id!: string;

  @Prop({ required: true, index: true })
  raceId!: string;

  @Prop({ type: String, default: null, index: true })
  courseId?: string | null;

  @Prop({ required: true, maxlength: 2000 })
  insightMarkdown!: string;

  @Prop({ required: true })
  insightHtml!: string;

  @Prop({ required: true })
  authorUserId!: string;

  @Prop({ required: true })
  authorName!: string;

  @Prop({ type: Date, default: null })
  publishedAt?: Date | null;

  @Prop({ required: true, default: 1 })
  version!: number;

  /**
   * F-056 NEW (GAP #3) — Per-podium-winner editorial spotlight stories.
   * Optional sub-document array; absence => auto-gen fallback at read time.
   */
  @Prop({ type: [RecapSpotlightStorySubSchema], default: undefined })
  spotlightStories?: RecapSpotlightStorySub[];

  created_at!: Date;
  updated_at!: Date;
}

export const RaceRecapInsightSchema =
  SchemaFactory.createForClass(RaceRecapInsight);

RaceRecapInsightSchema.index(
  { raceId: 1, courseId: 1 },
  { unique: true, sparse: true },
);
