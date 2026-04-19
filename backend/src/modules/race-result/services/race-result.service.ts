import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Model } from 'mongoose';
import Redis from 'ioredis';
import axios from 'axios';
import { RaceResult, RaceResultDocument } from '../schemas/race-result.schema';
import { SyncLog, SyncLogDocument } from '../schemas/sync-log.schema';
import {
  ResultClaim,
  ResultClaimDocument,
} from '../schemas/result-claim.schema';
import { GetRaceResultsDto } from '../dto/get-race-results.dto';
import { SubmitClaimDto } from '../dto/submit-claim.dto';
import { RacesService } from '../../races/races.service';
import { TelegramService } from '../../notification/telegram.service';
import { MailService } from '../../notification/mail.service';
import { UploadService } from '../../upload/upload.service';
import * as crypto from 'crypto';

interface RaceResultApiItem {
  Bib: number;
  Name: string;
  OverallRank: number;
  GenderRank: number;
  CatRank: number;
  Gender: string;
  Category: string;
  ChipTime: string;
  GunTime: string;
  TimingPoint: string;
  Pace: string;
  Certi: string;
  Certificate: string;
  OverallRanks: string;
  GenderRanks: string;
  Chiptimes: string;
  Guntimes: string;
  Paces: string;
  TODs: string;
  Sectors: string;
  OverrankLive: number;
  Gap: string;
  Nationality: string;
  Nation: string;
  Member?: string;
  Started?: number;
  Finished?: number;
  DNF?: number;
}

@Injectable()
export class RaceResultService {
  private readonly logger = new Logger(RaceResultService.name);

