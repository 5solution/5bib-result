import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Model } from 'mongoose';
import Redis from 'ioredis';
import { RaceResult, RaceResultDocument } from '../schemas/race-result.schema';
import type { Badge, BadgeType } from '../templates/types';

const CACHE_TTL_SECONDS = 3600; // 1h per PRD BR-04
const BADGE_TIMEOUT_MS = 2000; // BR-04 — fallback to empty badges if > 2s
const LOCK_TTL_SECONDS = 10; // stampede prevention

/**
 * Parse distance string to kilometers.
 * Handles: "21km", "21 km", "21K", "42.195km", "Marathon", "Half Marathon",
 *          "HM", "FM", "10k", "5K", "100M" (miles).
 *
 * WHY regex \b failed: \b between digit↔letter (both word chars) does NOT match.
 * So `/\b21\b/` didn't match "21km". We parse numerically instead.
 */
export function parseDistanceKm(raw: string): number {
  if (!raw) return 0;
  const s = raw.toLowerCase().trim();

  // Name aliases first (exact aliases, not \b-bound)
  if (/\bfull\s*marathon|marathon|^fm$/i.test(s) && !/half/i.test(s)) return 42;
  if (/\bhalf\s*marathon|^hm$|half/i.test(s)) return 21;

  // Miles → convert to km (100M = 160.93km, 50M = 80.46km)
  const miMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:mi|miles|m)\b/);
  if (miMatch && !/km|k$/i.test(s)) {
    return parseFloat(miMatch[1]) * 1.60934;
  }

  // Numeric + km/k suffix (the common case in 5BIB DB)
  const kmMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:km|k)\b/);
  if (kmMatch) return parseFloat(kmMatch[1]);

  // Bare number fallback — treat as km if 1-300, else 0
  const bare = s.match(/^(\d+(?:\.\d+)?)$/);
  if (bare) {
    const n = parseFloat(bare[1]);
    if (n > 0 && n < 300) return n;
  }
  return 0;
}

/**
 * Sub-X thresholds keyed on km-range buckets.
 * Using numeric compare instead of brittle regex word-boundaries.
 */
const SUBX_THRESHOLDS: Array<{
  distanceMatch: (d: string) => boolean;
  thresholds: { seconds: number; type: BadgeType; label: string }[];
}> = [
  {
    // Marathon: 41-44 km
    distanceMatch: (d) => {
      const km = parseDistanceKm(d);
      return km >= 41 && km <= 44;
    },
    thresholds: [
      { seconds: 3 * 3600, type: 'SUB3H', label: 'Sub-3H' },
      { seconds: 3.5 * 3600, type: 'SUB3_30H', label: 'Sub-3:30H' },
      { seconds: 4 * 3600, type: 'SUB4H', label: 'Sub-4H' },
    ],
  },
  {
    // Half marathon: 20-22 km
    distanceMatch: (d) => {
      const km = parseDistanceKm(d);
      return km >= 20 && km <= 22;
    },
    thresholds: [
      { seconds: 90 * 60, type: 'SUB90M', label: 'Sub-90M' },
      { seconds: 105 * 60, type: 'SUB_1_45H', label: 'Sub-1:45H' },
      { seconds: 120 * 60, type: 'SUB2H', label: 'Sub-2H' },
    ],
  },
  {
    // 10K: 9-11 km
    distanceMatch: (d) => {
      const km = parseDistanceKm(d);
      return km >= 9 && km <= 11;
    },
    thresholds: [
      { seconds: 45 * 60, type: 'SUB45M', label: 'Sub-45M' },
      { seconds: 60 * 60, type: 'SUB_1H', label: 'Sub-1H' },
    ],
  },
  {
    // 5K: 4.5-5.9 km
    distanceMatch: (d) => {
      const km = parseDistanceKm(d);
      return km >= 4.5 && km <= 5.9;
    },
    thresholds: [
      { seconds: 20 * 60, type: 'SUB20M', label: 'Sub-20M' },
      { seconds: 25 * 60, type: 'SUB25M', label: 'Sub-25M' },
    ],
  },
];

