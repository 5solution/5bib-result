import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * FEATURE-027 — Promo Hub (Trang Quảng Bá).
 *
 * Each PromoHub is a configurable marketing landing page rendered at
 * `5bib.com/hub/<slug>`. Composed of an ordered, drag-and-drop sequence
 * of typed sections (hero, race_calendar, sponsors, ...) each carrying
 * type-specific config + visibility + optional schedule window.
 *
 * Schema decisions (per F-027 BR + Manager Plan):
 *   - `sections[]` is an EMBEDDED subdocument array (not a separate
 *     collection). Reads load the whole hub (admin edit + public render),
 *     atomic save covers all sections, reorder is a single document
 *     update. Max ~30 sections × ~5KB config = ~150KB → well under
 *     MongoDB 16MB document limit.
 *   - `config: Schema.Types.Mixed` per section because each `type`
 *     carries a different shape. Validation happens in DTO layer
 *     (class-validator discriminated union) — schema stays flexible.
 *   - `slug` is sparse-unique-indexed; regex enforced at DTO layer
 *     (BR-PH-02 `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`).
 *   - `status` enum 'draft' | 'published' | 'archived'. Public endpoint
 *     only serves 'published'. 'archived' = soft delete (BR-PH-15).
 *
 * Cache: see `promo-hub:<slug>` Redis key (TTL 60s) + invalidation in
 * `PromoHubService.invalidateSlug()` post-mutation.
 */

export type SectionType =
  // Phase A1 — core (9)
  | 'hero'
  | 'race_calendar'
  | 'featured_races'
  | 'promo_banner'
  | 'cta_buttons'
  | 'sponsors'
  | 'stats'
  | 'rich_text'
  | 'recent_results'
  // Phase B — landing-page expansion (10) — addendum 2026-05-13
  | 'link_grid'
  | 'social_links'
  | 'faq'
  | 'countdown'
  | 'video_embed'
  | 'image_gallery'
  | 'testimonial'
  | 'map_embed'
  | 'schedule_timeline'
  | 'form_embed';

export const SECTION_TYPES: ReadonlyArray<SectionType> = [
  'hero',
  'race_calendar',
  'featured_races',
  'promo_banner',
  'cta_buttons',
  'sponsors',
  'stats',
  'rich_text',
  'recent_results',
  // Phase B
  'link_grid',
  'social_links',
  'faq',
  'countdown',
  'video_embed',
  'image_gallery',
  'testimonial',
  'map_embed',
  'schedule_timeline',
  'form_embed',
] as const;

export type PromoHubStatus = 'draft' | 'published' | 'archived';
export const PROMO_HUB_STATUSES: ReadonlyArray<PromoHubStatus> = [
  'draft',
  'published',
  'archived',
] as const;

export type PromoHubLayout = 'standard' | 'compact' | 'wide';
export const PROMO_HUB_LAYOUTS: ReadonlyArray<PromoHubLayout> = [
  'standard',
  'compact',
  'wide',
] as const;

@Schema({ _id: false })
export class SectionSchedule {
  @Prop({ default: false }) enabled!: boolean;
  @Prop({ type: Date, default: null }) startDate?: Date | null;
  @Prop({ type: Date, default: null }) endDate?: Date | null;
}
export const SectionScheduleSchema = SchemaFactory.createForClass(SectionSchedule);

@Schema({ _id: true, timestamps: false })
export class Section {
  _id!: Types.ObjectId;

  @Prop({ type: String, required: true, enum: SECTION_TYPES })
  type!: SectionType;

  @Prop({ type: Number, required: true, min: 0, default: 0 })
  order!: number;

  @Prop({ type: Boolean, required: true, default: true })
  visible!: boolean;

