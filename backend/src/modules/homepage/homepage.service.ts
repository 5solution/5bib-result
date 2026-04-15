import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Model } from 'mongoose';
import Redis from 'ioredis';
import { Race, RaceDocument } from '../races/schemas/race.schema';
import {
  RaceResult,
  RaceResultDocument,
} from '../race-result/schemas/race-result.schema';
import {
  HomepageSummaryDto,
  PaginatedRaceDto,
  RaceCardDto,
} from './dto/homepage-summary.dto';

type LiveStatusApi = 'live' | 'upcoming' | 'ended';

/**
 * Maps internal race lifecycle status to the public API enum.
 *  - 'live'     → 'live'
 *  - 'pre_race' → 'upcoming'
 *  - 'ended'    → 'ended'
 *  - 'draft'    → excluded from public API (never returned)
 */
const STATUS_MAP: Record<string, LiveStatusApi | null> = {
  live: 'live',
  pre_race: 'upcoming',
  ended: 'ended',
  draft: null,
};

const CACHE_KEY_SUMMARY = 'homepage:summary';
const CACHE_TTL_SUMMARY = 300; // 5 minutes — matches PRD
const CACHE_TTL_ENDED_PAGE = 120; // 2 minutes
const endedPageKey = (page: number, limit: number) =>
  `homepage:ended:page:${page}:limit:${limit}`;

@Injectable()
export class HomepageService {
  private readonly logger = new Logger(HomepageService.name);

