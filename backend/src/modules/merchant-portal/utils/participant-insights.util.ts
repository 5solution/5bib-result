/**
 * FEATURE-072 — Pure aggregation helpers for Participant Insights.
 * Handles MESSY real-world data: `dob`/`nationality`/`gender`/`tshirt_size` are
 * free-text varchar in `athlete_subinfo`. All parsing is defensive; unknowns go
 * to a "Không rõ" bucket. No DB / no I/O → fully unit-testable.
 */

export interface RawParticipantRow {
  tshirt_size: string | null;
  gender: string | null;
  dob: string | null;
  nationality: string | null;
  city_province: string | null;
}

export interface InsightBucket {
  label: string;
  count: number;
}

export interface ParticipantAggregate {
  totalParticipants: number;
  shirtSizes: InsightBucket[];
  genders: InsightBucket[];
  ageGroups: InsightBucket[];
  nationalities: InsightBucket[];
  provinces: InsightBucket[];
}

export const UNKNOWN_LABEL = 'Không rõ';
const OTHER_LABEL = 'Khác';

// ── DOB → age ─────────────────────────────────────────────────────────────
/**
 * Parse a free-text dob into age (years) at `asOf`. Accepts YYYY-MM-DD,
 * DD/MM/YYYY, or bare YYYY. Returns null on any failure or implausible age.
 */
export function parseAge(
  dob: string | null | undefined,
  asOf: Date,
): number | null {
  if (!dob || typeof dob !== 'string') return null;
  const s = dob.trim();
  if (!s) return null;

  let year: number, month: number, day: number;

  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); // YYYY-MM-DD (allow time suffix)
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // DD/MM/YYYY
  const yOnly = s.match(/^(\d{4})$/); // YYYY

  if (iso) {
    year = +iso[1];
    month = +iso[2];
    day = +iso[3];
  } else if (dmy) {
    day = +dmy[1];
    month = +dmy[2];
    year = +dmy[3];
  } else if (yOnly) {
    year = +yOnly[1];
    month = 1;
    day = 1;
  } else {
    return null;
  }

  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null;

  let age = asOf.getFullYear() - year;
  // adjust if birthday hasn't occurred yet this year
  const m = asOf.getMonth() + 1;
  const d = asOf.getDate();
  if (m < month || (m === month && d < day)) age--;

  if (age < 5 || age > 100) return null; // implausible for a race participant
  return age;
}

/** World Athletics 5-year age-group band for an age (or "Không rõ" if null). */
export function ageGroupWA(age: number | null): string {
  if (age == null) return UNKNOWN_LABEL;
  if (age < 18) return '<18';
  if (age >= 70) return '70+';
  const lo = Math.floor(age / 5) * 5; // 18→15? handle 18-24 specially below
  // WA bands after <18 start at 18-24 (7-wide), then 25-29, 30-34 … (5-wide)
  if (age <= 24) return '18-24';
  return `${lo}-${lo + 4}`;
}

/** Ordered list of all AG band labels (for stable display order). */
export const AGE_GROUP_ORDER: string[] = [
  '<18',
  '18-24',
  '25-29',
  '30-34',
  '35-39',
  '40-44',
  '45-49',
  '50-54',
  '55-59',
  '60-64',
  '65-69',
  '70+',
  UNKNOWN_LABEL,
];

// ── nationality / gender / size normalize ─────────────────────────────────
const VN_VARIANTS = new Set([
  'vn',
  'vie',
  'vietnam',
  'viet nam',
  'việt nam',
  'vietnamese',
  'người việt nam',
]);

export function normalizeNationality(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return UNKNOWN_LABEL;
  const t = raw.trim();
  if (!t) return UNKNOWN_LABEL;
  if (VN_VARIANTS.has(t.toLowerCase())) return 'Việt Nam';
  return t;
}

export function normalizeGender(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return OTHER_LABEL;
  const t = raw.trim().toLowerCase();
  if (['male', 'm', 'nam', 'man'].includes(t)) return 'Nam';
  if (['female', 'f', 'nữ', 'nu', 'woman'].includes(t)) return 'Nữ';
  return OTHER_LABEL;
}

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
/** Canonical size token (uppercased, XXL→2XL) or null if unrecognised. */
function canonicalSize(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  let t = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (!t) return null;
  t = t.replace('XXXL', '3XL').replace('XXL', '2XL').replace('XXXXL', '4XL');
  return SIZE_ORDER.includes(t) ? t : null;
}

export function sizeSortIndex(label: string): number {
  const i = SIZE_ORDER.indexOf(label);
  return i === -1 ? SIZE_ORDER.length : i; // unknown ("Khác") last
}

// ── generic bucketing ─────────────────────────────────────────────────────
function tally(values: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return m;
}

/** Top-N buckets desc by count; remainder folded into "Khác". */
function topNWithOther(
  counts: Map<string, number>,
  n: number,
): InsightBucket[] {
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, n).map(([label, count]) => ({ label, count }));
  const rest = sorted.slice(n);
  const otherTotal = rest.reduce((s, [, c]) => s + c, 0);
  if (otherTotal > 0) top.push({ label: OTHER_LABEL, count: otherTotal });
  return top;
}

// ── main aggregate ────────────────────────────────────────────────────────
export function aggregateParticipants(
  rows: RawParticipantRow[],
  asOf: Date,
): ParticipantAggregate {
  const sizeCounts = new Map<string, number>();
  const genderCounts = tally(rows.map((r) => normalizeGender(r.gender)));
  const ageCounts = new Map<string, number>();
  const natValues: string[] = [];
  const provValues: string[] = [];

  for (const r of rows) {
    // size
    const sz = canonicalSize(r.tshirt_size) ?? OTHER_LABEL;
    sizeCounts.set(sz, (sizeCounts.get(sz) ?? 0) + 1);
    // age group
    const ag = ageGroupWA(parseAge(r.dob, asOf));
    ageCounts.set(ag, (ageCounts.get(ag) ?? 0) + 1);
    // nationality / province
    natValues.push(normalizeNationality(r.nationality));
    const prov = (r.city_province ?? '').trim() || UNKNOWN_LABEL;
    provValues.push(prov);
  }

  // shirt sizes — canonical order, "Khác" last
  const shirtSizes: InsightBucket[] = [...sizeCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => sizeSortIndex(a.label) - sizeSortIndex(b.label));

  // genders — fixed order Nam, Nữ, Khác (only present ones)
  const genders: InsightBucket[] = ['Nam', 'Nữ', OTHER_LABEL]
    .filter((g) => genderCounts.has(g))
    .map((g) => ({ label: g, count: genderCounts.get(g)! }));

  // age groups — WA order
  const ageGroups: InsightBucket[] = AGE_GROUP_ORDER.filter((g) =>
    ageCounts.has(g),
  ).map((g) => ({ label: g, count: ageCounts.get(g)! }));

  const nationalities = topNWithOther(tally(natValues), 8);
  const provinces = topNWithOther(tally(provValues), 10);

  return {
    totalParticipants: rows.length,
    shirtSizes,
    genders,
    ageGroups,
    nationalities,
    provinces,
  };
}