  constructor(
    @InjectModel(RaceResult.name)
    private readonly resultModel: Model<RaceResultDocument>,
    @InjectModel(SyncLog.name)
    private readonly syncLogModel: Model<SyncLogDocument>,
    @InjectModel(ResultClaim.name)
    private readonly claimModel: Model<ResultClaimDocument>,
    private readonly racesService: RacesService,
    private readonly telegramService: TelegramService,
    private readonly mailService: MailService,
    private readonly uploadService: UploadService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  // ─── Cache helpers ────────────────────────────────────────────

  private filtersHash(dto: GetRaceResultsDto): string {
    const obj = {
      g: dto.gender || '',
      c: dto.category || '',
      n: dto.name || '',
      t: dto.type || '',
      nat: dto.nationality || '',
      sf: dto.sortField || '',
      sd: dto.sortDirection || '',
      ps: dto.pageSize || 10,
    };
    return crypto.createHash('md5').update(JSON.stringify(obj)).digest('hex').slice(0, 12);
  }

  private async getFromCache<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      if (raw) return JSON.parse(raw) as T;
    } catch (err) {
      this.logger.warn(`Redis GET error for ${key}: ${err.message}`);
    }
    return null;
  }

  private async setCache(key: string, value: any, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      this.logger.warn(`Redis SET error for ${key}: ${err.message}`);
    }
  }

  async purgeCache(courseId: string): Promise<number> {
    try {
      const patterns = [
        `results:${courseId}:*`,
        `leaderboard:${courseId}`,
        `stats:${courseId}`,
        `time-distribution:${courseId}`,
        `country-stats:${courseId}`,
        `country-rank:*:*`,
        `percentile:*:*`,
      ];
      let deleted = 0;
      for (const pattern of patterns) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          deleted += await this.redis.del(...keys);
        }
      }
      return deleted;
    } catch (err) {
      this.logger.warn(`Redis purge error: ${err.message}`);
      return 0;
    }
  }

  // ─── Distances ────────────────────────────────────────────────

  async getRaceDistances() {
    const races = await this.racesService.getRacesWithApiUrls();

    const distances: {
      raceId: string;
      distance: string;
      courseId: string;
      raceTitle: string;
    }[] = [];

    for (const race of races) {
      for (const course of race.courses) {
        if (course.apiUrl) {
          distances.push({
            raceId: race._id.toString(),
            distance: course.distance || course.name,
            courseId: course.courseId,
            raceTitle: race.title,
          });
        }
      }
    }

    return distances;
  }

  // ─── Sync ─────────────────────────────────────────────────────

  async syncAllRaceResults(): Promise<void> {
    this.logger.log('Starting race results sync...');

    const races = await this.racesService.getRacesWithApiUrls();

    if (!races.length) {
      this.logger.warn('No races with API URLs found for sync');
      return;
    }

    for (const race of races) {
      const raceId = race._id.toString();

      for (const course of race.courses) {
        if (!course.apiUrl) continue;

        const startTime = Date.now();
        try {
          const count = await this.syncRaceResult(
            raceId,
            course.courseId,
            course.distance || course.name,
            course.apiUrl,
          );

          // Purge cache after successful sync
          await this.purgeCache(course.courseId);

          await this.syncLogModel.create({
            raceId,
            courseId: course.courseId,
            status: 'success',
            resultCount: count,
            durationMs: Date.now() - startTime,
          });
        } catch (error) {
          this.logger.error(
            `Error syncing race ${raceId} course ${course.courseId}: ${error.message}`,
            error.stack,
          );

          await this.syncLogModel.create({
            raceId,
            courseId: course.courseId,
            status: 'failed',
            durationMs: Date.now() - startTime,
            errorMessage: error.message,
          });
        }
      }
    }

    this.logger.log('Race results sync completed');
  }

  /**
   * Sync a single course. Exposed for admin force-sync.
   */
  async syncSingleCourse(
    raceId: string,
    courseId: string,
    distance: string,
    apiUrl: string,
  ): Promise<number> {
    const startTime = Date.now();
    try {
      const count = await this.syncRaceResult(raceId, courseId, distance, apiUrl);
      await this.purgeCache(courseId);
      await this.syncLogModel.create({
        raceId,
        courseId,
        status: 'success',
        resultCount: count,
        durationMs: Date.now() - startTime,
      });
      return count;
    } catch (error) {
      await this.syncLogModel.create({
        raceId,
        courseId,
        status: 'failed',
        durationMs: Date.now() - startTime,
        errorMessage: error.message,
      });
      throw error;
    }
  }

  private normalizeRankValue(
    value: any,
    timingPoint?: string | number,
  ): {
    original: string;
    numeric: number | null;
  } {
    const strValue = String(value).trim();
    const numValue = parseInt(strValue, 10);

    if (numValue === -1 || numValue === 0 || isNaN(numValue)) {
      // Status-based ranks (DNF, DNS, DSQ, OOC) → 900000 (after normal ranks)
      const statusValues = ['DNF', 'DNS', 'DSQ', 'OOC'];
      const upperStr = strValue.toUpperCase();
      const upperTp = String(timingPoint ?? '').toUpperCase();
      if (
        statusValues.includes(upperStr) ||
        statusValues.includes(upperTp)
      ) {
        return { original: strValue, numeric: 900000 };
      }
      // Unknown / no status / zero rank → 999999 (last)
      return { original: strValue, numeric: 999999 };
    }

    return {
      original: strValue,
      numeric: numValue,
    };
  }

  private async syncRaceResult(
    raceId: string,
    courseId: string,
    distance: string,
    apiUrl: string,
  ): Promise<number> {
    this.logger.log(`Syncing ${distance} race results from ${apiUrl}...`);

    const response = await axios.get<RaceResultApiItem[]>(apiUrl, {
      timeout: 30000,
    });

    if (!response.data || !Array.isArray(response.data)) {
      this.logger.warn(
        `Invalid data received for ${distance}: ${typeof response.data}`,
      );
      return 0;
    }

    const bulkOps = response.data.map((result, idx) => {
      const overallRank = this.normalizeRankValue(result.OverallRank, result.TimingPoint);
      const genderRank = this.normalizeRankValue(result.GenderRank, result.TimingPoint);
      const catRank = this.normalizeRankValue(result.CatRank, result.TimingPoint);
      const overrankLive = this.normalizeRankValue(result.OverrankLive, result.TimingPoint);

      // Some APIs return Bib=0 for all athletes — extract participant ID from
      // certificate URL (e.g. .../certificates/7254/70KM → "7254"),
      // or fall back to 1-based index to guarantee uniqueness.
      const bibValue = (result.Bib !== 0 && result.Bib != null)
        ? String(result.Bib)
        : (() => {
            const certUrl = result.Certificate || result.Certi || '';
            const match = certUrl.match(/\/certificates\/(\d+)\//);
            return match ? match[1] : String(idx + 1);
          })();

      const doc = {
        raceId,
        courseId,
        bib: bibValue,
        name: result.Name,
        distance,
        overallRank: overallRank.original,
        overallRankNumeric: overallRank.numeric,
        genderRank: genderRank.original,
        genderRankNumeric: genderRank.numeric,
        categoryRank: catRank.original,
        categoryRankNumeric: catRank.numeric,
        gender: result.Gender,
        category: result.Category,
        chipTime: result.ChipTime,
        gunTime: result.GunTime,
        timingPoint: result.TimingPoint,
        pace: result.Pace,
        certi: result.Certi,
        certificate: result.Certificate,
        overallRanks: result.OverallRanks,
        genderRanks: result.GenderRanks,
        chiptimes: result.Chiptimes,
        guntimes: result.Guntimes,
        paces: result.Paces,
        tods: result.TODs,
        sectors: result.Sectors,
        overrankLive: overrankLive.original,
        overrankLiveNumeric: overrankLive.numeric,
        gap: result.Gap,
        nationality: result.Nationality,
        nation: result.Nation,
        member: result.Member || null,
        started: result.Started ?? null,
        finished: result.Finished ?? null,
        dnf: result.DNF ?? null,
        syncedAt: new Date(),
        rawData: result,
      };

      return {
        updateOne: {
          filter: { raceId, courseId, bib: bibValue },
          update: { $set: doc },
          upsert: true,
        },
      };
    });

    if (bulkOps.length > 0) {
      await this.resultModel.bulkWrite(bulkOps);
      this.logger.log(
        `Successfully synced ${bulkOps.length} results for ${distance}`,
      );
    } else {
      this.logger.warn(`No results found for ${distance}`);
    }

    return bulkOps.length;
  }

  // ─── Read endpoints ───────────────────────────────────────────

  async getRaceResults(dto: GetRaceResultsDto) {
    // Try cache
    const cacheKey = `results:${dto.raceId}:${dto.course_id || 'all'}:${dto.pageNo}:${this.filtersHash(dto)}`;
    const cached = await this.getFromCache<any>(cacheKey);
    if (cached) return cached;

    // Build sort
    const sortFieldMap: Record<string, string> = {
      OverallRank: 'overallRankNumeric',
      GenderRank: 'genderRankNumeric',
      CatRank: 'categoryRankNumeric',
      OverrankLive: 'overrankLiveNumeric',
      Name: 'name',
      ChipTime: 'chipTime',
      GunTime: 'gunTime',
    };

    const orderField = sortFieldMap[dto.sortField] || 'overallRankNumeric';
    const orderDirection = dto.sortDirection === 'DESC' ? -1 : 1;

    // Enforce pageSize cap (BR-08)
    const pageSize = Math.min(dto.pageSize ?? 10, 100);

    // Build filter
    const filter: Record<string, any> = {};
    if (dto.raceId) filter.raceId = dto.raceId;
    if (dto.course_id) filter.courseId = dto.course_id;
    if (dto.gender) filter.gender = dto.gender;
    if (dto.category) filter.category = dto.category;
    if (dto.nationality) {
      filter.$or = filter.$or
        ? [...filter.$or, { nationality: { $regex: dto.nationality, $options: 'i' } }, { nation: { $regex: dto.nationality, $options: 'i' } }]
        : [{ nationality: { $regex: dto.nationality, $options: 'i' } }, { nation: { $regex: dto.nationality, $options: 'i' } }];
    }
    if (dto.type) {
      const typeUpper = dto.type.toUpperCase();
      if (dto.type === 'finisher') {
        // Finishers: timingPoint is Finish or overallRankNumeric < 900000
        filter.timingPoint = { $regex: /finish/i };
      } else {
        filter.timingPoint = typeUpper;
      }
    }
    if (dto.name) {
      // Search both name and bib
      filter.$or = [
        { name: { $regex: dto.name, $options: 'i' } },
        { bib: dto.name },
      ];
    }

    // Get ALL results first (for duplicate rank filtering)
    const allResults = await this.resultModel
      .find(filter)
      .sort({ [orderField]: orderDirection })
      .lean()
      .exec();

    // Filter out duplicate ranks
    const filteredResults = this.filterDuplicateRanks(allResults);

    // Apply pagination to filtered results
    const skip = ((dto.pageNo ?? 1) - 1) * pageSize;
    const paginatedResults = filteredResults.slice(skip, skip + pageSize);

    const response = {
      data: paginatedResults.map((doc) => this.mapDocToResponse(doc)),
      pagination: {
        pageNo: dto.pageNo ?? 1,
        pageSize,
        total: filteredResults.length,
        totalPages: Math.ceil(filteredResults.length / pageSize),
      },
    };

    // Determine TTL — attempt to use race-level cacheTtlSeconds
    let ttl = 60;
    if (dto.course_id) {
      try {
        const races = await this.racesService.getRacesWithApiUrls();
        const race = races.find((r) =>
          r.courses.some((c) => c.courseId === dto.course_id),
        );
        if (race && race.cacheTtlSeconds) {
          ttl = race.cacheTtlSeconds;
        }
      } catch {
        // fall through to default
      }
    }

    await this.setCache(cacheKey, response, ttl);
    return response;
  }

  private filterDuplicateRanks(results: any[]): any[] {
    const seenRanks = new Set<string>();
    return results.filter((result) => {
      if (
        result.overallRank === '-1' ||
        result.overallRankNumeric === null ||
        result.overallRankNumeric >= 900000
      ) {
        return true;
      }
      if (seenRanks.has(result.overallRank)) {
        return false;
      }
      seenRanks.add(result.overallRank);
      return true;
    });
  }

  private formatRankDisplay(rank: string, timingPoint?: string | number): string {
    const statusValues = ['DNF', 'DNS', 'DSQ', 'OOC'];
    if (rank === '-1') {
      const tp = String(timingPoint ?? '').toUpperCase();
      if (statusValues.includes(tp)) return tp;
      return '';
    }
    return rank;
  }

  private mapDocToResponse(doc: any) {
    return {
      Bib: doc.bib,
      Name: doc.name,
      OverallRank: this.formatRankDisplay(doc.overallRank, doc.timingPoint),
      GenderRank: this.formatRankDisplay(doc.genderRank, doc.timingPoint),
      CatRank: this.formatRankDisplay(doc.categoryRank, doc.timingPoint),
      Gender: doc.gender,
      Category: doc.category,
      ChipTime: doc.chipTime,
      GunTime: doc.gunTime,
      TimingPoint: doc.timingPoint,
      Pace: doc.pace,
      Certi: doc.certi,
      Certificate: doc.certificate,
      OverallRanks: doc.overallRanks,
      GenderRanks: doc.genderRanks,
      Chiptimes: doc.chiptimes,
      Guntimes: doc.guntimes,
      Paces: doc.paces,
      TODs: doc.tods,
      Sectors: doc.sectors,
      OverrankLive: doc.overrankLive,
      Gap: doc.gap,
      Nationality: doc.nationality,
      Nation: doc.nation,
      Member: doc.member,
      Started: doc.started ?? null,
      Finished: doc.finished ?? null,
      DNF: doc.dnf ?? null,
      race_id: doc.raceId,
      course_id: doc.courseId,
      distance: doc.distance,
      synced_at: doc.syncedAt,
      splits: doc.splits ?? [],
      avatarUrl: doc.avatarUrl ?? null,
    };
  }

  /**
   * Global search across all races by name or bib
   */
  async globalSearch(query: string, limit = 20) {
    if (!query || query.trim().length < 2) return { data: [] };

    const q = query.trim();
    const filter = {
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { bib: q },
      ],
    };

    const results = await this.resultModel
      .find(filter)
      .sort({ overallRankNumeric: 1 })
      .limit(limit)
      .lean()
      .exec();

    // Enrich with race info
    const raceIds = [...new Set(results.map((r) => r.raceId))];
    const races = await this.racesService.findByIds(raceIds);
    const raceMap = new Map(races.map((r) => [String(r._id), r]));

    const data = results.map((doc) => {
      const race = raceMap.get(doc.raceId);
      return {
        ...this.mapDocToResponse(doc),
        race_name: race?.title || '',
        race_slug: race?.slug || '',
        race_date: race?.startDate || '',
      };
    });

    return { data };
  }

  /**
   * Get available filter options (genders, categories) for a course
   */
  async getFilterOptions(courseId: string) {
    const cacheKey = `filters:${courseId}`;
    const cached = await this.getFromCache<any>(cacheKey);
    if (cached) return cached;

    const [genders, categories] = await Promise.all([
      this.resultModel.distinct('gender', { courseId }).exec(),
      this.resultModel.distinct('category', { courseId }).exec(),
    ]);

    const result = {
      genders: genders.filter(Boolean).sort(),
      categories: categories.filter(Boolean).sort(),
    };

    await this.setCache(cacheKey, result, 300); // cache 5 min
    return result;
  }

  /**
   * Get leaderboard: top N results for a course, cached in Redis (60s)
   */
  async getLeaderboard(courseId: string, limit: number = 10) {
    const cacheKey = `leaderboard:${courseId}`;
    const cached = await this.getFromCache<any[]>(cacheKey);
    if (cached) return cached;

    const results = await this.resultModel
      .find({ courseId, overallRankNumeric: { $nin: [999999, null] } })
      .sort({ overallRankNumeric: 1 })
      .limit(limit)
      .lean()
      .exec();

    const mapped = results.map((doc) => this.mapDocToResponse(doc));
    await this.setCache(cacheKey, mapped, 60);
    return mapped;
  }

  /**
   * Get athlete detail by bib + race.
   * Computes rankDelta + isPaceAlert on splits (BR-01, BR-02).
   */
  async getAthleteDetail(raceId: string, bib: string) {
    const cacheKey = `athlete:${raceId}:${bib}`;
    const cached = await this.getFromCache<any>(cacheKey);
    if (cached) return cached;

    const result = await this.resultModel
      .findOne({ raceId, bib })
      .lean()
      .exec();

    if (!result) return null;
    const mapped = this.mapDocToResponse(result);

    // Compute avgSpeed for pace alert baseline (BR-02)
    // speed in km/h = distanceKm / chipTimeHours
    const distanceKmMatch = (result.distance || '').match(/[\d.]+/);
    const distanceKm = distanceKmMatch ? parseFloat(distanceKmMatch[0]) : null;
    let avgSpeed: number | null = null;
    if (distanceKm && result.chipTime) {
      const parts = result.chipTime.split(':').map(Number);
      const hours = parts.length === 3
        ? parts[0] + parts[1] / 60 + parts[2] / 3600
        : parts.length === 2
          ? parts[0] / 60 + parts[1] / 3600
          : null;
      if (hours && hours > 0) avgSpeed = distanceKm / hours;
    }

    // Augment splits with rankDelta + isPaceAlert
    if (Array.isArray(result.splits)) {
      mapped.splits = result.splits.map((split, index) => {
        const prevRank = index === 0 ? null : (result.splits[index - 1]?.rank ?? null);
        const currRank = split.rank ?? null;
        const rankDelta =
          index === 0 || prevRank === null || currRank === null
            ? 0
            : prevRank - currRank; // positive = moved up (BR-01)
        const isPaceAlert =
          split.speed != null && avgSpeed != null
            ? split.speed < avgSpeed * 0.8 // pace drop ≥ 20% (BR-02)
            : false;
        return { ...split, rankDelta, isPaceAlert };
      });
    }

    const response = {
      ...mapped,
      _id: result._id?.toString(),
      editHistory: result.editHistory ?? [],
      isManuallyEdited: result.isManuallyEdited ?? false,
    };

    // Cache 5 minutes — athlete detail is stable (cleared on edit)
    await this.setCache(cacheKey, response, 300);
    return response;
  }

  /**
   * Compare multiple athletes by bibs
   */
  async compareAthletes(raceId: string, bibs: string[]) {
    const results = await this.resultModel
      .find({ raceId, bib: { $in: bibs } })
      .lean()
      .exec();

    return results.map((doc) => this.mapDocToResponse(doc));
  }

  /**
   * Course stats — aggregated statistics, cached 60s
   */
  async getCourseStats(courseId: string) {
    const cacheKey = `stats:${courseId}`;
    const cached = await this.getFromCache<any>(cacheKey);
    if (cached) return cached;

    const pipeline = [
      {
        $match: {
          courseId,
          overallRankNumeric: { $nin: [999999, null] },
          chipTime: { $nin: ['', null] },
        },
      },
      {
        $addFields: {
          chipTimeParts: { $split: ['$chipTime', ':'] },
        },
      },
      {
        $addFields: {
          chipTimeSeconds: {
            $add: [
              {
                $multiply: [
                  {
                    $convert: {
                      input: { $arrayElemAt: ['$chipTimeParts', 0] },
                      to: 'int',
                      onError: 0,
                      onNull: 0,
                    },
                  },
                  3600,
                ],
              },
              {
                $multiply: [
                  {
                    $convert: {
                      input: { $arrayElemAt: ['$chipTimeParts', 1] },
                      to: 'int',
                      onError: 0,
                      onNull: 0,
                    },
                  },
                  60,
                ],
              },
              {
                $convert: {
                  input: { $arrayElemAt: ['$chipTimeParts', 2] },
                  to: 'int',
                  onError: 0,
                  onNull: 0,
                },
              },
            ],
          },
        },
      },
      // Exclude finishers with zero/invalid chip time ("0:00:00", missing
      // parts, ...). Otherwise $min returns 0 and avg is skewed downward.
      { $match: { chipTimeSeconds: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          totalFinishers: { $sum: 1 },
          avgTimeSeconds: { $avg: '$chipTimeSeconds' },
          minTimeSeconds: { $min: '$chipTimeSeconds' },
          maxTimeSeconds: { $max: '$chipTimeSeconds' },
          genders: { $push: '$gender' },
        },
      },
    ];

    const [agg, nationalities] = await Promise.all([
      this.resultModel.aggregate(pipeline).exec().then((r) => r[0]),
      this.resultModel.distinct('nationality', { courseId, nationality: { $nin: ['', null] } }).exec(),
    ]);

    // Count starters/dnf/dns/dsq from timingPoint field
    const statusCounts = await this.resultModel.aggregate([
      { $match: { courseId } },
      {
        $group: {
          _id: { $toUpper: '$timingPoint' },
          count: { $sum: 1 },
          // pick up course-level counters (stored on every doc from API)
          started: { $max: '$started' },
          finished: { $max: '$finished' },
          dnf: { $max: '$dnf' },
        },
      },
    ]).exec();

    // Aggregate started/finished/dnf from course-level counter fields (from API)
    const firstDoc = await this.resultModel.findOne({ courseId }).lean().exec();
    const apiStarted = firstDoc?.started ?? 0;
    const apiFinished = firstDoc?.finished ?? 0;
    const apiDnf = firstDoc?.dnf ?? 0;

    let dnsCount = 0;
    let dsqCount = 0;
    for (const sc of statusCounts) {
      const tp = sc._id as string;
      if (tp === 'DNS') dnsCount = sc.count;
      if (tp === 'DSQ') dsqCount = sc.count;
    }

    if (!agg) {
      const empty = {
        totalFinishers: 0,
        avgTime: null,
        minTime: null,
        maxTime: null,
        avgPace: null,
        maleCount: 0,
        femaleCount: 0,
        nationalityCount: nationalities.length || 0,
        started: apiStarted,
        finished: apiFinished,
        dnf: apiDnf,
        dns: dnsCount,
        dsq: dsqCount,
        fastestTime: null,
        avgChipTime: null,
      };
      await this.setCache(cacheKey, empty, 60);
      return empty;
    }

    const secondsToHMS = (s: number) => {
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = Math.floor(s % 60);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    };

    const maleCount = (agg.genders as string[]).filter(
      (g) => g === 'Male',
    ).length;
    const femaleCount = (agg.genders as string[]).filter(
      (g) => g === 'Female',
    ).length;

    const stats = {
      totalFinishers: agg.totalFinishers,
      avgTime: secondsToHMS(Math.round(agg.avgTimeSeconds)),
      minTime: secondsToHMS(agg.minTimeSeconds),
      maxTime: secondsToHMS(agg.maxTimeSeconds),
      avgPace: null as string | null,
      maleCount,
      femaleCount,
      nationalityCount: nationalities.length || 0,
      // Extended (PRD Phase 1)
      started: apiStarted,
      finished: apiFinished,
      dnf: apiDnf,
      dns: dnsCount,
      dsq: dsqCount,
      fastestTime: secondsToHMS(agg.minTimeSeconds),
      avgChipTime: secondsToHMS(Math.round(agg.avgTimeSeconds)),
    };

    await this.setCache(cacheKey, stats, 60);
    return stats;
  }

  // ─── Stats Visualizations (F-03, F-04, F-06) ─────────────────

  /**
   * Parse "HH:MM:SS" or "MM:SS" chip time → seconds. Returns null for invalid.
   */
  private chipTimeToSeconds(chipTime: string | undefined | null): number | null {
    if (!chipTime || typeof chipTime !== 'string') return null;
    const parts = chipTime.split(':').map((p) => parseInt(p, 10));
    if (parts.some((p) => isNaN(p))) return null;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return null;
  }

  private secondsToHms(s: number): string {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${m}:${String(sec).padStart(2, '0')}`;
  }

  // Cap for heavy aggregations. If a course has > this many finishers, we
  // sample instead of scanning all docs (trade-off: ±1% accuracy for latency).
  private static readonly AGG_SAMPLE_THRESHOLD = 10_000;

  /**
   * F-03 — Time distribution histogram for a course's finishers.
   * Buckets auto-sized to 7–10 based on count. Cached 120s.
   */
  async getTimeDistribution(courseId: string) {
    const cacheKey = `time-distribution:${courseId}`;
    const cached = await this.getFromCache<any>(cacheKey);
    if (cached) return cached;

    // Pull chipTime strings for finishers, apply $limit if over threshold
    // to keep aggregation bounded even on huge races.
    const totalFinishersCheck = await this.resultModel.countDocuments({
      courseId,
      timingPoint: 'Finish',
      chipTime: { $nin: ['', null] },
    }).exec();

    const sampled = totalFinishersCheck > RaceResultService.AGG_SAMPLE_THRESHOLD;

    const docs = await this.resultModel
      .aggregate([
        {
          $match: {
            courseId,
            timingPoint: 'Finish',
            chipTime: { $nin: ['', null] },
          },
        },
        ...(sampled
          ? [{ $sample: { size: RaceResultService.AGG_SAMPLE_THRESHOLD } }]
          : []),
        { $project: { chipTime: 1 } },
      ])
      .exec();

    const secondsArr: number[] = [];
    for (const d of docs) {
      const s = this.chipTimeToSeconds(d.chipTime);
      if (s !== null && s > 0) secondsArr.push(s);
    }

    if (secondsArr.length === 0) {
      const empty = {
        buckets: [],
        totalFinishers: 0,
        minSeconds: 0,
        maxSeconds: 0,
        avgSeconds: 0,
        sampled: false,
      };
      await this.setCache(cacheKey, empty, 120);
      return empty;
    }

    secondsArr.sort((a, b) => a - b);
    const minSeconds = secondsArr[0];
    const maxSeconds = secondsArr[secondsArr.length - 1];
    const avgSeconds = Math.round(
      secondsArr.reduce((a, b) => a + b, 0) / secondsArr.length,
    );

    // Bucket count: min(10, ceil(sqrt(n))), at least 1.
    const numBuckets =
      minSeconds === maxSeconds
        ? 1
        : Math.max(1, Math.min(10, Math.ceil(Math.sqrt(secondsArr.length))));

    const range = maxSeconds - minSeconds || 1;
    const bucketWidth = range / numBuckets;

    const buckets = Array.from({ length: numBuckets }, (_, i) => ({
      minSeconds: Math.round(minSeconds + i * bucketWidth),
      maxSeconds: Math.round(
        i === numBuckets - 1 ? maxSeconds : minSeconds + (i + 1) * bucketWidth,
      ),
      count: 0,
    }));

    for (const s of secondsArr) {
      let idx = Math.floor((s - minSeconds) / bucketWidth);
      if (idx >= numBuckets) idx = numBuckets - 1;
      if (idx < 0) idx = 0;
      buckets[idx].count += 1;
    }

    const total = secondsArr.length;
    const bucketsOut = buckets.map((b) => ({
      range: `${this.secondsToHms(b.minSeconds)}–${this.secondsToHms(b.maxSeconds)}`,
      minSeconds: b.minSeconds,
      maxSeconds: b.maxSeconds,
      count: b.count,
      percentage: Math.round((b.count / total) * 1000) / 10, // 1 decimal
    }));

    const result = {
      buckets: bucketsOut,
      totalFinishers: sampled ? totalFinishersCheck : total,
      minSeconds,
      maxSeconds,
      avgSeconds,
      sampled,
    };

    await this.setCache(cacheKey, result, 120);
    return result;
  }

  /**
   * F-04 — Top countries aggregated for a course. Cached 120s.
   */
  async getCountryStats(courseId: string) {
    const cacheKey = `country-stats:${courseId}`;
    const cached = await this.getFromCache<any>(cacheKey);
    if (cached) return cached;

    const docs = await this.resultModel
      .aggregate([
        {
          $match: {
            courseId,
            timingPoint: 'Finish',
            nationality: { $nin: ['', null] },
            chipTime: { $nin: ['', null] },
          },
        },
        {
          $group: {
            _id: '$nationality',
            count: { $sum: 1 },
            bestChipTime: { $min: '$chipTime' },
          },
        },
        { $sort: { count: -1 as const } },
        { $limit: 50 },
      ])
      .exec();

    const countries = docs.map((d) => {
      const iso2 = this.nationalityToIso2(d._id as string);
      const bestSeconds = this.chipTimeToSeconds(d.bestChipTime) ?? 0;
      return {
        nationality: d._id as string,
        iso2,
        count: d.count as number,
        bestTime: d.bestChipTime as string,
        bestSeconds,
      };
    });

    const result = {
      countries,
      totalCountries: countries.length,
    };

    await this.setCache(cacheKey, result, 120);
    return result;
  }

  /**
   * F-04 — Country rank for one athlete on their course.
   * Returns rank among same-nationality finishers (null if athlete not a finisher).
   * Cached 300s per athlete.
   */
  async getCountryRank(raceId: string, bib: string) {
    const cacheKey = `country-rank:${raceId}:${bib}`;
    const cached = await this.getFromCache<any>(cacheKey);
    if (cached) return cached;

    const athlete = await this.resultModel
      .findOne({ raceId, bib })
      .select({
        courseId: 1,
        nationality: 1,
        timingPoint: 1,
        overallRankNumeric: 1,
      })
      .lean()
      .exec();

    if (!athlete || !athlete.nationality) {
      return {
        rank: null,
        total: 0,
        nationality: athlete?.nationality ?? '',
        iso2: '',
      };
    }

    // Per Option A: DNF athletes do not have a country rank (badge hidden).
    if (athlete.timingPoint !== 'Finish') {
      const total = await this.resultModel.countDocuments({
        courseId: athlete.courseId,
        nationality: athlete.nationality,
        timingPoint: 'Finish',
      }).exec();
      const out = {
        rank: null,
        total,
        nationality: athlete.nationality,
        iso2: this.nationalityToIso2(athlete.nationality),
      };
      await this.setCache(cacheKey, out, 300);
      return out;
    }

    const filter = {
      courseId: athlete.courseId,
      nationality: athlete.nationality,
      timingPoint: 'Finish',
    };

    const [fasterCount, total] = await Promise.all([
      this.resultModel
        .countDocuments({
          ...filter,
          overallRankNumeric: { $lt: athlete.overallRankNumeric ?? 999999 },
        })
        .exec(),
      this.resultModel.countDocuments(filter).exec(),
    ]);

    const out = {
      rank: fasterCount + 1,
      total,
      nationality: athlete.nationality,
      iso2: this.nationalityToIso2(athlete.nationality),
    };

    await this.setCache(cacheKey, out, 300);
    return out;
  }

  /**
   * F-06 — Performance percentile for one athlete. Cached 300s.
   * Percentile = (slower count / total) * 100 — higher = better.
   */
  async getPercentile(raceId: string, bib: string) {
    const cacheKey = `percentile:${raceId}:${bib}`;
    const cached = await this.getFromCache<any>(cacheKey);
    if (cached) return cached;

    const athlete = await this.resultModel
      .findOne({ raceId, bib })
      .select({ courseId: 1, chipTime: 1, timingPoint: 1 })
      .lean()
      .exec();

    if (!athlete || athlete.timingPoint !== 'Finish') {
      return {
        percentile: null,
        slowerCount: 0,
        totalFinishers: 0,
        athleteSeconds: 0,
        avgSeconds: 0,
        minSeconds: 0,
      };
    }

    const athleteSeconds = this.chipTimeToSeconds(athlete.chipTime);
    if (athleteSeconds === null || athleteSeconds <= 0) {
      return {
        percentile: null,
        slowerCount: 0,
        totalFinishers: 0,
        athleteSeconds: 0,
        avgSeconds: 0,
        minSeconds: 0,
      };
    }

    // Leverage existing getCourseStats for avg/min (also cached)
    const stats = await this.getCourseStats(athlete.courseId);
    const totalFinishers = stats?.totalFinishers ?? 0;
    const minSeconds = this.chipTimeToSeconds(stats?.minTime) ?? 0;
    const avgSeconds = this.chipTimeToSeconds(stats?.avgTime) ?? 0;

    // Count slower finishers via chipTime string comparison only works when
    // all strings have identical widths. Since DB chipTime is "HH:MM:SS",
    // alphabetical comparison IS chronological when H is 1 or 2 digits
    // consistently — but to be safe we compare numeric via aggregation.
    const result = await this.resultModel
      .aggregate([
        {
          $match: {
            courseId: athlete.courseId,
            timingPoint: 'Finish',
            chipTime: { $nin: ['', null] },
          },
        },
        {
          $addFields: {
            chipTimeSecondsComputed: {
              $let: {
                vars: { p: { $split: ['$chipTime', ':'] } },
                in: {
                  $add: [
                    {
                      $multiply: [
                        {
                          $convert: {
                            input: { $arrayElemAt: ['$$p', 0] },
                            to: 'int',
                            onError: 0,
                            onNull: 0,
                          },
                        },
                        3600,
                      ],
                    },
                    {
                      $multiply: [
                        {
                          $convert: {
                            input: { $arrayElemAt: ['$$p', 1] },
                            to: 'int',
                            onError: 0,
                            onNull: 0,
                          },
                        },
                        60,
                      ],
                    },
                    {
                      $convert: {
                        input: { $arrayElemAt: ['$$p', 2] },
                        to: 'int',
                        onError: 0,
                        onNull: 0,
                      },
                    },
                  ],
                },
              },
            },
          },
        },
        {
          $match: {
            chipTimeSecondsComputed: { $gt: athleteSeconds },
          },
        },
        { $count: 'slower' },
      ])
      .exec();

    const slowerCount = result[0]?.slower ?? 0;
    const percentile =
      totalFinishers > 0
        ? Math.round((slowerCount / totalFinishers) * 100)
        : null;

    const out = {
      percentile,
      slowerCount,
      totalFinishers,
      athleteSeconds,
      avgSeconds,
      minSeconds,
    };
    await this.setCache(cacheKey, out, 300);
    return out;
  }

  /**
   * Convert raw nationality string to ISO2 code (or empty if unresolvable).
   * Mirrors the frontend country-flags util for consistent API output.
   */
  private nationalityToIso2(input: string | undefined | null): string {
    if (!input) return '';
    const trimmed = input.trim();
    if (!trimmed) return '';
    // Already ISO2
    if (trimmed.length === 2 && /^[A-Za-z]{2}$/.test(trimmed)) {
      return trimmed.toUpperCase();
    }
    const lower = trimmed.toLowerCase();
    const map: Record<string, string> = {
      'vietnam': 'VN', 'viet nam': 'VN', 'vn': 'VN', 'vnm': 'VN', 'vie': 'VN',
      'france': 'FR', 'fra': 'FR',
      'japan': 'JP', 'jpn': 'JP',
      'korea': 'KR', 'south korea': 'KR', 'kor': 'KR',
      'china': 'CN', 'chn': 'CN',
      'thailand': 'TH', 'tha': 'TH',
      'singapore': 'SG', 'sgp': 'SG',
      'malaysia': 'MY', 'mys': 'MY',
      'indonesia': 'ID', 'idn': 'ID',
      'philippines': 'PH', 'phl': 'PH',
      'australia': 'AU', 'aus': 'AU',
      'united states': 'US', 'usa': 'US',
      'united kingdom': 'GB', 'uk': 'GB', 'gbr': 'GB',
      'germany': 'DE', 'deu': 'DE',
      'italy': 'IT', 'ita': 'IT',
      'spain': 'ES', 'esp': 'ES',
      'canada': 'CA', 'can': 'CA',
      'brazil': 'BR', 'bra': 'BR',
      'india': 'IN', 'ind': 'IN',
      'netherlands': 'NL', 'nld': 'NL',
      'belgium': 'BE', 'bel': 'BE',
      'switzerland': 'CH', 'che': 'CH',
      'sweden': 'SE', 'swe': 'SE',
      'norway': 'NO', 'nor': 'NO',
      'denmark': 'DK', 'dnk': 'DK',
      'new zealand': 'NZ', 'nzl': 'NZ',
      'taiwan': 'TW', 'twn': 'TW',
      'hong kong': 'HK', 'hkg': 'HK',
      'russia': 'RU', 'rus': 'RU',
      'ukraine': 'UA', 'ukr': 'UA',
      'poland': 'PL', 'pol': 'PL',
      'portugal': 'PT', 'prt': 'PT',
      'austria': 'AT', 'aut': 'AT',
      'ireland': 'IE', 'irl': 'IE',
      'south africa': 'ZA', 'zaf': 'ZA',
      'cambodia': 'KH', 'khm': 'KH',
      'laos': 'LA', 'lao': 'LA',
    };
    return map[lower] ?? '';
  }

  // ─── Claims ───────────────────────────────────────────────────

  async submitClaim(dto: SubmitClaimDto) {
    const claim = await this.claimModel.create(dto);

    // Send Telegram notification
    this.telegramService.notifyClaimSubmitted({
      bib: dto.bib,
      name: dto.name,
      phone: dto.phone,
      email: dto.email,
      description: dto.description,
      raceId: dto.raceId,
      courseId: dto.courseId,
    }).catch(() => {}); // fire and forget

    return { data: claim.toObject(), success: true };
  }

  // ─── Admin helpers ────────────────────────────────────────────

  async deleteResultsByCourse(courseId: string) {
    const result = await this.resultModel.deleteMany({ courseId }).exec();
    await this.purgeCache(courseId);
    return result.deletedCount;
  }

  async getSyncLogs(page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [list, total] = await Promise.all([
      this.syncLogModel
        .find()
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean()
        .exec(),
      this.syncLogModel.countDocuments().exec(),
    ]);

    return {
      data: list,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getClaims(page = 1, pageSize = 20, status?: string) {
    const skip = (page - 1) * pageSize;
    const filter: Record<string, any> = {};
    if (status) filter.status = status;

    const [list, total] = await Promise.all([
      this.claimModel
        .find(filter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean()
        .exec(),
      this.claimModel.countDocuments(filter).exec(),
    ]);

    return {
      data: list,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  /**
   * Resolve a claim (BR-04).
   * - action=approved → auto-update result + set autoUpdated=true
   * - action=rejected → just mark rejected, no result change
   * - Idempotency: if claim.status !== 'pending' → throw ConflictException
   */
  async resolveClaim(
    claimId: string,
    action: 'approved' | 'rejected',
    resolutionNote: string,
    resolvedBy: string,
  ) {
    // Atomic: only transitions from 'pending' — prevents double-approval race condition
    const claim = await this.claimModel.findOneAndUpdate(
      { _id: claimId, status: 'pending' },
      {
        $set: {
          status: action,
          resolvedBy,
          resolvedAt: new Date(),
          resolutionNote,
          adminNote: resolutionNote,
        },
      },
      { new: true },
    ).exec();

    if (!claim) {
      const existing = await this.claimModel.findById(claimId).lean().exec();
      if (!existing) throw new NotFoundException('Claim not found');
      throw new ConflictException(`Claim already ${existing.status}`);
    }

    if (action === 'approved') {
      const result = await this.resultModel
        .findOne({ raceId: claim.raceId, bib: claim.bib })
        .exec();
      if (result) {
        const entry = {
          editedBy: resolvedBy,
          editedAt: new Date(),
          field: 'claim_approved',
          oldValue: null,
          newValue: null,
          reason: `Claim approved: ${resolutionNote}`,
        };
        await this.resultModel.updateOne(
          { _id: result._id },
          {
            $push: { editHistory: entry },
            $set: { isManuallyEdited: true },
          },
        ).exec();
        await this.purgeCache(claim.courseId);
        await this.redis.del(`athlete:${result.raceId}:${claim.bib}`);
        await this.claimModel.updateOne({ _id: claimId }, { $set: { autoUpdated: true } }).exec();
      }
    }

    return this.claimModel.findById(claimId).lean().exec();
  }

  /**
   * Edit a race result manually with full audit trail (BR-03).
   * adminUserId: from JWT payload.
   */
  async editResult(
    resultId: string,
    fields: {
      chipTime?: string;
      gunTime?: string;
      name?: string;
      status?: string;
      overallRank?: number;
    },
    reason: string,
    adminUserId: string,
  ) {
    const result = await this.resultModel.findById(resultId).exec();
    if (!result) throw new NotFoundException('Result not found');

    const auditEntries: {
      editedBy: string;
      editedAt: Date;
      field: string;
      oldValue: unknown;
      newValue: unknown;
      reason: string;
    }[] = [];

    const updateSet: Record<string, unknown> = { isManuallyEdited: true };

    const now = new Date();

    if (fields.chipTime !== undefined && fields.chipTime !== result.chipTime) {
      auditEntries.push({ editedBy: adminUserId, editedAt: now, field: 'chipTime', oldValue: result.chipTime, newValue: fields.chipTime, reason });
      updateSet['chipTime'] = fields.chipTime;
    }
    if (fields.gunTime !== undefined && fields.gunTime !== result.gunTime) {
      auditEntries.push({ editedBy: adminUserId, editedAt: now, field: 'gunTime', oldValue: result.gunTime, newValue: fields.gunTime, reason });
      updateSet['gunTime'] = fields.gunTime;
    }
    if (fields.name !== undefined && fields.name !== result.name) {
      auditEntries.push({ editedBy: adminUserId, editedAt: now, field: 'name', oldValue: result.name, newValue: fields.name, reason });
      updateSet['name'] = fields.name;
    }
    if (fields.status !== undefined && fields.status !== result.timingPoint) {
      auditEntries.push({ editedBy: adminUserId, editedAt: now, field: 'timingPoint', oldValue: result.timingPoint, newValue: fields.status, reason });
      updateSet['timingPoint'] = fields.status;
    }
    if (fields.overallRank !== undefined) {
      auditEntries.push({ editedBy: adminUserId, editedAt: now, field: 'overallRank', oldValue: result.overallRank, newValue: String(fields.overallRank), reason });
      updateSet['overallRank'] = String(fields.overallRank);
      updateSet['overallRankNumeric'] = fields.overallRank;
    }

    const updated = await this.resultModel.findByIdAndUpdate(
      resultId,
      {
        $set: updateSet,
        ...(auditEntries.length > 0 ? { $push: { editHistory: { $each: auditEntries } } } : {}),
      },
      { new: true },
    ).lean().exec();

    // Invalidate course-level cache + athlete-level cache
    if (updated) {
      await this.purgeCache(updated.courseId);
      await this.redis.del(`athlete:${updated.raceId}:${updated.bib}`);
    }

    return {
      success: true,
      updatedResult: this.mapDocToResponse(updated),
      auditEntries,
    };
  }

  // ─── Avatar OTP (P2-B-ii) ─────────────────────────────────────

  async requestAvatarOtp(raceId: string, bib: string, email: string) {
    const result = await this.resultModel.findOne({ raceId, bib }).lean().exec();
    if (!result) throw new NotFoundException('Athlete not found');

    // Email can be stored on the doc itself or inside rawData
    const storedEmail: string | undefined =
      result.email ||
      result.rawData?.Email ||
      result.rawData?.email;

    if (!storedEmail) {
      throw new BadRequestException('No email on record for this athlete');
    }
    if (storedEmail.toLowerCase().trim() !== email.toLowerCase().trim()) {
      throw new BadRequestException('Email does not match our records');
    }

    // ── Anti-spam ────────────────────────────────────────────────
    // 1) Per-bib cooldown: must wait 60s between resend requests
    const cooldownKey = `avatar-otp-cooldown:${raceId}:${bib}`;
    const cooldownTtl = await this.redis.ttl(cooldownKey);
    if (cooldownTtl > 0) {
      throw new BadRequestException(
        `Please wait ${cooldownTtl} seconds before requesting another OTP`,
      );
    }

    // 2) Per-email rate limit: max 5 OTP requests per hour
    const rateKey = `avatar-otp-rate:${email.toLowerCase().trim()}`;
    const count = await this.redis.incr(rateKey);
    if (count === 1) {
      await this.redis.expire(rateKey, 3600); // first increment sets TTL
    }
    if (count > 5) {
      // Self-heal: if TTL was lost (crash between INCR and EXPIRE), restore it
      const ttl = await this.redis.ttl(rateKey);
      if (ttl < 0) await this.redis.expire(rateKey, 3600);
      throw new BadRequestException(
        'Too many OTP requests. Please try again in 1 hour',
      );
    }
    // ─────────────────────────────────────────────────────────────

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpKey = `avatar-otp:${raceId}:${bib}`;
    await Promise.all([
      this.redis.set(otpKey, otp, 'EX', 600),
      this.redis.set(cooldownKey, '1', 'EX', 60),
    ]);

    await this.mailService.sendAvatarOtpEmail({
      toEmail: email,
      name: result.name,
      bib: result.bib,
      otp,
    });

    return { success: true, message: 'OTP sent to your email (valid 10 minutes)' };
  }

  async uploadAvatar(raceId: string, bib: string, otp: string, file: Express.Multer.File) {
    const redisKey = `avatar-otp:${raceId}:${bib}`;
    const storedOtp = await this.redis.get(redisKey);
    if (!storedOtp || storedOtp !== otp.trim()) {
      throw new BadRequestException('Invalid or expired OTP');
    }
    await this.redis.del(redisKey);

    // Resize to 200×200 square crop using @napi-rs/canvas
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createCanvas, loadImage } = require('@napi-rs/canvas');
    const img = await loadImage(file.buffer);
    const canvas = createCanvas(200, 200);
    const ctx = canvas.getContext('2d');
    const size = Math.min(img.width, img.height);
    const ox = (img.width - size) / 2;
    const oy = (img.height - size) / 2;
    ctx.drawImage(img, ox, oy, size, size, 0, 0, 200, 200);
    const resizedBuffer: Buffer = canvas.toBuffer('image/jpeg');

    const uploadFile: Express.Multer.File = {
      ...file,
      buffer: resizedBuffer,
      mimetype: 'image/jpeg',
      originalname: `avatar-${raceId}-${bib}.jpg`,
      size: resizedBuffer.length,
    };

    const url = await this.uploadService.uploadFile(uploadFile);
    if (!url) throw new BadRequestException('Upload failed');

    const updated = await this.resultModel
      .findOneAndUpdate({ raceId, bib }, { $set: { avatarUrl: url } }, { new: true })
      .lean()
      .exec();

    if (updated?.courseId) await this.purgeCache(updated.courseId);

    return { success: true, avatarUrl: url };
  }
}
