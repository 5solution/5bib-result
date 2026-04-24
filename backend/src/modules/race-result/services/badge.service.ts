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

/** Sub-X thresholds by normalized distance bucket. */
const SUBX_THRESHOLDS: Array<{
  distanceMatch: (d: string) => boolean;
  thresholds: { seconds: number; type: BadgeType; label: string }[];
}> = [
  {
    // Marathon ~ 42K
    distanceMatch: (d) =>
      /\b(42|marathon|full)\b/i.test(d) && !/half/i.test(d),
    thresholds: [
      { seconds: 3 * 3600, type: 'SUB3H', label: 'Sub-3H' },
      { seconds: 3.5 * 3600, type: 'SUB3_30H', label: 'Sub-3:30H' },
      { seconds: 4 * 3600, type: 'SUB4H', label: 'Sub-4H' },
    ],
  },
  {
    // Half marathon ~ 21K
    distanceMatch: (d) => /\b(21|half)\b/i.test(d),
    thresholds: [
      { seconds: 90 * 60, type: 'SUB90M', label: 'Sub-90M' },
      { seconds: 105 * 60, type: 'SUB_1_45H', label: 'Sub-1:45H' },
      { seconds: 120 * 60, type: 'SUB2H', label: 'Sub-2H' },
    ],
  },
  {
    distanceMatch: (d) => /\b10\b/i.test(d) && !/\b21|42/i.test(d),
    thresholds: [
      { seconds: 45 * 60, type: 'SUB45M', label: 'Sub-45M' },
      { seconds: 60 * 60, type: 'SUB_1H', label: 'Sub-1H' },
    ],
  },
  {
    distanceMatch: (d) => /\b5\b/i.test(d) && !/\b(15|25|50)/i.test(d),
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
    const [pbBadge, firstRaceBadge, streakBadge] = await Promise.all([
      this.detectPersonalBest(result).catch((err) => {
        this.logger.warn(`PB detect failed: ${err.message}`);
        return null;
      }),
      this.detectFirstRace(bib).catch(() => null),
      this.detectStreak(bib).catch(() => null),
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
    if (streakBadge) badges.push(streakBadge);

    // Sort by priority: PB > PODIUM > AG_PODIUM > Sub-X > others
    return sortBadges(badges);
  }

  // ─── Detection methods ──────────────────────────────────────

  private detectPodium(result: {
    overallRankNumeric?: number;
    overallRank?: string;
  }): Badge | null {
    const rank =
      result.overallRankNumeric ?? parseInt(result.overallRank || '', 10);
    if (isNaN(rank) || rank < 1 || rank > 3) return null;
    const labels = ['🥇 Vô địch chung cuộc', '🥈 Á quân chung cuộc', '🥉 Hạng 3 chung cuộc'];
    const colors = ['#f59e0b', '#94a3b8', '#d97706'];
    return {
      type: 'PODIUM',
      label: labels[rank - 1],
      shortLabel: `#${rank}`,
      color: colors[rank - 1],
      meta: { rank },
    };
  }

  private detectAgePodium(result: {
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

  private detectSubX(result: {
    distance?: string;
    chipTime?: string;
  }): Badge[] {
    const distance = result.distance || '';
    const chipSeconds = parseChipTime(result.chipTime);
    if (chipSeconds <= 0) return [];

    const ruleset = SUBX_THRESHOLDS.find((r) => r.distanceMatch(distance));
    if (!ruleset) return [];

    // Pick the HIGHEST tier achieved (fastest threshold that the athlete beat).
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

  private detectUltra(result: { distance?: string }): Badge | null {
    const distance = result.distance || '';
    // Match 50K+, 100K, 100M, "Ultra", "UTMB", etc.
    const match = distance.match(/(\d+)\s*k/i);
    const km = match ? parseInt(match[1], 10) : 0;
    if (km >= 50 || /ultra|100\s*m|utmb/i.test(distance)) {
      return {
        type: 'ULTRA',
        label: '🏔️ Ultra Finisher',
        shortLabel: 'Ultra',
        color: '#059669',
        meta: { distance },
      };
    }
    return null;
  }

  private async detectPersonalBest(result: {
    bib: string;
    distance?: string;
    chipTime?: string;
    raceId?: string;
  }): Promise<Badge | null> {
    if (!result.distance || !result.chipTime) return null;
    const currentSec = parseChipTime(result.chipTime);
    if (currentSec <= 0) return null;

    // Find athlete's other finishes at same distance
    const history = await this.resultModel
      .find({
        bib: result.bib,
        distance: result.distance,
        raceId: { $ne: result.raceId },
        chipTime: { $exists: true, $ne: null },
      })
      .select({ chipTime: 1, raceId: 1 })
      .lean()
      .exec();

    if (history.length === 0) return null; // first race at this distance → no PB

    const prevBest = history
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
