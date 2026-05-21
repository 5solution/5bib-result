/**
 * FEATURE-047 — Athlete Profile Aggregation Service.
 *
 * Phase 1A: aggregate live từ race_results collection per slug (NO athlete_profiles
 * collection persistence v1). Reverse-parse slug `<bib>-<name-kebab>` → query race_results
 * matching bib + name slugify equality → aggregate stats.
 *
 * Phase 1B (PAUSE-47-CODER-1 deferred):
 * - athlete_profiles collection + cron backfill (cross-race identity linking)
 * - athlete_photos collection + upload service + EXIF strip
 * - Admin endpoint PATCH active toggle
 * - Sitemap regen trigger
 *
 * Pattern reuse F-046:
 * - SETNX anti-stampede lock
 * - Redis cache TTL 1800s (athletes more dynamic than race recap)
 * - Hand-pick PII whitelist (F-035 lesson)
 * - try/catch graceful Redis degrade
 *
 * BR coverage Phase 1A: BR-47-01..02 (slug), 05..10 (PR records), 16/18/19 (cache + lock),
 * 21..24 (PII strip), 25/26 (SEO title/meta — frontend), 31..32 (perf).
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Model } from 'mongoose';
import Redis from 'ioredis';

import { RaceResult, RaceResultDocument } from '../schemas/race-result.schema';
import {
  AthleteProfile,
  AthleteProfileDocument,
} from '../schemas/athlete-profile.schema';
import { RacesService } from '../../races/races.service';
import {
  AthleteProfileResponseDto,
  AthletePRRecordDto,
  AthleteRaceHistoryRowDto,
  AthletePhotoPublicDto,
  AthleteBestAgRankDto,
  AthleteDistanceSpecialistDto,
} from '../dto/athlete-profile-response.dto';
import { slugifyVN } from '../../../common/utils/slugify';
import { canonicalizeProvince } from '../../../common/utils/province-normalize';
import { AthletePhotoService } from './athlete-photo.service';

// Reuse F-046 chipTime parser via local helper to avoid cross-service DI complexity
function parseChipTimeSeconds(chipTime: string): number {
  if (!chipTime) return 0;
  const trimmed = chipTime.trim();
  if (!trimmed || trimmed === '0:00:00' || trimmed === '00:00:00') return 0;
  const parts = trimmed.split(':').map((p) => parseInt(p, 10));
  if (parts.some((n) => isNaN(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

interface ResultRow {
  raceId: string;
  courseId: string;
  bib: string;
  name?: string;
  chipTime?: string;
  gunTime?: string;
  gender?: string;
  category?: string;
  nationality?: string;
  club?: string;
  overallRank?: string;
  categoryRank?: string;
  categoryRankNumeric?: number;
  distance?: string;
  avatarUrl?: string;
  created_at?: Date;
  finished?: number;
  started?: number;
  // ITRA points — Phase 2 reserve. Could be on rawData if vendor populates.
  rawData?: Record<string, unknown>;
}

interface RaceMetaCourse {
  courseId: string;
  name?: string;
  distance?: string;
  distanceKm?: number;
  elevationGain?: number;
}

interface RaceMeta {
  _id: string;
  slug?: string;
  title: string;
  endDate?: Date;
  status?: string;
  province?: string;
  raceType?: string;
  courses?: RaceMetaCourse[];
}

const PR_DISTANCES = ['5K', '10K', 'HM', 'FM'] as const;
type PRDistance = (typeof PR_DISTANCES)[number];

/**
 * F-056 Phase 5 — Public summary shape for athlete listing / spotlight /
 * featured carousel. PII-stripped (no email/phone/DOB).
 */
export interface AthleteSummary {
  slug: string;
  canonicalName: string;
  primaryBib: string;
  gender?: 'male' | 'female' | 'other' | null;
  nationality?: string;
  ageGroup?: string;
  totalRaces: number;
  totalFinished: number;
  lastRaceDate?: string;
  avatarUrl?: string;
  specialty?: 'marathon' | 'hm' | 'trail' | 'ultra' | 'road' | null;
}

@Injectable()
export class AthleteProfileService {
  private readonly logger = new Logger(AthleteProfileService.name);

  private static readonly PROFILE_CACHE_TTL = 1800; // BR-47-16
  private static readonly LOCK_TTL = 30;
  private static readonly PROFILE_PREFIX = 'athlete:profile:';
  private static readonly LOCK_PREFIX = 'athlete:lock:';

  constructor(
    @InjectModel(RaceResult.name)
    private readonly resultModel: Model<RaceResultDocument>,
    @InjectModel(AthleteProfile.name)
    private readonly profileModel: Model<AthleteProfileDocument>,
    @InjectRedis() private readonly redis: Redis,
    private readonly racesService: RacesService,
    private readonly photoService: AthletePhotoService,
  ) {}

  /**
   * BR-47-01 Slug format: `<bib>-<name-kebab>`.
   * Lookup race_results by bib (indexed) → filter by slugified name match.
   * Aggregate PR records + history + stats.
   */
  async getProfile(slug: string): Promise<AthleteProfileResponseDto> {
    // Cache-first
    const cacheKey = `${AthleteProfileService.PROFILE_PREFIX}${slug}`;
    const cached = await this.safeRedisGet(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as AthleteProfileResponseDto;
      } catch {
        this.logger.warn(`[getProfile] cache parse failed for ${slug}`);
      }
    }

    // Parse slug
    const parsed = this.parseSlug(slug);
    if (!parsed) {
      throw new NotFoundException('Athlete profile không tồn tại');
    }

    // Phase 1B: Try athlete_profiles collection FIRST (canonical, cron-backfilled).
    // Falls back to live aggregation if collection empty for this slug.
    const persisted = await this.profileModel
      .findOne({ slug, deletedAt: { $exists: false } })
      .lean()
      .exec();
    if (persisted) {
      // BR-47-05 privacy opt-out → 404 even if exists
      if (!persisted.active) {
        throw new NotFoundException('Athlete profile không tồn tại');
      }
      // Build response from collection + augment race history live (race meta join)
      const response = await this.buildResponseFromCollection(persisted, slug);
      try {
        await this.safeRedisSetEx(
          cacheKey,
          AthleteProfileService.PROFILE_CACHE_TTL,
          JSON.stringify(response),
        );
      } catch {
        /* ignore */
      }
      return response;
    }

