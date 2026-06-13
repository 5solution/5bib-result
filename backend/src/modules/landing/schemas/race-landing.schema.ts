import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  LANDING_SECTION_TYPES,
  LANDING_STATUSES,
  LandingSectionType,
  LandingStatus,
} from '../landing.constants';

/**
 * FEATURE-083 — `race_landings` collection. 1 doc = 1 landing = 1 race.
 *
 * Schema decisions (port F-027 + Manager Plan):
 *   - `sections[]` EMBEDDED subdoc array (read-heavy, atomic save, reorder =
 *     single doc update). `data: Mixed` per type; shape validated at DTO layer
 *     (BR-83-04/05/07).
 *   - Draft working copy lives at top level (meta/theme/domain/sections).
 *     PUBLISH freezes a copy into `publish.liveSnapshot` (BR-83-19). Public
 *     endpoint serves ONLY `liveSnapshot` — never the draft (BR-83-12 TC-83-12).
 *   - `domain.subdomain` sparse-unique-indexed; regex/reserved enforced at
 *     service layer (BR-83-16).
 */

@Schema({ _id: true, timestamps: false })
export class LandingSection {
  _id!: Types.ObjectId;

  @Prop({ type: String, required: true, enum: LANDING_SECTION_TYPES })
  type!: LandingSectionType;

  /** Variant within type (BR-83-07). Validated by `VARIANTS_BY_TYPE` at service. */
  @Prop({ type: String, required: true, default: 'default' })
  variant!: string;

  @Prop({ type: Boolean, required: true, default: true })
  enabled!: boolean;

  @Prop({ type: Number, required: true, min: 0, default: 0 })
  order!: number;

  /** Optional in-page anchor id (e.g. "#course") for nav links. */
  @Prop({ type: String })
  anchor?: string;

  /**
   * Type-specific config payload. Shape validated at DTO layer.
   * Author-data (about/schedule.items/pricing.tiers/gallery/contact) stored here;
   * auto-data (course/sponsors/results) fetched at frontend SSR (BR-83-08).
   */
  @Prop({ type: Object, default: {} })
  data!: Record<string, unknown>;
}
export const LandingSectionSchema = SchemaFactory.createForClass(LandingSection);

@Schema({ _id: false })
export class RaceRef {
  /** MongoDB races._id (string form). */
  @Prop({ type: String, required: true, index: true })
  raceId!: string;

  /** MySQL platform races.race_id — nullable (F-080: some Mongo races unmapped). */
  @Prop({ type: Number, default: null })
  mysqlRaceId?: number | null;

  @Prop({ type: String })
  slug?: string;
}
export const RaceRefSchema = SchemaFactory.createForClass(RaceRef);

@Schema({ _id: false })
export class MerchantRef {
  /** Tenant id — derived from race owner (BR-83-02). STRIPPED from public. */
  @Prop({ type: String, index: true })
  tenantId?: string;

  @Prop({ type: String })
  tenantName?: string;
}
export const MerchantRefSchema = SchemaFactory.createForClass(MerchantRef);

@Schema({ _id: false })
export class LandingAnalytics {
  @Prop({ type: String }) ga4MeasurementId?: string;
  @Prop({ type: String }) fbPixelId?: string;
}
export const LandingAnalyticsSchema =
  SchemaFactory.createForClass(LandingAnalytics);

@Schema({ _id: false })
export class LandingMeta {
  @Prop({ type: String, maxlength: 120 }) title?: string;
  @Prop({ type: String, maxlength: 200 }) description?: string;
  @Prop({ type: String, enum: ['vi', 'en'], default: 'vi' }) lang!: string;
  @Prop({ type: String }) ogImage?: string;
  @Prop({ type: String }) favicon?: string;
  @Prop({ type: String, default: 'index,follow' }) robots!: string;
  @Prop({ type: LandingAnalyticsSchema, default: () => ({}) })
  analytics!: LandingAnalytics;
}
export const LandingMetaSchema = SchemaFactory.createForClass(LandingMeta);

