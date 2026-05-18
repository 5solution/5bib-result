/**
 * FEATURE-036 — Backend API wrapper cho SEO routes /giai-chay/*.
 *
 * Server-side fetch (Server Components), Next.js ISR cache via `next.revalidate`.
 * Reuse F-027 pattern (BACKEND_URL env, no SDK — pure REST).
 *
 * Race status filter: BR-08 — backend `GET /api/races` đã filter draft sẵn.
 * Defensive double-check trong helper.
 */

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";

export interface RaceCourse {
  courseId: string;
  name: string;
  distance?: string;
  distanceKm?: number;
  startTime?: string;
  startLocation?: string;
  cutOffTime?: string;
  imageUrl?: string;
  mapUrl?: string;
  elevationGain?: number;
}

/**
 * Source-of-truth:
 *   - `mongodb` = race vận hành (đã/đang/sẽ diễn ra) — MongoDB `races` collection
 *     via `GET /api/races`. Đầy đủ courses, results, slug, ticketing legacy.
 *   - `on-sale` = race ĐANG BÁN VÉ (giai đoạn registration) — MySQL platform
 *     `races` table với status=GENERATED_CODE, via F-033 endpoint
 *     `GET /api/promo-hubs/races-on-sale`. Marketing data only — KHÔNG có
 *     courses/results, KHÔNG có internal detail page.
 */
export type RaceSource = "mongodb" | "on-sale";

export interface Race {
  id: string;
  _id?: string;
  slug?: string;
  title: string;
  status: "draft" | "pre_race" | "live" | "ended";
  province?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  bannerUrl?: string;
  imageUrl?: string;
  logoUrl?: string;
  organizer?: string;
  courses?: RaceCourse[];
  source?: RaceSource;
  /** Pre-built external URL — for on-sale races, this is the selling-web/5Ticket URL */
  ticketUrl?: string;
  /** For on-sale races: when registration closes */
  registrationEndTime?: string;
}

export interface RaceResult {
  bib: string;
  name?: string;
  chipTime?: string;
  gunTime?: string;
  pace?: string;
  overallRank?: number | string;
  genderRank?: number | string;
  categoryRank?: number | string;
  gender?: string;
  category?: string;
  nationality?: string;
}

export interface RaceResultPage {
  data: RaceResult[];
  total: number;
  page: number;
  limit: number;
}

export interface CourseStats {
  totalFinishers?: number;
  fastestTime?: string;
  slowestTime?: string;
  averagePace?: string;
}