    // SETNX anti-stampede lock (port F-046 pattern)
    const lockKey = `${AthleteProfileService.LOCK_PREFIX}${slug}`;
    const lockAcquired = await this.safeRedisSetNx(
      lockKey,
      AthleteProfileService.LOCK_TTL,
    );
    if (!lockAcquired) {
      await this.sleep(200);
      const retryCache = await this.safeRedisGet(cacheKey);
      if (retryCache) {
        try {
          return JSON.parse(retryCache) as AthleteProfileResponseDto;
        } catch {
          /* fall through to compute */
        }
      }
    }

    try {
      const profile = await this.computeProfile(parsed, slug);
      await this.safeRedisSetEx(
        cacheKey,
        AthleteProfileService.PROFILE_CACHE_TTL,
        JSON.stringify(profile),
      );
      return profile;
    } finally {
      await this.safeRedisDel(lockKey);
    }
  }

  /**
   * Phase 1B: query athlete_photos status=approved + signed URL 24h TTL (Adjustment #11).
   */
  async getPhotos(slug: string): Promise<{ photos: AthletePhotoPublicDto[] }> {
    // Check profile active first — BR-47-05
    const profile = await this.profileModel
      .findOne({ slug, deletedAt: { $exists: false } })
      .lean()
      .exec();
    if (profile && !profile.active) {
      throw new NotFoundException('Athlete profile không tồn tại');
    }

    const approved = await this.photoService.getApprovedPhotos(slug);
    return {
      photos: approved.map((p) => ({
        id: p.id,
        s3Url: p.s3Url,
        type: p.type,
        raceId: p.raceId,
        bib: p.bib,
        uploadedAt: p.uploadedAt,
      })),
    };
  }

  /**
   * Phase 1B — build response from athlete_profiles collection + race history live join.
   */
  private async buildResponseFromCollection(
    persisted: AthleteProfileDocument | { [k: string]: unknown },
    slug: string,
  ): Promise<AthleteProfileResponseDto> {
    const p = persisted as {
      slug: string;
      canonicalName: string;
      primaryBib: string;
      gender?: 'male' | 'female' | 'other' | null;
      nationality?: string;
      club?: string;
      ageGroupSnapshot?: string;
      totalRaces: number;
      totalFinished: number;
      totalDNF: number;
      linkedBibs: string[];
      linkedRaceIds: string[];
      avatarUrl?: string;
      lastRaceDate?: Date;
    };

    // Build race history live from race_results filtered by linkedBibs.
    //
    // BUG FIX 2026-05-21 (Danny screenshot: Anh Thư Nữ shown "Hạng 1 Nam 50-54"):
    // BIB numbers are NOT unique across races — bib=5114 is shared by 12 different
    // athletes across history. Filtering by bib alone pulled in 11 strangers' results.
    // Defense-in-depth: filter by linkedRaceIds (precise curated set) AND post-filter
    // by name slug (catches cron drift if linkedRaceIds drifts vs real records).
    const parsed = this.parseSlug(slug);
    const candidates = await this.resultModel
      .find({
        bib: { $in: p.linkedBibs },
        // restrict to curated races when available — efficient Mongo $in filter
        ...(p.linkedRaceIds && p.linkedRaceIds.length > 0
          ? { raceId: { $in: p.linkedRaceIds } }
          : {}),
      })
      .lean<ResultRow[]>()
      .exec();

    // Post-filter by canonical name slug (defense against cross-athlete bib collision)
    const liveResults = parsed
      ? candidates.filter(
          (r) => r.name && slugifyVN(r.name) === parsed.nameSlug,
        )
      : candidates;

    const raceMetas = await this.fetchRaceMetas(
      Array.from(new Set(liveResults.map((r) => r.raceId))),
    );

    const raceHistory = this.buildRaceHistory(liveResults, raceMetas);
    const prRecords = this.computePRRecords(liveResults, raceMetas);

    // F-050 aggregations (parity with live compute path)
    const bestAgRank = this.computeBestAgRank(raceHistory);
    const streak = this.computeStreak(raceHistory);
    const distanceSpecialist = this.computeDistanceSpecialist(raceHistory);
    const provinces = this.computeProvinces(raceHistory, raceMetas);

    // Most-recent AG bracket — prefer formatted from latest row; fallback to persisted snapshot.
    const latestRow = raceHistory[0];
    const ageGroupSnapshot = latestRow
      ? (this.formatAgBracket(latestRow.category, p.gender ?? undefined) ??
        latestRow.category ??
        p.ageGroupSnapshot)
      : p.ageGroupSnapshot;

    // BUG FIX 2026-05-21 (Gap #10) — re-compute canonical name from live results
    // instead of using stored p.canonicalName (which may have vendor casing drift /
    // whitespace inconsistency from when cron last ran).
    const canonicalName = this.pickCanonicalName(liveResults) ?? p.canonicalName;

    return {
      slug,
      canonicalName,
      primaryBib: p.primaryBib,
      gender: p.gender,
      nationality: p.nationality,
      club: p.club,
      ageGroupSnapshot,
      // BUG FIX 2026-05-21 (Danny screenshot 12 races vs totalRaces=1):
      // Persisted p.totalRaces is stale (computed at cron tick, race_results sync'd after).
      // ALWAYS derive from live raceHistory (single source of truth = what user sees in table).
      totalRaces: raceHistory.length,
      totalFinished: raceHistory.filter((h) => h.status === 'finished').length,
      totalDNF: raceHistory.filter((h) => h.status === 'dnf').length,
      totalDNS: raceHistory.filter((h) => h.status === 'dns').length,
      totalDSQ: raceHistory.filter((h) => h.status === 'dsq').length,
      prRecords,
      raceHistory,
      lastRaceDate: p.lastRaceDate
        ? new Date(p.lastRaceDate).toISOString()
        : raceHistory[0]?.raceDate,
      avatarUrl: p.avatarUrl,
      computedAt: new Date().toISOString(),
      bestAgRank,
      streak,
      distanceSpecialist,
      provinces,
    };
  }

  /**
   * F-056 Phase 5 — Public hero stats summary for /runners landing page.
   * Returns aggregate counts: totalAthletes / totalRaces / totalProvinces /
   * totalChipTimes. Cache Redis 1h via caller (not heavy enough for SETNX).
   */
  async getPublicStats(): Promise<{
    totalAthletes: number;
    totalRaces: number;
    totalProvinces: number;
    totalChipTimes: number;
  }> {
    // Data quality — mirror listPublicAthletes filter so stats match listing.
    const baseFilter = {
      active: true,
      deletedAt: { $exists: false },
      canonicalName: {
        $regex: '^[A-Za-zĐĂÂÊÔƠƯ][^\\d#].{2,}\\s.+',
        $options: 'i',
      },
      totalRaces: { $gte: 1 },
    };
    const [totalAthletes, distinctProvinces, sumAgg] = await Promise.all([
      this.profileModel.countDocuments(baseFilter).exec(),
      this.profileModel
        .distinct('nationality', { ...baseFilter, nationality: { $ne: null } })
        .exec(),
      this.profileModel
        .aggregate<{ _id: null; totalRaces: number; totalChipTimes: number }>([
          { $match: baseFilter },
          {
            $group: {
              _id: null,
              totalRaces: { $sum: '$totalRaces' },
              totalChipTimes: { $sum: '$totalFinished' },
            },
          },
        ])
        .exec(),
    ]);
    const sums = sumAgg[0] ?? { totalRaces: 0, totalChipTimes: 0 };
    return {
      totalAthletes,
      totalRaces: sums.totalRaces,
      totalProvinces: distinctProvinces.filter((p): p is string => !!p).length,
      totalChipTimes: sums.totalChipTimes,
    };
  }

  /**
   * F-056 Phase 5 — Public list of active athletes for /runners discover page
   * with full filter/sort/pagination support. PII-stripped summary.
   *
   * Query params (all optional):
   *   - letter: 'A'..'Z' first-letter filter on canonicalName
   *   - province: nationality exact match
   *   - gender: 'male'|'female'
   *   - ageGroup: substring match on category snapshot (e.g. "30-39")
   *   - specialty: 'marathon'|'hm'|'trail'|'ultra'|'road' — derived from prRecords
   *   - minRaces / maxRaces: totalRaces range
   *   - sort: 'az'|'recent'|'most-races'|'fastest-pr' (default recent)
   *   - page / pageSize: pagination (default 1 / 12, max pageSize 60)
   *
   * Returns { data, total, pageNo, pageSize, byLetter, totalAfterFilter }
   */
  async listPublicAthletes(
    params: {
      letter?: string;
      province?: string;
      gender?: 'male' | 'female';
      ageGroup?: string;
      specialty?: 'marathon' | 'hm' | 'trail' | 'ultra' | 'road';
      minRaces?: number;
      maxRaces?: number;
      sort?: 'az' | 'recent' | 'most-races' | 'fastest-pr';
      page?: number;
      pageSize?: number;
    } = {},
  ): Promise<{
    data: Array<{
      slug: string;
      canonicalName: string;
      primaryBib: string;
      gender?: 'male' | 'female' | 'other' | null;
      nationality?: string;
      ageGroup?: string;
      totalRaces: number;
      totalFinished: number;
      lastRaceDate?: string;
      avatarUrl?: string;
      specialty?: 'marathon' | 'hm' | 'trail' | 'ultra' | 'road' | null;
    }>;
    total: number;
    pageNo: number;
    pageSize: number;
    byLetter: Record<string, number>;
  }> {
    const pageNo = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(Math.max(1, params.pageSize ?? 12), 60);
    const sort = params.sort ?? 'recent';

    // Data quality filter — exclude garbage profiles from public discover.
    // Real names must:
    //   - Start with letter (not digit/#/dash) — excludes BIB-fallback names
    //     ("16661"), Excel parse errors ("#VALUE!"), leading dashes ("-TRAN")
    //   - Contain at least one whitespace (first + last name)
    //   - Length >= 4 chars (excludes single-word noise)
    // Plus totalRaces >= 1 (active means at least 1 race finished, not just
    // registered).
    const baseFilter: Record<string, unknown> = {
      active: true,
      deletedAt: { $exists: false },
      canonicalName: {
        $regex: '^[A-Za-zĐĂÂÊÔƠƯ][^\\d#].{2,}\\s.+',
        $options: 'i',
      },
      totalRaces: { $gte: 1 },
    };

    // Apply filters
    if (params.province) baseFilter.nationality = params.province;
    if (params.gender) baseFilter.gender = params.gender;
    if (params.ageGroup) {
      // Substring case-insensitive — matches "30-39" within "Male 30-39"
      baseFilter.ageGroupSnapshot = {
        $regex: this.escapeRegex(params.ageGroup),
        $options: 'i',
      };
    }
    if (params.letter && /^[A-Za-z]$/.test(params.letter)) {
      // Vietnamese first-letter — must match canonicalName start (case-insensitive).
      // Merge with quality filter to preserve garbage exclusion.
      baseFilter.canonicalName = {
        $regex: `^${params.letter}[^\\d#].{2,}\\s.+`,
        $options: 'i',
      };
    }
    if (params.minRaces != null || params.maxRaces != null) {
      // Merge with quality floor $gte: 1
      const rangeFilter: Record<string, number> = { $gte: 1 };
      if (params.minRaces != null)
        rangeFilter.$gte = Math.max(1, params.minRaces);
      if (params.maxRaces != null) rangeFilter.$lte = params.maxRaces;
      baseFilter.totalRaces = rangeFilter;
    }

    // Sort spec
    const sortSpec: Record<string, 1 | -1> = (() => {
      switch (sort) {
        case 'az':
          return { canonicalName: 1 };
        case 'most-races':
          return { totalRaces: -1, lastRaceDate: -1 };
        case 'fastest-pr':
          // No persistent PR-fastest sort; fallback to most-races (PR
          // requires computed across distances — Phase 6).
          return { totalRaces: -1 };
        case 'recent':
        default:
          return { lastRaceDate: -1 };
      }
    })();

    // Pre-specialty filter total (specialty derived post-query)
    const [totalBeforeSpecialty, pageProfiles, byLetterAgg] = await Promise.all([
      this.profileModel.countDocuments(baseFilter).exec(),
      this.profileModel
        .find(baseFilter)
        .sort(sortSpec)
        // Over-fetch for specialty filter post-process if specialty requested.
        // Cap factor 3× page size, max 200 to bound memory.
        .limit(
          params.specialty
            ? Math.min(200, pageSize * 3 + (pageNo - 1) * pageSize)
            : pageNo * pageSize,
        )
        .select({
          slug: 1,
          canonicalName: 1,
          primaryBib: 1,
          gender: 1,
          nationality: 1,
          ageGroupSnapshot: 1,
          totalRaces: 1,
          totalFinished: 1,
          lastRaceDate: 1,
          avatarUrl: 1,
          prRecords: 1,
        })
        .lean()
        .exec(),
      this.profileModel
        .aggregate<{ _id: string; count: number }>([
          {
            $match: {
              active: true,
              deletedAt: { $exists: false },
              // Same quality filter as listing — jumper counts must match
              canonicalName: {
                $regex: '^[A-Za-zĐĂÂÊÔƠƯ][^\\d#].{2,}\\s.+',
                $options: 'i',
              },
              totalRaces: { $gte: 1 },
            },
          },
          {
            $project: {
              firstLetter: {
                $toUpper: { $substrCP: ['$canonicalName', 0, 1] },
              },
            },
          },
          { $group: { _id: '$firstLetter', count: { $sum: 1 } } },
        ])
        .exec(),
    ]);

    // Map letter aggregate
    const byLetter: Record<string, number> = {};
    for (const row of byLetterAgg) {
      const normalized = this.normalizeAccent(row._id);
      byLetter[normalized] = (byLetter[normalized] ?? 0) + row.count;
    }

    // Specialty post-derive + filter
    const enriched = pageProfiles.map((p) => ({
      slug: p.slug,
      canonicalName: p.canonicalName,
      primaryBib: p.primaryBib,
      gender: p.gender ?? null,
      nationality: p.nationality ?? undefined,
      ageGroup: p.ageGroupSnapshot ?? undefined,
      totalRaces: p.totalRaces ?? 0,
      totalFinished: p.totalFinished ?? 0,
      lastRaceDate: p.lastRaceDate
        ? new Date(p.lastRaceDate).toISOString()
        : undefined,
      avatarUrl: p.avatarUrl ?? undefined,
      specialty: this.deriveSpecialty(p.prRecords),
    }));

    const filtered = params.specialty
      ? enriched.filter((a) => a.specialty === params.specialty)
      : enriched;

    // Paginate post-filter (only matters if specialty filter applied)
    const startIdx = (pageNo - 1) * pageSize;
    const pageSlice = filtered.slice(startIdx, startIdx + pageSize);
    const total = params.specialty ? filtered.length : totalBeforeSpecialty;

    return {
      data: pageSlice,
      total,
      pageNo,
      pageSize,
      byLetter,
    };
  }

  /**
   * F-056 Phase 5 — VĐV của tháng (spotlight #1 + top 5 sidebar) based on
   * race-completion count in current calendar month. Cache via caller.
   * Falls back to lastRaceDate sort if no current-month data.
   */
  async getSpotlightOfMonth(): Promise<{
    topOne: AthleteSummary | null;
    topFive: AthleteSummary[];
    month: string; // 'YYYY-MM'
  }> {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const profiles = await this.profileModel
      .find({
        active: true,
        deletedAt: { $exists: false },
        lastRaceDate: { $gte: monthStart },
        canonicalName: {
          $regex: '^[A-Za-zĐĂÂÊÔƠƯ][^\\d#].{2,}\\s.+',
          $options: 'i',
        },
        totalRaces: { $gte: 1 },
      })
      .sort({ totalRaces: -1, lastRaceDate: -1 })
      .limit(6)
      .select({
        slug: 1,
        canonicalName: 1,
        primaryBib: 1,
        gender: 1,
        nationality: 1,
        ageGroupSnapshot: 1,
        totalRaces: 1,
        totalFinished: 1,
        lastRaceDate: 1,
        avatarUrl: 1,
        prRecords: 1,
      })
      .lean()
      .exec();

    const list: AthleteSummary[] = profiles.map((p) => ({
      slug: p.slug,
      canonicalName: p.canonicalName,
      primaryBib: p.primaryBib,
      gender: p.gender ?? null,
      nationality: p.nationality ?? undefined,
      ageGroup: p.ageGroupSnapshot ?? undefined,
      totalRaces: p.totalRaces ?? 0,
      totalFinished: p.totalFinished ?? 0,
      lastRaceDate: p.lastRaceDate
        ? new Date(p.lastRaceDate).toISOString()
        : undefined,
      avatarUrl: p.avatarUrl ?? undefined,
      specialty: this.deriveSpecialty(p.prRecords),
    }));

    return {
      topOne: list[0] ?? null,
      topFive: list.slice(1, 6),
      month,
    };
  }

  /**
   * F-056 Phase 5 — Top 10 featured athletes by race-count in last 90 days.
   * Cache via caller (1h Redis recommended).
   */
  async getFeatured90Days(): Promise<{
    items: AthleteSummary[];
    windowDays: number;
  }> {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 3600 * 1000);
    const profiles = await this.profileModel
      .find({
        active: true,
        deletedAt: { $exists: false },
        lastRaceDate: { $gte: ninetyDaysAgo },
        canonicalName: {
          $regex: '^[A-Za-zĐĂÂÊÔƠƯ][^\\d#].{2,}\\s.+',
          $options: 'i',
        },
        totalRaces: { $gte: 1 },
      })
      .sort({ totalRaces: -1, lastRaceDate: -1 })
      .limit(10)
      .select({
        slug: 1,
        canonicalName: 1,
        primaryBib: 1,
        gender: 1,
        nationality: 1,
        ageGroupSnapshot: 1,
        totalRaces: 1,
        totalFinished: 1,
        lastRaceDate: 1,
        avatarUrl: 1,
        prRecords: 1,
      })
      .lean()
      .exec();

    const items: AthleteSummary[] = profiles.map((p) => ({
      slug: p.slug,
      canonicalName: p.canonicalName,
      primaryBib: p.primaryBib,
      gender: p.gender ?? null,
      nationality: p.nationality ?? undefined,
      ageGroup: p.ageGroupSnapshot ?? undefined,
      totalRaces: p.totalRaces ?? 0,
      totalFinished: p.totalFinished ?? 0,
      lastRaceDate: p.lastRaceDate
        ? new Date(p.lastRaceDate).toISOString()
        : undefined,
      avatarUrl: p.avatarUrl ?? undefined,
      specialty: this.deriveSpecialty(p.prRecords),
    }));

    return { items, windowDays: 90 };
  }

  // ─── Internal helpers ───────────────────────────────────────────────────

  /**
   * F-056 Phase 5 — Derive athlete specialty from prRecords distance counts.
   * Returns the distance category they have most PRs for, mapped to UI label.
   * Returns null if no PRs.
   */
  private deriveSpecialty(
    prRecords?: Array<{ distance: string }>,
  ): 'marathon' | 'hm' | 'trail' | 'ultra' | 'road' | null {
    if (!prRecords || prRecords.length === 0) return null;
    // Counts: FM=marathon, HM=hm, 10K/5K=road
    const counts = { fm: 0, hm: 0, road: 0 };
    for (const pr of prRecords) {
      if (pr.distance === 'FM') counts.fm++;
      else if (pr.distance === 'HM') counts.hm++;
      else if (pr.distance === '10K' || pr.distance === '5K') counts.road++;
    }
    const max = Math.max(counts.fm, counts.hm, counts.road);
    if (max === 0) return null;
    if (counts.fm === max) return 'marathon';
    if (counts.hm === max) return 'hm';
    return 'road';
  }

  /**
   * F-056 Phase 5 — Normalize Vietnamese first-letter accent → ASCII for
   * alphabet grouping. Đ/Ơ/Ô/Ư → D/O/O/U. Match design A→Z picker only
   * shows ASCII letters.
   */
  private normalizeAccent(c: string): string {
    if (!c) return '#';
    const map: Record<string, string> = {
      Á: 'A', À: 'A', Ả: 'A', Ã: 'A', Ạ: 'A', Ă: 'A', Â: 'A',
      É: 'E', È: 'E', Ẻ: 'E', Ẽ: 'E', Ẹ: 'E', Ê: 'E',
      Í: 'I', Ì: 'I', Ỉ: 'I', Ĩ: 'I', Ị: 'I',
      Ó: 'O', Ò: 'O', Ỏ: 'O', Õ: 'O', Ọ: 'O', Ô: 'O', Ơ: 'O',
      Ú: 'U', Ù: 'U', Ủ: 'U', Ũ: 'U', Ụ: 'U', Ư: 'U',
      Ý: 'Y', Ỳ: 'Y', Ỷ: 'Y', Ỹ: 'Y', Ỵ: 'Y',
      Đ: 'D',
    };
    const upper = c.toUpperCase();
    return map[upper] ?? upper;
  }

  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /** Sitemap support: top N most-active for /sitemap-athletes.xml. */
  async getSitemapEntries(
    limit = 50000,
  ): Promise<Array<{ slug: string; lastRaceDate?: string }>> {
    const safeLimit = Math.min(Math.max(1, limit), 50000);
    const profiles = await this.profileModel
      .find({ active: true, deletedAt: { $exists: false } })
      .sort({ lastRaceDate: -1 })
      .limit(safeLimit)
      .select({ slug: 1, lastRaceDate: 1 })
      .lean()
      .exec();
    return profiles.map((p) => ({
      slug: p.slug,
      lastRaceDate: p.lastRaceDate
        ? new Date(p.lastRaceDate).toISOString()
        : undefined,
    }));
  }

  /** Invalidation hook called from race-result.service.ts purgeCache extend (BR-47-19). */
  async invalidateProfileCache(slug: string): Promise<void> {
    await this.safeRedisDel(`${AthleteProfileService.PROFILE_PREFIX}${slug}`);
  }

  // ─── Core aggregation ──────────────────────────────────────────────────

  /**
   * Parse slug `<bib>-<name-kebab>`. Bib is leading numeric or alphanumeric segment
   * before first hyphen-name separator. Returns null if invalid format.
   */
  parseSlug(slug: string): { bib: string; nameSlug: string } | null {
    if (!slug || slug.length < 3) return null;
    const idx = slug.indexOf('-');
    if (idx <= 0 || idx >= slug.length - 1) return null;
    const bib = slug.substring(0, idx);
    const nameSlug = slug.substring(idx + 1);
    if (!bib.trim() || !nameSlug.trim()) return null;
    return { bib, nameSlug };
  }

  private async computeProfile(
    parsed: { bib: string; nameSlug: string },
    slug: string,
  ): Promise<AthleteProfileResponseDto> {
    // Find race_results matching bib
    const candidates = await this.resultModel
      .find({ bib: parsed.bib })
      .lean<ResultRow[]>()
      .exec();

    if (candidates.length === 0) {
      throw new NotFoundException('Athlete profile không tồn tại');
    }

    // Filter by slugified name match
    const matched = candidates.filter((r) => {
      if (!r.name) return false;
      return slugifyVN(r.name) === parsed.nameSlug;
    });

    if (matched.length === 0) {
      throw new NotFoundException('Athlete profile không tồn tại');
    }

    // Pick most recent for canonical fields
    matched.sort((a, b) => {
      const da = a.created_at ? new Date(a.created_at).getTime() : 0;
      const db = b.created_at ? new Date(b.created_at).getTime() : 0;
      return db - da;
    });
    const latest = matched[0];

    // BUG FIX 2026-05-21 (Gap #10 — data mapping audit):
    // canonicalName picker — most-frequent name variant (case + whitespace normalized).
    // Vendor data has typos / casing drift ("Nguyen Thi Trang" vs "NGUYỄN THỊ TRANG")
    // — naive "latest.name" picks arbitrary vendor casing. Mode-pick gives stability.
    const canonicalName = this.pickCanonicalName(matched) ?? latest.name ?? '';

    // Fetch race meta in parallel
    const raceIds = Array.from(new Set(matched.map((r) => r.raceId)));
    const raceMetas = await this.fetchRaceMetas(raceIds);

    // Build race history rows
    const raceHistory = this.buildRaceHistory(matched, raceMetas);

    // Compute PR records per distance
    const prRecords = this.computePRRecords(matched, raceMetas);

    // Stats counts — derive from raceHistory (single source of truth, matches table)
    const totalRaces = raceHistory.length;
    const totalFinished = raceHistory.filter(
      (h) => h.status === 'finished',
    ).length;
    const totalDNF = raceHistory.filter((h) => h.status === 'dnf').length;
    const totalDNS = raceHistory.filter((h) => h.status === 'dns').length;
    const totalDSQ = raceHistory.filter((h) => h.status === 'dsq').length;

    // Last race date
    const lastRaceDate = raceHistory[0]?.raceDate;

    // F-050: race-ops aggregations from history (post-build, all derived from raceHistory + raceMetas)
    const bestAgRank = this.computeBestAgRank(raceHistory);
    const streak = this.computeStreak(raceHistory);
    const distanceSpecialist = this.computeDistanceSpecialist(raceHistory);
    const provinces = this.computeProvinces(raceHistory, raceMetas);

    // Most-recent AG bracket from the latest finished/dnf row (display under hero)
    const ageGroupSnapshot =
      this.formatAgBracket(latest.category, latest.gender) ?? latest.category;

    return {
      slug,
      canonicalName,
      primaryBib: parsed.bib,
      gender: this.normalizeGender(latest.gender),
      nationality: latest.nationality,
      club: latest.club,
      ageGroupSnapshot,
      totalRaces,
      totalFinished,
      totalDNF,
      totalDNS,
      totalDSQ,
      prRecords,
      raceHistory,
      lastRaceDate,
      avatarUrl: latest.avatarUrl,
      computedAt: new Date().toISOString(),
      bestAgRank,
      streak,
      distanceSpecialist,
      provinces,
    };
  }

  private async fetchRaceMetas(
    raceIds: string[],
  ): Promise<Map<string, RaceMeta>> {
    const out = new Map<string, RaceMeta>();
    await Promise.all(
      raceIds.map(async (raceId) => {
        try {
          const lookup = await this.racesService.getRaceById(raceId, false);
          if (lookup.success && lookup.data) {
            const race = lookup.data as RaceMeta;
            out.set(raceId, race);
          }
        } catch {
          /* skip race if fetch fails — graceful degrade */
        }
      }),
    );
    return out;
  }

  private buildRaceHistory(
    rows: ResultRow[],
    raceMetas: Map<string, RaceMeta>,
  ): AthleteRaceHistoryRowDto[] {
    const history = rows
      .map<AthleteRaceHistoryRowDto | null>((r) => {
        const race = raceMetas.get(r.raceId);
        if (!race) return null; // skip if race meta missing (race deleted etc.)
        const course = race.courses?.find((c) => c.courseId === r.courseId);
        // Race day status standards (per 5bib-race-operation-expert skill):
        //   - finished: crossed finish mat + has chipTime > 0
        //   - dnf:      started (crossed start mat OR admin-flagged via dnsChipFail
        //               for chip-fail-but-evidence case) but no finish chip
        //   - dns:      never started (no start signal, no chipTime) — most common
        //               case for athletes who registered but didn't show up
        //   - dsq:      explicit disqualification (rule violation, bib transfer, etc.)
        //               currently no schema field for this; placeholder reserved for future
        const dnsChipFail = (r as ResultRow & { dnsChipFail?: boolean })
          .dnsChipFail;
        const status: 'finished' | 'dnf' | 'dns' | 'dsq' = this.isFinisher(r)
          ? 'finished'
          : (r.started ?? 0) > 0 || dnsChipFail === true
            ? 'dnf'
            : 'dns';
        // F-050: race-ops augmentation. All graceful-undefined.
        const raceClassification = this.classifyRaceType(course, race);
        const elevationGain =
          typeof course?.elevationGain === 'number' && course.elevationGain > 0
            ? course.elevationGain
            : undefined;
        const itraPoints = this.extractItraPoints(r);
        const gunTime = r.gunTime && r.gunTime.trim() ? r.gunTime : undefined;
        const agBracket = this.formatAgBracket(r.category, r.gender);

        return {
          raceId: r.raceId,
          raceSlug: race.slug ?? r.raceId,
          raceTitle: race.title,
          courseId: r.courseId,
          courseName: course?.name ?? r.courseId,
          distance: course?.distance ?? r.distance,
          chipTime: r.chipTime ?? '',
          bib: r.bib,
          overallRank: r.overallRank,
          categoryRank: r.categoryRank,
          category: r.category,
          raceDate: race.endDate
            ? new Date(race.endDate).toISOString()
            : undefined,
          status,
          raceClassification,
          elevationGain,
          itraPoints,
          gunTime,
          agBracket,
        };
      })
      .filter((row): row is AthleteRaceHistoryRowDto => row !== null);

    // Sort by raceDate DESC
    history.sort((a, b) => {
      const da = a.raceDate ? new Date(a.raceDate).getTime() : 0;
      const db = b.raceDate ? new Date(b.raceDate).getTime() : 0;
      return db - da;
    });
    return history;
  }

  /**
   * BR-47-09 PR records: best chipTime per distance 5K/10K/HM/FM.
   * Distance match tolerance ±0.5K.
   */
  private computePRRecords(
    rows: ResultRow[],
    raceMetas: Map<string, RaceMeta>,
  ): AthletePRRecordDto[] {
    const finishers = rows.filter((r) => this.isFinisher(r));
    const byDistance = new Map<
      PRDistance,
      { row: ResultRow; race: RaceMeta; seconds: number }
    >();

    for (const r of finishers) {
      const race = raceMetas.get(r.raceId);
      if (!race) continue;
      const course = race.courses?.find((c) => c.courseId === r.courseId);
      const distanceStr = course?.distance ?? r.distance ?? '';
      const prDistance = this.classifyDistance(distanceStr);
      if (!prDistance) continue;
      const seconds = parseChipTimeSeconds(r.chipTime ?? '');
      if (seconds <= 0) continue;

      const existing = byDistance.get(prDistance);
      if (!existing || seconds < existing.seconds) {
        byDistance.set(prDistance, { row: r, race, seconds });
      }
    }

    const records: AthletePRRecordDto[] = [];
    for (const dist of PR_DISTANCES) {
      const entry = byDistance.get(dist);
      if (entry) {
        records.push({
          distance: dist,
          chipTime: entry.row.chipTime ?? '',
          raceId: entry.race._id,
          raceSlug: entry.race.slug ?? entry.race._id,
          raceTitle: entry.race.title,
          raceDate: entry.race.endDate
            ? new Date(entry.race.endDate).toISOString()
            : undefined,
        });
      }
    }
    return records;
  }

  /**
   * BR-47-09 distance classification with ±0.5K tolerance.
   * "5K" → 5K, "10K" → 10K, "21K"/"HM"/"Half" → HM, "42K"/"FM"/"Marathon" → FM.
   */
  private classifyDistance(distance: string): PRDistance | null {
    if (!distance) return null;
    const d = distance.toUpperCase().trim();
    if (d.includes('HM') || d.includes('HALF') || d === '21K' || d === '21KM')
      return 'HM';
    if (
      d.includes('FM') ||
      d.includes('MARATHON') ||
      d === '42K' ||
      d === '42KM'
    )
      return 'FM';
    if (d === '5K' || d === '5KM') return '5K';
    if (d === '10K' || d === '10KM') return '10K';

    // Fuzzy: extract numeric prefix
    const match = d.match(/^(\d+(?:\.\d+)?)/);
    if (match) {
      const km = parseFloat(match[1]);
      if (Math.abs(km - 5) <= 0.5) return '5K';
      if (Math.abs(km - 10) <= 0.5) return '10K';
      if (Math.abs(km - 21) <= 0.5) return 'HM';
      if (Math.abs(km - 42) <= 1) return 'FM';
    }
    return null;
  }

  private isFinisher(r: ResultRow): boolean {
    if (!r.chipTime) return false;
    return parseChipTimeSeconds(r.chipTime) > 0;
  }

  /**
   * BUG FIX 2026-05-21 (Gap #10) — pick most-frequent name variant.
   *
   * Vendor name data drifts: "Nguyen Thi Trang" / "NGUYỄN THỊ TRANG" /
   * "nguyễn thị trang" — all same person but display picks arbitrary vendor casing.
   *
   * Strategy:
   *   1. Group by canonical key (trim + collapse whitespace + lowercase + slugifyVN)
   *   2. Within each group, count occurrences
   *   3. Return the EXACT variant that occurs most (mode); tie-break by longest
   *      (more characters = more complete name with full diacritics preserved)
   */
  private pickCanonicalName(rows: ResultRow[]): string | null {
    const counts = new Map<string, number>();
    const variants = new Map<string, string>(); // key → most-representative variant
    for (const r of rows) {
      const name = r.name?.trim().replace(/\s+/g, ' ');
      if (!name) continue;
      // Use slugified key for grouping (handles casing + spaces + diacritics)
      const key = slugifyVN(name);
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      // Prefer LONGER variant in tie (preserves diacritics over ASCII fallback)
      const prev = variants.get(key);
      if (!prev || name.length > prev.length) variants.set(key, name);
    }
    if (counts.size === 0) return null;
    // Pick mode (highest count). Tie-break: longest stored variant.
    let bestKey: string | null = null;
    let bestCount = 0;
    let bestLen = 0;
    for (const [key, count] of counts.entries()) {
      const variantLen = (variants.get(key) ?? '').length;
      if (
        count > bestCount ||
        (count === bestCount && variantLen > bestLen)
      ) {
        bestKey = key;
        bestCount = count;
        bestLen = variantLen;
      }
    }
    return bestKey ? variants.get(bestKey) ?? null : null;
  }

  // ─── F-050 race-ops helpers ───────────────────────────────────────────

  /**
   * F-050 PAUSE-50-02 — classify race row into Road / Trail (<50K) / Ultra Trail (≥50K).
   *
   * Rule (race-ops standard):
   *  - `race.raceType === 'trail'` (or course distance ≥50K) → trail family
   *      - distanceKm ≥ 50 → 'ultra_trail'
   *      - otherwise         → 'trail'
   *  - default                → 'road'
   *
   * Returns undefined if neither course nor race has any classifiable signal.
   */
  classifyRaceType(
    course: RaceMetaCourse | undefined,
    race: RaceMeta,
  ): 'road' | 'trail' | 'ultra_trail' | undefined {
    const distanceKm = this.resolveDistanceKm(course);
    const rawType = (race.raceType ?? '').toLowerCase().trim();

    const isTrail =
      rawType.includes('trail') ||
      rawType.includes('mountain') ||
      rawType === 'ultra';

    if (isTrail) {
      if (distanceKm !== null && distanceKm >= 50) return 'ultra_trail';
      return 'trail';
    }

    // BUG FIX 2026-05-21 (Gap #5 — data mapping audit):
    // Previous heuristic assumed distance ≥50K = ultra_trail regardless of raceType.
    // But rare road ultra exists (UTMB-style road ultras, IAU 100K certified courses)
    // — these should remain 'road' classification (vendor `raceType` is source of truth).
    // Only escalate to ultra_trail when EXPLICIT trail signal present.

    // Default to 'road' only when we have ANY signal (raceType or distance);
    // truly unknown returns undefined so frontend can hide the icon.
    if (rawType || distanceKm !== null) return 'road';
    return undefined;
  }

  /**
   * F-050 PAUSE-50-07 — consecutive finished-race streak from most-recent backwards.
   * raceHistory is pre-sorted by raceDate DESC. Stop counting at first non-finished row.
   */
  computeStreak(raceHistory: AthleteRaceHistoryRowDto[]): number {
    let streak = 0;
    for (const row of raceHistory) {
      if (row.status === 'finished') {
        streak += 1;
      } else {
        break;
      }
    }
    return streak;
  }

  /**
   * F-050 PAUSE-50-08 — count finished races grouped by canonical distance bucket.
   * Returns only buckets with count ≥3 (specialist threshold), sorted DESC by count.
   */
  computeDistanceSpecialist(
    raceHistory: AthleteRaceHistoryRowDto[],
  ): AthleteDistanceSpecialistDto[] {
    const counts = new Map<string, number>();
    for (const row of raceHistory) {
      if (row.status !== 'finished') continue;
      const bucket = this.normalizeDistanceBucket(row.distance);
      if (!bucket) continue;
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    }
    const out: AthleteDistanceSpecialistDto[] = [];
    for (const [distance, count] of counts.entries()) {
      if (count >= 3) out.push({ distance, count });
    }
    out.sort((a, b) => b.count - a.count);
    return out;
  }

  /**
   * F-050 — unique provinces visited from race meta. Dedup via Set, preserve sorted order (VN locale).
   *
   * BUG FIX 2026-05-21 (data mapping audit Gap #2):
   * Vendor province data inconsistent — "Hà Nội" / "Thành phố Hà Nội" / "TP Hà Nội"
   * treated as 3 different provinces, inflating geographic badge count.
   * canonicalizeProvince() strips administrative prefixes + applies alias map.
   */
  computeProvinces(
    raceHistory: AthleteRaceHistoryRowDto[],
    raceMetas: Map<string, RaceMeta>,
  ): string[] {
    const set = new Set<string>();
    for (const row of raceHistory) {
      const meta = raceMetas.get(row.raceId);
      const canonical = canonicalizeProvince(meta?.province);
      if (canonical) set.add(canonical);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }

  /**
   * F-050 — best AG performance: lowest numeric categoryRank across finished rows.
   * Tie-breaker: most recent raceDate first.
   */
  computeBestAgRank(
    raceHistory: AthleteRaceHistoryRowDto[],
  ): AthleteBestAgRankDto | undefined {
    let best: { row: AthleteRaceHistoryRowDto; rankNum: number } | null = null;
    for (const row of raceHistory) {
      if (row.status !== 'finished') continue;
      const rankNum = this.parseRankNumeric(row.categoryRank);
      if (rankNum === null) continue;
      if (!best || rankNum < best.rankNum) {
        best = { row, rankNum };
      }
    }
    if (!best) return undefined;
    return {
      raceId: best.row.raceId,
      raceSlug: best.row.raceSlug,
      raceTitle: best.row.raceTitle,
      raceDate: best.row.raceDate,
      rank: best.row.categoryRank ?? String(best.rankNum),
      bracket: best.row.agBracket ?? best.row.category,
    };
  }

  /**
   * F-050 PAUSE-50-04 — extract ITRA points from rawData if vendor populated.
   * Returns undefined when missing / not a positive number (display rule: only when > 0).
   */
  private extractItraPoints(r: ResultRow): number | undefined {
    const raw = r.rawData;
    if (!raw) return undefined;
    const candidate = raw['itraPoints'] ?? raw['ITRAPoints'] ?? raw['itra_points'];
    if (typeof candidate === 'number' && candidate > 0) return candidate;
    if (typeof candidate === 'string') {
      const parsed = parseFloat(candidate);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return undefined;
  }

  /**
   * F-050 PAUSE-50-01 — format AG bracket VN order `Nữ 30-39`.
   *
   * Input vendor format examples:
   *   - "F30-34" / "M30-34" → "Nữ 30-34" / "Nam 30-34"
   *   - "F-Open" / "M-Open" → "Nữ Mở" / "Nam Mở"
   *   - "Female 30-34"      → "Nữ 30-34"
   *   - "Nữ 30-34"          → pass-through (already VN)
   *
   * Returns undefined when category is empty. Falls back to raw category string
   * when format unrecognized (so user still sees something useful, not crash).
   */
  formatAgBracket(
    category: string | undefined,
    gender: string | undefined,
  ): string | undefined {
    if (!category || !category.trim()) return undefined;
    const raw = category.trim();

    // Already VN: starts with "Nam" / "Nữ"
    if (/^(Nam|Nữ)\b/i.test(raw)) return raw;

    // Match leading gender token + bracket suffix.
    // Patterns: "F30-34", "M-Open", "Female 30-34", "Male 30-34"
    // BUG FIX 2026-05-21: alternation longest-first so "Male" matches BEFORE "M"
    // (previous "F|M|Female|Male" pattern made "Male 50-54" → "Nam ale 50-54")
    const m = raw.match(
      /^(Female|Male|Nữ|Nam|F|M)\s*[-]?\s*(.+)$/i,
    );
    if (m) {
      const tokenRaw = m[1].toLowerCase();
      const suffix = m[2].trim();
      const vnGender =
        tokenRaw === 'f' || tokenRaw === 'female' || tokenRaw === 'nữ'
          ? 'Nữ'
          : tokenRaw === 'm' || tokenRaw === 'male' || tokenRaw === 'nam'
            ? 'Nam'
            : null;
      if (vnGender) {
        const vnSuffix = /open/i.test(suffix) ? 'Mở' : suffix;
        return `${vnGender} ${vnSuffix}`.trim();
      }
    }

    // Last resort — infer from normalized gender + raw bracket digits.
    const normalized = this.normalizeGender(gender);
    if (normalized === 'male' || normalized === 'female') {
      const vnGender = normalized === 'male' ? 'Nam' : 'Nữ';
      return `${vnGender} ${raw}`;
    }
    return raw;
  }

  private resolveDistanceKm(course: RaceMetaCourse | undefined): number | null {
    if (!course) return null;
    if (typeof course.distanceKm === 'number' && course.distanceKm > 0) {
      return course.distanceKm;
    }
    const s = (course.distance ?? '').toUpperCase().trim();
    if (!s) return null;
    const match = s.match(/^(\d+(?:\.\d+)?)/);
    if (match) {
      const n = parseFloat(match[1]);
      if (!isNaN(n) && n > 0) return n;
    }
    return null;
  }

  /**
   * Distance bucket for specialist grouping. Normalizes "42K"/"42KM"/"42" → "42K".
   * Returns null for unparseable/missing distance.
   */
  private normalizeDistanceBucket(distance: string | undefined): string | null {
    if (!distance) return null;
    const s = distance.toUpperCase().trim();
    if (!s) return null;
    const match = s.match(/^(\d+(?:\.\d+)?)/);
    if (!match) return null;
    const km = parseFloat(match[1]);
    if (isNaN(km) || km <= 0) return null;
    // Round to whole km for bucket key — distance specialism is integer-distance based.
    return `${Math.round(km)}K`;
  }

  private parseRankNumeric(rank: string | undefined): number | null {
    if (!rank) return null;
    const match = rank.match(/^(\d+)/);
    if (!match) return null;
    const n = parseInt(match[1], 10);
    if (isNaN(n) || n <= 0) return null;
    return n;
  }

  private normalizeGender(
    g: string | undefined,
  ): 'male' | 'female' | 'other' | null {
    if (!g) return null;
    const lower = g.toLowerCase().trim();
    if (lower === 'm' || lower === 'male' || lower === 'nam') return 'male';
    if (lower === 'f' || lower === 'female' || lower === 'nu' || lower === 'nữ')
      return 'female';
    return 'other';
  }

  // ─── Redis safe wrappers ──────────────────────────────────────────────

  private async safeRedisGet(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (err) {
      this.logger.warn(
        `[redis.get] failed key=${key}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  private async safeRedisSetEx(
    key: string,
    ttl: number,
    value: string,
  ): Promise<void> {
    try {
      await this.redis.setex(key, ttl, value);
    } catch (err) {
      this.logger.warn(
        `[redis.setex] failed key=${key}: ${(err as Error).message}`,
      );
    }
  }

  private async safeRedisSetNx(key: string, ttl: number): Promise<boolean> {
    try {
      const res = await this.redis.set(key, '1', 'EX', ttl, 'NX');
      return res === 'OK';
    } catch (err) {
      this.logger.warn(
        `[redis.setnx] failed key=${key}: ${(err as Error).message}`,
      );
      return false;
    }
  }

  private async safeRedisDel(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (err) {
      this.logger.warn(
        `[redis.del] failed key=${key}: ${(err as Error).message}`,
      );
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