  constructor(
    @InjectModel(Race.name) private readonly raceModel: Model<RaceDocument>,
    @InjectModel(RaceResult.name)
    private readonly resultModel: Model<RaceResultDocument>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  // ── Cache helpers ────────────────────────────────────────────

  private async getFromCache<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      if (raw) return JSON.parse(raw) as T;
    } catch (err) {
      this.logger.warn(`Redis GET error for ${key}: ${(err as Error).message}`);
    }
    return null;
  }

  private async setCache(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      this.logger.warn(`Redis SET error for ${key}: ${(err as Error).message}`);
    }
  }

  /** Invalidate all homepage caches — call after race create/update/status change. */
  async invalidate(): Promise<number> {
    try {
      const keys = await this.redis.keys('homepage:*');
      if (keys.length > 0) {
        return await this.redis.del(...keys);
      }
    } catch (err) {
      this.logger.warn(
        `Redis invalidate error: ${(err as Error).message}`,
      );
    }
    return 0;
  }

  // ── Mapping ──────────────────────────────────────────────────

  /**
   * Normalize a lean Race document to the public RaceCardDto.
   * Accepts `finisherCount` from callers that have already aggregated results.
   */
  private toRaceCard(
    race: Race & { _id: unknown },
    finisherCount: number,
  ): RaceCardDto {
    const apiStatus = STATUS_MAP[race.status] ?? 'ended';
    return {
      slug: race.slug || String(race._id),
      name: race.title,
      coverImageUrl: race.imageUrl || race.bannerUrl || '',
      status: apiStatus,
      eventDate: race.startDate
        ? new Date(race.startDate).toISOString()
        : '',
      courses: Array.isArray(race.courses)
        ? race.courses
            .map((c) => c.distance || c.name)
            .filter((v): v is string => Boolean(v))
        : [],
      totalFinishers: apiStatus === 'ended' ? finisherCount : 0,
    };
  }

  /**
   * Count finishers per race in a single aggregation.
   * Returns a Map of raceId → finisher count.
   */
  private async countFinishersByRace(
    raceIds: string[],
  ): Promise<Map<string, number>> {
    if (raceIds.length === 0) return new Map();
    const rows = await this.resultModel
      .aggregate<{ _id: string; count: number }>([
        { $match: { raceId: { $in: raceIds } } },
        { $group: { _id: '$raceId', count: { $sum: 1 } } },
      ])
      .exec();
    const map = new Map<string, number>();
    for (const row of rows) map.set(row._id, row.count);
    return map;
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * GET /api/homepage/summary — cached payload for the homepage.
   *
   * Performance notes:
   *  - Single `find` with compound index { status: 1, startDate: -1 }.
   *  - Live + upcoming + ended(limit 9) fetched concurrently via aggregate
   *    when possible; we keep queries simple and rely on the index.
   *  - Finisher counts come from one aggregation across all ended races
   *    on this page (avoids N+1).
   */
  async getSummary(): Promise<{
    data: HomepageSummaryDto;
    cache: 'HIT' | 'MISS';
  }> {
    const cached = await this.getFromCache<HomepageSummaryDto>(CACHE_KEY_SUMMARY);
    if (cached) return { data: cached, cache: 'HIT' };

    const publicStatuses = ['live', 'pre_race', 'ended'];

    // Parallelize independent queries. `draft` is excluded everywhere.
    const [liveDocs, upcomingDocs, endedPage, totalRaces, totalResults] =
      await Promise.all([
        this.raceModel
          .find({ status: 'live' })
          .sort({ startDate: -1 })
          .limit(20)
          .lean<Array<Race & { _id: unknown }>>()
          .exec(),
        this.raceModel
          .find({ status: 'pre_race' })
          .sort({ startDate: 1 }) // upcoming — earliest first
          .limit(20)
          .lean<Array<Race & { _id: unknown }>>()
          .exec(),
        this.getEndedPageDocs(1, 9),
        this.raceModel
          .countDocuments({ status: { $in: publicStatuses } })
          .exec(),
        this.resultModel.estimatedDocumentCount().exec(),
      ]);

    // Finisher counts: only needed for ended races (live/upcoming always 0)
    const endedRaceIds = endedPage.items
      .map((r) => String(r._id))
      .filter(Boolean);
    const finishers = await this.countFinishersByRace(endedRaceIds);

    // Distinct athletes across the platform (approximation: distinct bibs by raceId is
    // too broad; a single athlete with multiple BIBs is counted once per result).
    // For PRD's "Vận động viên" stat we use total result rows as a proxy — same
    // as the existing homepage "totalResults" semantic. If product wants strict
    // "unique athletes" we can add a distinct count later (slow at 94K scale).
    const totalAthletes = totalResults;

    const summary: HomepageSummaryDto = {
      totalRaces,
      totalAthletes,
      totalResults,
      liveRaces: liveDocs.map((r) => this.toRaceCard(r, 0)),
      upcomingRaces: upcomingDocs.map((r) => this.toRaceCard(r, 0)),
      endedRaces: {
        items: endedPage.items.map((r) =>
          this.toRaceCard(r, finishers.get(String(r._id)) ?? 0),
        ),
        total: endedPage.total,
        page: 1,
        limit: 9,
      },
    };

    await this.setCache(CACHE_KEY_SUMMARY, summary, CACHE_TTL_SUMMARY);
    return { data: summary, cache: 'MISS' };
  }

  /**
   * Fetch a single page of ended races. Public API: separate cache key so
   * "Xem thêm" pagination doesn't re-fetch the whole summary.
   */
  async getEndedRacesPage(
    page: number,
    limit: number,
  ): Promise<{ data: PaginatedRaceDto; cache: 'HIT' | 'MISS' }> {
    const safePage = Math.max(1, page | 0);
    const safeLimit = Math.min(50, Math.max(1, limit | 0));
    const key = endedPageKey(safePage, safeLimit);

    const cached = await this.getFromCache<PaginatedRaceDto>(key);
    if (cached) return { data: cached, cache: 'HIT' };

    const { items: docs, total } = await this.getEndedPageDocs(
      safePage,
      safeLimit,
    );
    const finishers = await this.countFinishersByRace(
      docs.map((r) => String(r._id)),
    );
    const payload: PaginatedRaceDto = {
      items: docs.map((r) =>
        this.toRaceCard(r, finishers.get(String(r._id)) ?? 0),
      ),
      total,
      page: safePage,
      limit: safeLimit,
    };
    await this.setCache(key, payload, CACHE_TTL_ENDED_PAGE);
    return { data: payload, cache: 'MISS' };
  }

  private async getEndedPageDocs(
    page: number,
    limit: number,
  ): Promise<{
    items: Array<Race & { _id: unknown }>;
    total: number;
  }> {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.raceModel
        .find({ status: 'ended' })
        .sort({ startDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean<Array<Race & { _id: unknown }>>()
        .exec(),
      this.raceModel.countDocuments({ status: 'ended' }).exec(),
    ]);
    return { items, total };
  }
}