@Injectable()
export class BadgeService {
  private readonly logger = new Logger(BadgeService.name);

  constructor(
    @InjectModel(RaceResult.name)
    private readonly resultModel: Model<RaceResultDocument>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  /**
   * Main entry point. Returns badges for an athlete's result.
   * Wraps all heavy work in timeout — if > 2s, returns [] so render doesn't block (BR-04).
   */
  async detectBadges(raceId: string, bib: string): Promise<Badge[]> {
    const cacheKey = `badge:${raceId}:${bib}`;

    // 1. Cache check
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as Badge[];
      }
    } catch (err) {
      this.logger.warn(`Redis GET ${cacheKey} failed: ${(err as Error).message}`);
    }

    // 2. Single-flight lock to prevent stampede
    const lockKey = `badge-lock:${raceId}:${bib}`;
    let haveLock = false;
    try {
      const acquired = await this.redis.set(
        lockKey,
        '1',
        'EX',
        LOCK_TTL_SECONDS,
        'NX',
      );
      haveLock = acquired === 'OK';
    } catch {
      // Redis down — proceed without lock
    }

    if (!haveLock) {
      // Another worker is detecting. Wait briefly then re-check cache.
      await sleep(300);
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) return JSON.parse(cached) as Badge[];
      } catch {
        // fall through to compute anyway
      }
    }

    // 3. Compute with timeout
    try {
      const badges = await this.withTimeout(
        () => this.computeBadges(raceId, bib),
        BADGE_TIMEOUT_MS,
        [],
      );

      // 4. Cache success result
      try {
        await this.redis.set(
          cacheKey,
          JSON.stringify(badges),
          'EX',
          CACHE_TTL_SECONDS,
        );
      } catch (err) {
        this.logger.warn(`Redis SET ${cacheKey} failed: ${(err as Error).message}`);
      }

      return badges;
    } finally {
      if (haveLock) {
        try {
          await this.redis.del(lockKey);
        } catch {
          /* ignore */
        }
      }
    }
  }

  /**
   * Compute all badges for an athlete. Runs multiple checks in parallel.
   */
  private async computeBadges(
    raceId: string,
    bib: string,
  ): Promise<Badge[]> {
    const result = await this.resultModel
      .findOne({ raceId, bib })
      .lean()
      .exec();

    if (!result) return [];

    const badges: Badge[] = [];

    // Run independent checks in parallel
    // Note: detectStreak is intentionally excluded — BIB is not globally unique
    // across races so streak counts are unreliable (false positives).
    const [pbBadge, firstRaceBadge] = await Promise.all([
      this.detectPersonalBest(result).catch((err) => {
        this.logger.warn(`PB detect failed: ${err.message}`);
        return null;
      }),
      this.detectFirstRace(bib).catch(() => null),
    ]);

    // Podium (synchronous from result data)
    const podiumBadge = this.detectPodium(result);
    if (podiumBadge) badges.push(podiumBadge);

    const agPodiumBadge = this.detectAgePodium(result);
    if (agPodiumBadge) badges.push(agPodiumBadge);

    // Sub-X thresholds (synchronous from result data)
    const subXBadges = this.detectSubX(result);
    badges.push(...subXBadges);

    // Ultra (synchronous)
    const ultraBadge = this.detectUltra(result);
    if (ultraBadge) badges.push(ultraBadge);

    if (pbBadge) badges.push(pbBadge);
    if (firstRaceBadge) badges.push(firstRaceBadge);

    // Sort by priority: PB > PODIUM > AG_PODIUM > Sub-X > others
    return sortBadges(badges);
  }

  // ─── Detection methods (thin wrappers around exported pure fns) ──

  private detectPodium(result: {
    overallRankNumeric?: number;
    overallRank?: string;
  }): Badge | null {
    return detectPodiumLogic(result);
  }

  private detectAgePodium(result: {
    categoryRankNumeric?: number;
    categoryRank?: string;
    category?: string;
  }): Badge | null {
    return detectAgePodiumLogic(result);
  }

  private detectSubX(result: {
    distance?: string;
    chipTime?: string;
  }): Badge[] {
    return detectSubXLogic(result);
  }

  private detectUltra(result: { distance?: string }): Badge | null {
    return detectUltraLogic(result);
  }

  private async detectPersonalBest(result: {
    bib: string;
    distance?: string;
    chipTime?: string;
    raceId?: string;
    name?: string;
  }): Promise<Badge | null> {
    if (!result.distance || !result.chipTime) return null;
    const currentSec = parseChipTime(result.chipTime);
    if (currentSec <= 0) return null;

    // `bib` is NOT globally unique (uniqueness is per {raceId, courseId, bib}),
    // so querying by bib alone matches unrelated athletes across races.
    // Require normalized-name match to prevent false PBs. If name is missing we
    // skip PB detection entirely — correctness > coverage.
    const normalizedName = normalizeName(result.name);
    if (!normalizedName) return null;

    // Find athlete's other finishes at same distance with the same name+bib
    const history = await this.resultModel
      .find({
        bib: result.bib,
        distance: result.distance,
        raceId: { $ne: result.raceId },
        chipTime: { $exists: true, $ne: null },
      })
      .select({ chipTime: 1, raceId: 1, name: 1 })
      .lean()
      .exec();

    // Narrow to same athlete by normalized name
    const sameAthlete = history.filter(
      (h) => normalizeName(h.name) === normalizedName,
    );
    if (sameAthlete.length === 0) return null; // first race at this distance → no PB

    const prevBest = sameAthlete
      .map((h) => parseChipTime(h.chipTime ?? ''))
      .filter((s) => s > 0)
      .reduce((min, s) => Math.min(min, s), Infinity);

    if (prevBest === Infinity || currentSec >= prevBest) return null;

    const deltaSec = prevBest - currentSec;
    return {
      type: 'PB',
      label: '🏆 Personal Best',
      shortLabel: 'PB',
      color: '#dc2626',
      meta: {
        delta: formatDelta(deltaSec),
        prevBest: Math.round(prevBest),
        current: Math.round(currentSec),
      },
    };
  }

  private async detectFirstRace(bib: string): Promise<Badge | null> {
    // Very lightweight: count results with this bib
    // NOTE: bib is not globally unique across races — this is a weak signal.
    // A stronger version would require athlete identity resolution. For v1, skip
    // unless we have < 2 bibs, otherwise too noisy.
    const count = await this.resultModel.countDocuments({ bib }).exec();
    if (count === 1) {
      return {
        type: 'FIRST_RACE',
        label: '✨ Lần đầu tiên',
        shortLabel: '1st',
        color: '#8b5cf6',
        meta: { count },
      };
    }
    return null;
  }

  private async detectStreak(bib: string): Promise<Badge | null> {
    // 3+ races in past 6 months (180 days)
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    const count = await this.resultModel
      .countDocuments({
        bib,
        syncedAt: { $gte: sixMonthsAgo },
      })
      .exec();
    if (count >= 3) {
      return {
        type: 'STREAK',
        label: `🔥 ${count} giải / 6 tháng`,
        shortLabel: `${count}x`,
        color: '#ea580c',
        meta: { count },
      };
    }
    return null;
  }

  // ─── Utilities ──────────────────────────────────────────────

  private async withTimeout<T>(
    fn: () => Promise<T>,
    ms: number,
    fallback: T,
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((resolve) => {
        setTimeout(() => {
          this.logger.warn(`Badge detect timed out after ${ms}ms — returning fallback`);
          resolve(fallback);
        }, ms);
      }),
    ]);
  }
}