@Schema({ _id: false })
export class LandingTheme {
  @Prop({ type: String }) preset?: string;
  /** BR-83-09 — màu chính (hex). */
  @Prop({ type: String, default: '#ea580c' }) main!: string;
  /** BR-83-09 — màu phụ (hex). */
  @Prop({ type: String, default: '#1d4ed8' }) sec!: string;
  @Prop({ type: String, default: 'Be Vietnam Pro' }) fontHeading!: string;
  @Prop({ type: String, default: 'Inter' }) fontBody!: string;
  @Prop({ type: Number, min: 0, max: 0.8, default: 0.45 }) heroOverlay!: number;
}
export const LandingThemeSchema = SchemaFactory.createForClass(LandingTheme);

@Schema({ _id: false })
export class LandingDomain {
  /** BR-83-16 — sparse-unique at collection level. */
  @Prop({ type: String, index: true, unique: true, sparse: true })
  subdomain?: string;

  /** Phase 2 — custom domain (reserved, unused Phase 1). */
  @Prop({ type: String }) customDomain?: string;
  @Prop({
    type: String,
    enum: ['none', 'pending', 'verifying', 'active'],
    default: 'none',
  })
  domainStatus!: string;
  @Prop({ type: String, enum: ['none', 'pending', 'issued'], default: 'none' })
  sslStatus!: string;
}
export const LandingDomainSchema = SchemaFactory.createForClass(LandingDomain);

/** Frozen published copy (BR-83-19). Public serves ONLY this. */
@Schema({ _id: false })
export class LandingLiveSnapshot {
  @Prop({ type: LandingMetaSchema }) meta?: LandingMeta;
  @Prop({ type: LandingThemeSchema }) theme?: LandingTheme;
  @Prop({ type: [LandingSectionSchema], default: [] }) sections!: LandingSection[];
}
export const LandingLiveSnapshotSchema =
  SchemaFactory.createForClass(LandingLiveSnapshot);

@Schema({ _id: false })
export class LandingPublish {
  @Prop({ type: Boolean, default: false }) hasUnpublishedChanges!: boolean;
  @Prop({ type: Number, default: 0 }) version!: number;
  @Prop({ type: Date, default: null }) publishedAt?: Date | null;
  @Prop({ type: String, default: null }) publishedBy?: string | null;
  @Prop({ type: LandingLiveSnapshotSchema, default: null })
  liveSnapshot?: LandingLiveSnapshot | null;
}
export const LandingPublishSchema =
  SchemaFactory.createForClass(LandingPublish);

@Schema({ collection: 'race_landings', timestamps: true })
export class RaceLanding {
  _id!: Types.ObjectId;

  @Prop({ type: RaceRefSchema, required: true })
  raceRef!: RaceRef;

  @Prop({ type: MerchantRefSchema, default: () => ({}) })
  merchantRef!: MerchantRef;

  /** Admin-only label. STRIPPED from public. */
  @Prop({ type: String, maxlength: 200 })
  internalName?: string;

  @Prop({
    type: String,
    required: true,
    enum: LANDING_STATUSES,
    default: 'draft',
    index: true,
  })
  status!: LandingStatus;

  @Prop({ type: LandingMetaSchema, default: () => ({}) })
  meta!: LandingMeta;

  @Prop({ type: LandingThemeSchema, default: () => ({}) })
  theme!: LandingTheme;

  @Prop({ type: LandingDomainSchema, default: () => ({}) })
  domain!: LandingDomain;

  @Prop({ type: [LandingSectionSchema], default: [] })
  sections!: LandingSection[];

  @Prop({ type: LandingPublishSchema, default: () => ({}) })
  publish!: LandingPublish;

  @Prop({ type: String, required: true, index: true })
  createdBy!: string;

  @Prop({ type: String })
  updatedBy?: string;

  createdAt!: Date;
  updatedAt!: Date;
}
export type RaceLandingDocument = RaceLanding & Document;
export const RaceLandingSchema = SchemaFactory.createForClass(RaceLanding);

// BR-83-01 — one landing per race.
RaceLandingSchema.index({ 'raceRef.raceId': 1 }, { unique: true });
// Admin list: filter status + recent first.
RaceLandingSchema.index({ status: 1, updatedAt: -1 });
