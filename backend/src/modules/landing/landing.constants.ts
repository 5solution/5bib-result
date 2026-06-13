/**
 * FEATURE-083 — Race Landing Page Builder (Phase 1 MVP / subdomain).
 *
 * Lean-fork of F-027 Promo Hub: reuses the section-subdoc + SETNX-lock +
 * sanitize + cache plumbing PATTERN (not the module). Race-scoped +
 * domain-aware. Section render quality = NEW premium component library
 * (see design reference prototypes/). KHÔNG cross-module DI — section
 * auto-data (course/sponsors/results) fetched at FRONTEND SSR layer.
 */

/** 10 fixed section types (template fill-in — Danny 2026-06-13). */
export const LANDING_SECTION_TYPES = [
  'hero',
  'about',
  'course',
  'schedule',
  'pricing',
  'results_embed',
  'photos_embed',
  'gallery',
  'sponsors',
  'contact_social',
] as const;
export type LandingSectionType = (typeof LANDING_SECTION_TYPES)[number];

export const LANDING_STATUSES = [
  'draft',
  'published',
  'unpublished',
  'archived',
] as const;
export type LandingStatus = (typeof LANDING_STATUSES)[number];

/**
 * BR-83-07 — Allowed variants per section type. Service rejects 400 when a
 * section's `variant` is not in this list for its `type`. Single-variant
 * types use `'default'`.
 */
export const VARIANTS_BY_TYPE: Record<LandingSectionType, readonly string[]> = {
  hero: ['video', 'image', 'text', 'split'],
  about: ['image-right', 'image-left', 'stats'],
  course: ['default'],
  schedule: ['timeline', 'image'],
  pricing: ['default'],
  results_embed: ['default'],
  photos_embed: ['default'],
  gallery: ['bento', 'grid'],
  sponsors: ['tier', 'wall'],
  contact_social: ['default'],
};

/** BR-83-16 — subdomains that may NOT be claimed by a landing. */
export const RESERVED_SUBDOMAINS: ReadonlyArray<string> = [
  'www', 'admin', 'result', 'results', 'api', 'app', 'merchant', 'crew', 'm',
  'mail', 'dev', 'staging', 'test', '5bib', '5pix', '5sport', 'solution',
  'timing', 'blog', 'news', 'support', 'hotro', 'docs', 'status', 'cdn',
  'static', 'assets', 'cms', 'auth', 'login', 'go', 'link',
];

/** BR-83-16 — subdomain: lowercase, 3-42 chars, no leading/trailing hyphen. */
export const SUBDOMAIN_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,40}[a-z0-9])$/;
/** BR-83-09 — theme color: 6-digit hex. */
export const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

/** Redis keys + tuning (port F-027 PromoHub cache pattern). */
export const LANDING_CACHE = {
  SLUG_PREFIX: 'landing:slug:',
  RESOLVE_PREFIX: 'landing:resolve:',
  LOCK_PREFIX: 'landing-lock:',
  CACHE_TTL_SECONDS: 60,
  RESOLVE_TTL_SECONDS: 300,
  LOCK_TTL_SECONDS: 5,
  LOCK_RETRY_MAX: 3,
  LOCK_RETRY_SLEEP_MS: 200,
} as const;

/** BR-83-03 — seed defaults. */
export const DEFAULT_MAIN_COLOR = '#ea580c';
export const DEFAULT_SEC_COLOR = '#1d4ed8';

/** BR-83-12 — ticketing deep-link base (auto-fill CTA when mysql_race_id present). */
export const TICKETING_BASE_URL = 'https://5bib.com/vi/events/';

/** S3 prefix (lifecycle rule 7 — no expiration). */
export const LANDING_ASSETS_FOLDER = 'landing-assets';