// ─── Helpers ────────────────────────────────────────────────

/** Parse "H:MM:SS" or "MM:SS" or "H:MM:SS.sss" into seconds. */
export function parseChipTime(str: string | undefined | null): number {
  if (!str) return 0;
  const parts = str.split(':').map((p) => parseFloat(p));
  if (parts.some((n) => isNaN(n))) return 0;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return 0;
}

/** Format seconds → "8m21s" or "1h 23m". */
function formatDelta(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0 && sec > 0) return `${m}m${sec}s`;
  if (m > 0) return `${m}m`;
  return `${sec}s`;
}

/** Sort badges by priority (rarest/most impressive first). */
function sortBadges(badges: Badge[]): Badge[] {
  const priority: Record<BadgeType, number> = {
    PB: 1,
    PODIUM: 2,
    AG_PODIUM: 3,
    SUB3H: 4,
    SUB3_30H: 5,
    SUB4H: 6,
    SUB90M: 7,
    SUB_1_45H: 8,
    SUB2H: 9,
    SUB45M: 10,
    SUB_1H: 11,
    SUB20M: 12,
    SUB25M: 13,
    ULTRA: 14,
    STREAK: 15,
    FIRST_RACE: 16,
  };
  return [...badges].sort(
    (a, b) => (priority[a.type] ?? 99) - (priority[b.type] ?? 99),
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Normalize athlete name for cross-race identity matching in PB detection.
 * - Lowercase
 * - Strip diacritics (NFD + combining marks)
 * - Collapse whitespace
 * Returns '' for empty/falsy input.
 */
// ─── Pure detection helpers (exported for unit testing) ────────

/** Podium = overallRank 1-3. */
export function detectPodiumLogic(result: {
  overallRankNumeric?: number;
  overallRank?: string;
}): Badge | null {
  const rank =
    result.overallRankNumeric ?? parseInt(result.overallRank || '', 10);
  if (isNaN(rank) || rank < 1 || rank > 3) return null;
  const labels = [
    '🥇 Vô địch chung cuộc',
    '🥈 Á quân chung cuộc',
    '🥉 Hạng 3 chung cuộc',
  ];
  const colors = ['#f59e0b', '#94a3b8', '#d97706'];
  return {
    type: 'PODIUM',
    label: labels[rank - 1],
    shortLabel: `#${rank}`,
    color: colors[rank - 1],
    meta: { rank },
  };
}

/** Age-group podium = categoryRank 1-3. */
export function detectAgePodiumLogic(result: {
  categoryRankNumeric?: number;
  categoryRank?: string;
  category?: string;
}): Badge | null {
  const rank =
    result.categoryRankNumeric ?? parseInt(result.categoryRank || '', 10);
  if (isNaN(rank) || rank < 1 || rank > 3) return null;
  return {
    type: 'AG_PODIUM',
    label: `🏅 Top ${rank} ${result.category || 'Age Group'}`,
    shortLabel: `AG#${rank}`,
    color: '#7c3aed',
    meta: { rank, category: result.category ?? '' },
  };
}

/** Sub-X threshold — returns the highest tier achieved (fastest). */
export function detectSubXLogic(result: {
  distance?: string;
  chipTime?: string;
}): Badge[] {
  const distance = result.distance || '';
  const chipSeconds = parseChipTime(result.chipTime);
  if (chipSeconds <= 0) return [];

  const ruleset = SUBX_THRESHOLDS.find((r) => r.distanceMatch(distance));
  if (!ruleset) return [];

  for (const threshold of ruleset.thresholds) {
    if (chipSeconds < threshold.seconds) {
      return [
        {
          type: threshold.type,
          label: `⚡ ${threshold.label}`,
          shortLabel: threshold.label,
          color: '#0ea5e9',
          meta: { distance, chipSeconds },
        },
      ];
    }
  }
  return [];
}

/** Ultra = ≥50km or keyword marker (UTMB, ultra, 100M). */
export function detectUltraLogic(result: { distance?: string }): Badge | null {
  const distance = result.distance || '';
  const km = parseDistanceKm(distance);
  if (km >= 50 || /ultra|utmb|\b100\s*mi|\b100\s*miles/i.test(distance)) {
    return {
      type: 'ULTRA',
      label: '🏔️ Ultra Finisher',
      shortLabel: 'Ultra',
      color: '#059669',
      meta: { distance, km: Math.round(km) },
    };
  }
  return null;
}

export function normalizeName(name?: string | null): string {
  if (!name) return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
