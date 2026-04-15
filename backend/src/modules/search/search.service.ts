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
  BibSearchItemDto,
  RaceSearchItemDto,
  SearchResultDto,
  SearchType,
} from './dto/search.dto';

const RESULTS_LIMIT = 10;
const CACHE_TTL_BIB = 60; // 1 minute — PRD
// Race search is cheap (indexed) and not cached — regex/text results update instantly
// when a race is created/edited; matches PRD's "search:bib:{bib}" being the only
// listed search cache key.
const bibCacheKey = (bib: string) => `search:bib:${bib}`;

/**
 * Maps internal lifecycle to public API enum. Draft races are excluded
 * from search results entirely.
 */
function mapStatus(status: string): 'live' | 'upcoming' | 'ended' | null {
  if (status === 'live') return 'live';
  if (status === 'pre_race') return 'upcoming';
  if (status === 'ended') return 'ended';
  return null; // draft — excluded
}

/** Escape a user-provided string for safe use inside a MongoDB regex. */
function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Normalize a bib from user input — digits only, trim leading zeros preserved. */
function normalizeBib(input: string): string {
  return input.trim();
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @InjectModel(Race.name) private readonly raceModel: Model<RaceDocument>,
    @InjectModel(RaceResult.name)
    private readonly resultModel: Model<RaceResultDocument>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  private async getFromCache<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      if (raw) return JSON.parse(raw) as T;
    } catch (err) {
      this.logger.warn(
        `Redis GET error for ${key}: ${(err as Error).message}`,
      );
    }
    return null;
  }

  private async setCache(
    key: string,
    value: unknown,
    ttl: number,
  ): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttl);
    } catch (err) {
      this.logger.warn(
        `Redis SET error for ${key}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Auto-detect search type: pure digits → bib, else race.
   */
  detectType(q: string): SearchType {
    return /^\d+$/.test(q.trim()) ? 'bib' : 'race';
  }

  async search(
    rawQuery: string,
    typeHint?: SearchType,
  ): Promise<SearchResultDto> {
    const q = rawQuery.trim();
    if (q.length < 2) return { races: [], bibs: [] };

    const type = typeHint ?? this.detectType(q);

    if (type === 'bib') {
      const bibs = await this.searchByBib(q);
      return { races: [], bibs };
    }

    const races = await this.searchByRace(q);
    return { races, bibs: [] };
  }

  private async searchByRace(q: string): Promise<RaceSearchItemDto[]> {
    // Use indexed regex on title + slug. Case-insensitive substring match.
    // We exclude `draft` races so they never leak into public search.
    const pattern = new RegExp(escapeRegex(q), 'i');
    const docs = await this.raceModel
      .find(
        {
          status: { $in: ['live', 'pre_race', 'ended'] },
          $or: [{ title: pattern }, { slug: pattern }],
        },
        { slug: 1, title: 1, startDate: 1, status: 1 },
      )
      .sort({ startDate: -1 })
      .limit(RESULTS_LIMIT)
      .lean<
        Array<{
          _id: unknown;
          slug?: string;
          title: string;
          startDate?: Date;
          status: string;
        }>
      >()
      .exec();

    return docs
      .map((r): RaceSearchItemDto | null => {
        const mapped = mapStatus(r.status);
        if (!mapped) return null;
        return {
          slug: r.slug || String(r._id),
          name: r.title,
          eventDate: r.startDate ? new Date(r.startDate).toISOString() : '',
          status: mapped,
        };
      })
      .filter((x): x is RaceSearchItemDto => x !== null);
  }

  private async searchByBib(rawBib: string): Promise<BibSearchItemDto[]> {
    const bib = normalizeBib(rawBib);
    const cached = await this.getFromCache<BibSearchItemDto[]>(bibCacheKey(bib));
    if (cached) return cached;

    // Exact BIB match across all races. A single athlete may appear in
    // multiple races (same BIB reused). We aggregate + join to races
    // so we can filter out `draft` races in one pipeline.
    const rows = await this.resultModel
      .aggregate<{
        raceId: string;
        courseId: string;
        bib: string;
        name: string;
        distance?: string;
        race?: {
          slug?: string;
          title?: string;
          startDate?: Date;
          status?: string;
        };
      }>([
        { $match: { bib: bib } },
        { $limit: RESULTS_LIMIT * 3 /* allow filter loss */ },
        {
          $addFields: {
            raceObjId: { $toObjectId: '$raceId' },
          },
        },
        {
          $lookup: {
            from: 'races',
            localField: 'raceObjId',
            foreignField: '_id',
            as: 'race',
          },
        },
        { $unwind: { path: '$race', preserveNullAndEmptyArrays: false } },
        {
          $match: {
            'race.status': { $in: ['live', 'pre_race', 'ended'] },
          },
        },
        {
          $project: {
            _id: 0,
            raceId: 1,
            courseId: 1,
            bib: 1,
            name: 1,
            distance: 1,
            'race.slug': 1,
            'race.title': 1,
            'race.startDate': 1,
            'race.status': 1,
          },
        },
        { $limit: RESULTS_LIMIT },
      ])
      .exec();

    const items: BibSearchItemDto[] = rows
      .map((r): BibSearchItemDto | null => {
        if (!r.race) return null;
        return {
          raceSlug: r.race.slug || r.raceId,
          raceName: r.race.title || '',
          raceDate: r.race.startDate
            ? new Date(r.race.startDate).toISOString()
            : '',
          course: r.distance || '',
          bib: r.bib,
          athleteName: r.name || '',
        };
      })
      .filter((x): x is BibSearchItemDto => x !== null);

    await this.setCache(bibCacheKey(bib), items, CACHE_TTL_BIB);
    return items;
  }
}