  /**
   * Type-specific config payload. Shape validated at DTO layer (discriminated
   * union by `type`). Schema stays Mixed for flexibility.
   *
   * Examples:
   *   - `hero`: { title, subtitle, backgroundImage, ctaLabel, ctaUrl }
   *   - `race_calendar`: { filter: { status, dateFrom, dateTo, courseTypes[] }, limit }
   *   - `featured_races`: { raceIds[] } (manual curation)
   *   - `promo_banner`: { image, link }
   *   - `cta_buttons`: { buttons[]: { label, url, style } }
   *   - `sponsors`: { levels[]: 'silver'|'gold'|'diamond' }
   *   - `stats`: { items[]: { label, value, icon? } }
   *   - `rich_text`: { html } (sanitized via sanitize-html)
   *   - `recent_results`: { raceId | filter, limit }
   */
  @Prop({ type: Object, default: {} })
  config!: Record<string, unknown>;

  @Prop({ type: SectionScheduleSchema, default: () => ({}) })
  schedule!: SectionSchedule;
}
export const SectionSchema = SchemaFactory.createForClass(Section);

@Schema({ _id: false })
export class PromoHubSeo {
  @Prop({ type: String, maxlength: 70 }) metaTitle?: string;
  @Prop({ type: String, maxlength: 160 }) metaDescription?: string;
  /** S3 URL for OpenGraph image */
  @Prop({ type: String }) ogImage?: string;
  @Prop({ type: String }) canonicalUrl?: string;
  /** JSON-LD structured data (Event / Organization / WebSite schema) */
  @Prop({ type: Object }) structuredData?: Record<string, unknown>;
}
export const PromoHubSeoSchema = SchemaFactory.createForClass(PromoHubSeo);

@Schema({ _id: false })
export class PromoHubTheme {
  /** Hex color, default #1d4ed8 (5BIB Velocity blue) */
  @Prop({ type: String, default: '#1d4ed8' }) primaryColor!: string;
  /** Hex color, default #ea580c (5BIB Velocity orange energy) */
  @Prop({ type: String, default: '#ea580c' }) secondaryColor!: string;
  @Prop({ type: String, default: 'Be Vietnam Pro' }) fontFamily!: string;
  @Prop({ type: String, enum: PROMO_HUB_LAYOUTS, default: 'standard' })
  layout!: PromoHubLayout;
  /** Custom CSS injected into page <style> tag. Sanitized via sanitize-html
   *  to strip <script>, javascript: URIs, event handlers. */
  @Prop({ type: String }) customCss?: string;
}
export const PromoHubThemeSchema = SchemaFactory.createForClass(PromoHubTheme);

@Schema({ collection: 'promo_hubs', timestamps: true })
export class PromoHub {
  _id!: Types.ObjectId;

  /**
   * URL-friendly slug. Sparse-unique indexed (allow null for in-progress
   * drafts not yet assigned a slug). Regex `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`
   * enforced at DTO layer (BR-PH-02).
   */
  @Prop({ type: String, required: true, index: true, unique: true, sparse: true })
  slug!: string;

  @Prop({ type: String, required: true, minlength: 1, maxlength: 200 })
  title!: string;

  @Prop({ type: String, maxlength: 500 })
  description?: string;

  @Prop({
    type: String,
    required: true,
    enum: PROMO_HUB_STATUSES,
    default: 'draft',
    index: true,
  })
  status!: PromoHubStatus;

  @Prop({ type: [SectionSchema], default: [] })
  sections!: Section[];

  @Prop({ type: PromoHubSeoSchema, default: () => ({}) })
  seo!: PromoHubSeo;

  @Prop({ type: PromoHubThemeSchema, default: () => ({}) })
  theme!: PromoHubTheme;

  /** Logto user id (`req.logto.sub`) of creator. For future audit / RBAC. */
  @Prop({ type: String, required: true, index: true })
  createdBy!: string;

  // Mongoose timestamps: true → createdAt + updatedAt auto-managed.
  createdAt!: Date;
  updatedAt!: Date;
}
export type PromoHubDocument = PromoHub & Document;
export const PromoHubSchema = SchemaFactory.createForClass(PromoHub);

// Compound index for admin list: filter by status + sort by created desc.
PromoHubSchema.index({ status: 1, createdAt: -1 });
