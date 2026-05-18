/**
 * F-041 Event Taxonomy — Single source of truth cho GA4 events.
 *
 * Convention: English snake_case event names + snake_case param keys (PRD BR-41-04).
 * Param keys MUST match exact với GA4 Custom Dimension "Event parameter" field
 * (xem GA4-ADMIN-CONFIG-GUIDE.md BƯỚC 3 — 24 dimensions registered).
 *
 * PII protection: compile-time TypeScript reject for `athlete_name`/`email`/`phone`
 * (BR-41-05). Adding new param? Update `EventParamKey` union below FIRST, then
 * re-register dimension trong GA4 Admin.
 */

// ────────────────────────────────────────────────────────────────────────────
// Event names — 24 events (BR-41-18 single source of truth)
// ────────────────────────────────────────────────────────────────────────────

export const EVENTS = {
  // Auto + Consent (2)
  PAGE_VIEW: 'page_view',
  CONSENT_ACCEPT: 'consent_accept',

  // View events (6)
  VIEW_RACE: 'view_race',
  VIEW_RANKING: 'view_ranking',
  VIEW_ATHLETE: 'view_athlete',
  VIEW_HUB: 'view_hub',
  VIEW_RACE_CALENDAR: 'view_race_calendar',
  VIEW_RACE_DIRECTORY: 'view_race_directory',

  // Selection events (4)
  SELECT_COURSE_TAB: 'select_course_tab',
  SELECT_RACE: 'select_race',
  SELECT_PROMO_SECTION: 'select_promo_section',
  SELECT_SPONSOR: 'select_sponsor',

  // Search & filter (5)
  SEARCH: 'search',
  SEARCH_BIB: 'search_bib',
  FILTER_CALENDAR: 'filter_calendar',
  FILTER_RANKING: 'filter_ranking',
  SORT_RANKING: 'sort_ranking',

  // Conversion + engagement (7)
  SHARE_ATHLETE: 'share_athlete', // ⭐ conversion (GA4 Admin)
  SHARE_RACE: 'share_race',
  DOWNLOAD_CERTIFICATE: 'download_certificate', // ⭐ conversion
  GENERATE_RESULT_IMAGE: 'generate_result_image', // ⭐ conversion
  SHARE_RESULT_IMAGE: 'share_result_image', // ⭐ conversion
  COMPARE_OPEN: 'compare_open',
  CLICK_FLOATING_ACTION: 'click_floating_action',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

// ────────────────────────────────────────────────────────────────────────────
// Custom Dimension param keys — match GA4 Admin registration
// ────────────────────────────────────────────────────────────────────────────

export type EventParamKey =
  // Race context
  | 'race_slug'
  | 'course_id'
  | 'bib'
  // User context
  | 'lang'
  | 'user_role'
  | 'from_route'
  // Share/download
  | 'share_method'
  | 'download_format'
  | 'preset_bg'
  // Sponsor
  | 'sponsor_name'
  | 'sponsor_id'
  | 'position'
  // Floating bar
  | 'action_type'
  // Search/filter/sort
  | 'filter_type'
  | 'filter_value'
  | 'sort_field'
  | 'sort_direction'
  | 'search_term'
  | 'result_count'
  | 'tab_index'
  // Hub/directory
  | 'hub_slug'
  | 'section_id'
  | 'city_slug'
  | 'bib_count'
  // Outcome (renamed from `status` to avoid GA4 reserved collision)
  | 'action_status';

// ────────────────────────────────────────────────────────────────────────────
// PII blacklist — compile-time TypeScript reject (BR-41-05)
// Any attempt to emit these keys via `gaEvent` will FAIL TypeScript compile.
// ────────────────────────────────────────────────────────────────────────────

export type PIIParamKey =
  | 'athlete_name'
  | 'email'
  | 'phone'
  | 'user_id_logto'
  | 'ip'
  | 'device_fingerprint'
  | 'address'
  | 'fullname';

/**
 * EventParams enforces: keys must be EventParamKey AND NEVER PIIParamKey.
 * Values: string | number | boolean | undefined (omitted in payload).
 */
export type EventParamValue = string | number | boolean | undefined;

export type EventParams = {
  [K in EventParamKey]?: EventParamValue;
} & {
  // Compile-time reject: if user passes PII key, TS error "Type 'never'"
  [K in PIIParamKey]?: never;
};

// ────────────────────────────────────────────────────────────────────────────
// Value enums — type-safe choices for specific params
// ────────────────────────────────────────────────────────────────────────────

export type ShareMethod = 'native' | 'link' | 'screenshot' | 'download' | 'copy_link';
export type DownloadFormat = 'pdf' | 'png';
export type PresetBg = 'blue' | 'dark' | 'sunset' | 'forest' | 'purple' | 'custom';
export type FromRoute = 'ranking' | 'search' | 'homepage' | 'directory' | 'direct' | 'calendar' | 'hub';
export type Position = 'sidebar' | 'footer' | 'race_page' | 'result_card' | 'header';
export type ActionType = 'back_to_top' | 'share' | 'scroll_splits';
export type FilterType = 'date' | 'location' | 'gender' | 'age_group' | 'status';
export type SortField = 'chip_time' | 'gun_time' | 'overall_rank' | 'gender_rank';
export type SortDirection = 'asc' | 'desc';
export type UserRole = 'anonymous' | 'authenticated';
export type ActionStatus = 'success' | 'fail' | 'cancel';
export type Lang = 'vi' | 'en';

// ────────────────────────────────────────────────────────────────────────────
// PII sanitizer — runtime safety net (defense-in-depth alongside TS)
// ────────────────────────────────────────────────────────────────────────────

const PII_BLACKLIST: ReadonlySet<string> = new Set<string>([
  'athlete_name',
  'email',
  'phone',
  'user_id_logto',
  'ip',
  'device_fingerprint',
  'address',
  'fullname',
  'name',
  'full_name',
  'fullName',
  'athleteName',
]);

/**
 * Strip any blacklisted PII keys before sending to GA4.
 * Runtime safety in case future code bypasses TypeScript (vd: dynamic key).
 */
export function sanitizeEventParams(params: Record<string, EventParamValue>): Record<string, EventParamValue> {
  const out: Record<string, EventParamValue> = {};
  for (const [key, value] of Object.entries(params)) {
    if (PII_BLACKLIST.has(key)) continue;
    if (value === undefined) continue;
    out[key] = value;
  }
  return out;
}