async function safeFetch<T>(
  url: string,
  options: RequestInit & { next?: { revalidate?: number; tags?: string[] } },
  fallback: T,
): Promise<T> {
  try {
    const res = await fetch(url, options);
    if (res.status === 404) return fallback;
    if (!res.ok) {
      console.error(`[seo-api] ${url} returned ${res.status}`);
      return fallback;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error(`[seo-api] Fetch ${url} failed:`, err);
    return fallback;
  }
}

/**
 * BR-08: backend filters draft. Belt-and-suspenders client filter too.
 *
 * Backend response shape (verified PROD 2026-05-16):
 *   { success: true, data: { totalPages, currentPage, totalItems, list: Race[] } }
 *   OR legacy: { data: Race[] }
 *   OR raw: Race[]
 */
interface RacesPaginatedResponse {
  data?: Race[] | { list?: Race[]; totalItems?: number };
}

async function fetchMongoRaces(): Promise<Race[]> {
  const raw = await safeFetch<RacesPaginatedResponse | Race[]>(
    `${BACKEND_URL}/api/races?pageSize=500`,
    { next: { revalidate: 3600, tags: ["giai-chay:races"] } },
    [],
  );
  let list: Race[];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (Array.isArray(raw.data)) {
    list = raw.data;
  } else if (raw.data && Array.isArray(raw.data.list)) {
    list = raw.data.list;
  } else {
    list = [];
  }
  return list
    .filter((r) => r.status !== "draft")
    .map((r) => ({ ...r, source: "mongodb" as RaceSource }));
}

interface OnSaleApiRace {
  raceId: string;
  title: string;
  urlName: string;
  logoUrl?: string | null;
  eventStartDate?: string | null;
  registrationEndTime?: string | null;
  location?: string | null;
  brand?: string | null;
  ticketUrl: string;
}

/**
 * Fetch races ĐANG BÁN VÉ từ MySQL platform via F-033 endpoint.
 * Backend limit max 20 (F-033 BR-PH33-01). Future scale: backend extend cap.
 *
 * Normalize to Race shape (status='pre_race') for unified rendering.
 */
async function fetchOnSaleRaces(): Promise<Race[]> {
  const raw = await safeFetch<{ data?: OnSaleApiRace[] }>(
    `${BACKEND_URL}/api/promo-hubs/races-on-sale?limit=20`,
    { next: { revalidate: 3600, tags: ["giai-chay:on-sale"] } },
    { data: [] },
  );
  const list = raw.data ?? [];
  return list.map<Race>((r) => ({
    id: r.raceId,
    slug: r.urlName,
    title: r.title,
    status: "pre_race",
    location: r.location ?? undefined,
    startDate: r.eventStartDate ?? undefined,
    bannerUrl: r.logoUrl ?? undefined,
    logoUrl: r.logoUrl ?? undefined,
    organizer: r.brand ?? undefined,
    source: "on-sale" as RaceSource,
    ticketUrl: r.ticketUrl,
    registrationEndTime: r.registrationEndTime ?? undefined,
  }));
}

/**
 * BR-08: backend filters draft. Belt-and-suspenders client filter too.
 *
 * UPDATED 2026-05-16 (Danny correction): list MUST include cả 2 sources:
 *   1. MongoDB `races` (vận hành / đã/đang/sẽ diễn ra) — has slug, courses, results
 *   2. MySQL platform `races` BÁN VÉ phase (status=GENERATED_CODE) — F-033 endpoint
 *
 * Dedupe: nếu race xuất hiện cả 2 (chuyển phase), ưu tiên MongoDB (đầy đủ data).
 * Match key: title (case-insensitive trim).
 */
export async function getAllRaces(): Promise<Race[]> {
  const [mongo, onSale] = await Promise.all([
    fetchMongoRaces(),
    fetchOnSaleRaces(),
  ]);
  const mongoTitles = new Set(mongo.map((r) => r.title.trim().toLowerCase()));
  const onSaleDeduped = onSale.filter(
    (r) => !mongoTitles.has(r.title.trim().toLowerCase()),
  );
  return [...mongo, ...onSaleDeduped];
}

/**
 * Generic unwrapper for PROD API envelope { success, data: T } → T.
 * Falls back to raw response if already unwrapped (some endpoints return flat).
 */
function unwrap<T>(raw: unknown): T | null {
  if (raw == null) return null;
  if (typeof raw === "object" && raw !== null && "data" in raw) {
    const obj = raw as { data?: T };
    return obj.data ?? null;
  }
  return raw as T;
}

/**
 * FEATURE-037 — On-sale race detail DTO shape from MySQL platform.
 * Returned by `GET /api/promo-hubs/races-on-sale/by-url-name/:urlName`.
 */
interface ApiOnSaleCourseDto {
  id: string;
  prefix: string;
  name?: string | null;
  distance?: string | null;
  description?: string | null;
  price?: number | null;
  maxParticipate?: number | null;
  minAge?: number | null;
  maxAge?: number | null;
  openForSaleDateTime?: string | null;
  closeForSaleDateTime?: string | null;
  routeImageUrl?: string | null;
  routeMapImageUrl?: string | null;
  medalUrl?: string | null;
  gain?: string | null;
  courseType?: string | null;
}

interface ApiOnSaleDetailDto {
  raceId: string;
  title: string;
  urlName: string;
  description?: string | null;
  logoUrl?: string | null;
  images?: string | null;
  eventStartDate?: string | null;
  eventEndDate?: string | null;
  registrationStartTime?: string | null;
  registrationEndTime?: string | null;
  location?: string | null;
  province?: string | null;
  district?: string | null;
  locationUrl?: string | null;
  brand?: string | null;
  eventType?: string | null;
  raceType?: string | null;
  season?: string | null;
  sellingWebUrl: string;
  courses: ApiOnSaleCourseDto[];
  source: "on-sale";
}

/**
 * BR-37-06 — Fetch on-sale race detail from MySQL platform via F-037 endpoint.
 * Used as fallback in `getRaceBySlug()` dual-source resolution.
 */
async function getRaceOnSaleByUrlName(
  urlName: string,
): Promise<Race | null> {
  const raw = await safeFetch<unknown>(
    `${BACKEND_URL}/api/promo-hubs/races-on-sale/by-url-name/${encodeURIComponent(urlName)}`,
    { next: { revalidate: 3600, tags: [`giai-chay:on-sale:${urlName}`] } },
    null,
  );
  const detail = unwrap<ApiOnSaleDetailDto>(raw);
  if (!detail) return null;
  return mapOnSaleDetailToRace(detail);
}

/**
 * BR-37-08 — Normalize on-sale DTO → unified `Race` shape with `source='on-sale'`.
 * Course map: backend ApiOnSaleCourseDto → frontend RaceCourse with id as courseId.
 */
function mapOnSaleDetailToRace(detail: ApiOnSaleDetailDto): Race {
  const courses: RaceCourse[] = detail.courses.map((c) => ({
    courseId: c.id,
    name: c.name ?? c.prefix,
    distance: c.distance ?? undefined,
    startTime: c.openForSaleDateTime ?? undefined,
    cutOffTime: c.closeForSaleDateTime ?? undefined,
    imageUrl: c.routeImageUrl ?? undefined,
    mapUrl: c.routeMapImageUrl ?? undefined,
  }));

  return {
    id: detail.raceId,
    slug: detail.urlName,
    title: detail.title,
    status: "pre_race",
    province: detail.province ?? undefined,
    location: detail.location ?? undefined,
    startDate: detail.eventStartDate ?? undefined,
    endDate: detail.eventEndDate ?? undefined,
    description: detail.description ?? undefined,
    bannerUrl: detail.logoUrl ?? undefined,
    logoUrl: detail.logoUrl ?? undefined,
    organizer: detail.brand ?? undefined,
    courses,
    source: "on-sale",
    ticketUrl: detail.sellingWebUrl,
    registrationEndTime: detail.registrationEndTime ?? undefined,
  };
}

/**
 * BR-29 + BR-30 (F-036) + BR-37-06 (F-037 dual-source):
 * 1. Try MongoDB via `GET /api/races/slug/:slug`
 * 2. If MongoDB miss OR status=draft → fallback MySQL on-sale endpoint
 * 3. If both miss → returns null (Next.js notFound)
 *
 * BR-37-07: MongoDB precedence — race transitioned (BÁN VÉ→VẬN HÀNH)
 * automatically returns MongoDB shape (more complete data with courses+results).
 */
export async function getRaceBySlug(slug: string): Promise<Race | null> {
  // Step 1: try MongoDB
  const raw = await safeFetch<unknown>(
    `${BACKEND_URL}/api/races/slug/${encodeURIComponent(slug)}`,
    { next: { revalidate: 3600, tags: [`giai-chay:race:${slug}`] } },
    null,
  );
  const mongoRace = unwrap<Race>(raw);
  if (mongoRace && mongoRace.status !== "draft") {
    return { ...mongoRace, source: "mongodb" as RaceSource };
  }

  // Step 2: fallback MySQL on-sale (F-037)
  const onSaleRace = await getRaceOnSaleByUrlName(slug);
  if (onSaleRace) return onSaleRace;

  // Step 3: both miss
  return null;
}

/**
 * PROD `/api/race-results` returns flat array (no pagination params accepted).
 * Field names are PascalCase. We map → camelCase for UI.
 */
interface ApiRaceResultRow {
  Bib?: string;
  Name?: string;
  ChipTime?: string;
  GunTime?: string;
  Pace?: string;
  OverallRank?: string | number;
  GenderRank?: string | number;
  CatRank?: string | number;
  Gender?: string;
  Category?: string;
  Nationality?: string;
  TimingPoint?: string;
}

function mapResultRow(r: ApiRaceResultRow): RaceResult {
  return {
    bib: r.Bib ?? "",
    name: r.Name,
    chipTime: r.ChipTime,
    gunTime: r.GunTime,
    pace: r.Pace,
    overallRank: r.OverallRank,
    genderRank: r.GenderRank,
    categoryRank: r.CatRank,
    gender: r.Gender,
    category: r.Category,
    nationality: r.Nationality,
  };
}

export async function getRaceResults(
  raceId: string,
  courseId: string,
  page = 1,
  limit = 50,
): Promise<RaceResultPage> {
  // PROD API: no pagination params accepted, returns flat array, fields PascalCase
  const url = `${BACKEND_URL}/api/race-results?raceId=${encodeURIComponent(raceId)}&course_id=${encodeURIComponent(courseId)}`;
  const raw = await safeFetch<unknown>(
    url,
    {
      next: {
        revalidate: 1800,
        tags: [`giai-chay:results:${raceId}:${courseId}`],
      },
    },
    null,
  );
  const inner = unwrap<ApiRaceResultRow[] | { list?: ApiRaceResultRow[] }>(raw);
  let all: ApiRaceResultRow[] = [];
  if (Array.isArray(inner)) {
    all = inner;
  } else if (inner && Array.isArray(inner.list)) {
    all = inner.list;
  }
  // Filter to Finish records only (some include intermediate TimingPoints)
  const finishers = all.filter(
    (r) => !r.TimingPoint || r.TimingPoint.toLowerCase() === "finish",
  );
  const total = finishers.length;
  const start = (page - 1) * limit;
  const pageRows = finishers.slice(start, start + limit).map(mapResultRow);
  return { data: pageRows, total, page, limit };
}

export async function getCourseStats(
  raceId: string,
  courseId: string,
): Promise<CourseStats | null> {
  const raw = await safeFetch<unknown>(
    `${BACKEND_URL}/api/race-results/stats/${encodeURIComponent(raceId)}/${encodeURIComponent(courseId)}`,
    { next: { revalidate: 3600 } },
    null,
  );
  return unwrap<CourseStats>(raw);
}

export function getRaceId(race: Race): string {
  return race.id ?? race._id ?? "";
}

const RESULT_BASE_URL =
  process.env.NEXT_PUBLIC_RESULT_BASE_URL ?? "https://result.5bib.com";

/**
 * Build external URL to the actual race result page on result.5bib.com.
 * Per Danny 2026-05-16: "link kết quả của giải đó đâu thì gán vào đúng theo giải".
 * Used by ended/live race CTAs to send users to the canonical result page
 * (where real leaderboard/live tracking renders).
 */
export function getResultPageUrl(slug: string): string {
  return `${RESULT_BASE_URL}/races/${encodeURIComponent(slug)}`;
}

/**
 * Build external URL to a specific course leaderboard on result.5bib.com.
 * Used from results page course tabs to deep-link into live/ended leaderboard.
 */
export function getCourseLeaderboardUrl(slug: string, courseId: string): string {
  return `${RESULT_BASE_URL}/races/${encodeURIComponent(slug)}/ranking/${encodeURIComponent(courseId)}`;
}

export function getRaceYear(race: Race): number | null {
  if (!race.startDate) return null;
  const y = new Date(race.startDate).getUTCFullYear();
  return Number.isNaN(y) ? null : y;
}
