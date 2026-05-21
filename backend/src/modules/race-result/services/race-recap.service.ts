/**
 * FEATURE-046 — Race Recap Service (programmatic SEO race recap pages).
 * FEATURE-056 — Extended with 3 GAPs:
 *   - GAP #1: City per podium athlete (derive chain via city-derive helper).
 *   - GAP #2: Negative-split rich detail (avg1H/2H/delta/finishersAnalyzed).
 *   - GAP #3: Spotlight stories per winner (admin-curated or auto-gen fallback).
 *
 * Aggregation engine cho `/giai-chay/[slug]/recap`. Cache Redis 1h TTL.
 * SETNX anti-stampede lock port pattern F-027. PII strip enforced at DTO.
 *
 * Per Manager Plan Adjustment #2 (backend pre-render markdown → insightHtml),
 * #4 (atomic findOneAndUpdate version lock), #5 (publishedAt stays original on re-edit).
 *
 * F-056 refactor: pure aggregation logic moved to `utils/race-aggregations.ts`.
 * Service consumes helpers; preserves existing 14 F-046 tests + adds 14 TC-56-XX.
 *
 * BR coverage: BR-46-01..02/05..14/19..21/25..26/31..33 + BR-56-01..25.
 *
 * DATA INTEGRITY (Danny "k nó kiện đấy"):
 * - Podium ranking source-of-truth: vendor `genderRankNumeric` ASC (chipTimeMs tie-break).
 * - Chip times preserved AS-IS (no reformatting).
 * - Athlete names preserved AS-IS (no canonicalize — legal spelling).
 * - City chip hidden when derivation null (defamation safety).
 * - Auto-gen spotlight neutral factual (no editorial interpretation).
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Model } from 'mongoose';
import Redis from 'ioredis';
// CJS module — `import x from 'sanitize-html'` doesn't expose `.defaults` consistently.
// Use `import x = require(...)` pattern matching articles/sanitize.util.ts.
import sanitizeHtml = require('sanitize-html');

import { RaceResult, RaceResultDocument } from '../schemas/race-result.schema';
import {
  RaceRecapInsight,
  RaceRecapInsightDocument,
} from '../schemas/race-recap-insight.schema';
import { RacesService } from '../../races/races.service';
import {
  RaceRecapResponseDto,
  RecapHeroStatsDto,
  RecapPodiumPerCourseDto,
  RecapPodiumCellDto,
  RecapPaceStatsDto,
  RecapNegativeSplitDto,
  RecapAGBreakdownPerCourseDto,
  RecapAGBucketDto,
  RecapSpotlightPerCourseDto,
  RecapSpotlightStoryDto,
  RecapCourseDistributionDto,
  RecapArticleMetaDto,
} from '../dto/race-recap-response.dto';
import {
  RecapInsightPublicDto,
  RecapInsightAdminDto,
  UpsertRecapInsightDto,
} from '../dto/recap-insight.dto';
import {
  computePodium as computePodiumHelper,
  computePaceStats as computePaceStatsHelper,
  computeAGBreakdown as computeAGBreakdownHelper,
  computeStatusCounts as computeStatusCountsHelper,
  computeNegSplit as computeNegSplitHelper,
  computeCourseDistribution as computeCourseDistributionHelper,
  chipTimeToSeconds,
  type RaceResultLean,
  type AggregatedPodiumCell,
} from '../utils/race-aggregations';
import { deriveCity } from '../utils/city-derive';
import { RecapArticleGenerator, type GeneratedRecapArticle } from './recap-article-generator.service';
import { RecapArticleStorage } from './recap-article-storage.service';

const SANITIZE_ALLOWLIST: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'strong',
    'em',
    'ul',
    'ol',
    'li',
    'br',
    'a',
    'h2',
    'h3',
    'h4',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
};

const SPOTLIGHT_SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'strong', 'em', 'br'],
  allowedAttributes: {},
  allowedSchemes: [],
};

interface CourseInfo {
  courseId: string;
  name: string;
  distance?: string;
  /** F-056 scope expansion 2026-05-21 PAUSE-56-09 — per-course elevation gain (m). */
  elevationGain?: number;
}

/**
 * Lean row shape — superset of {@link RaceResultLean} used by helpers, plus
 * legacy `started`/`finished`/`dnf` and PII-safe fields the service may consume.
 */
interface CourseResultRow {
  raceId: string;
  courseId: string;
  bib: string;
  name?: string;
  chipTime?: string;
  gunTime?: string;
  pace?: string;
  gender?: string;
  category?: string;
  overallRank?: string;
  genderRank?: string;
  genderRankNumeric?: number;
  categoryRank?: string;
  chiptimes?: string;
  paces?: string;
  started?: number;
  finished?: number;
  dnf?: number;
  avatarUrl?: string;
  club?: string;
  nationality?: string;
}

@Injectable()
export class RaceRecapService {
  private readonly logger = new Logger(RaceRecapService.name);

  private static readonly RECAP_CACHE_TTL = 3600;
  private static readonly INSIGHT_CACHE_TTL = 600;
  private static readonly LOCK_TTL = 30;

  private static readonly RECAP_PREFIX = 'recap:race:';
  private static readonly INSIGHT_PREFIX = 'recap:insight:';
  private static readonly LOCK_PREFIX = 'recap:lock:';

  constructor(
    @InjectModel(RaceResult.name)
    private readonly resultModel: Model<RaceResultDocument>,
    @InjectModel(RaceRecapInsight.name)
    private readonly insightModel: Model<RaceRecapInsightDocument>,
    @InjectRedis() private readonly redis: Redis,
    private readonly racesService: RacesService,
    // F-056 Phase 4 — Auto-articles generator + S3 storage. Optional via DI
    // (tests inject undefined → graceful skip).
    @Optional() private readonly articleGenerator?: RecapArticleGenerator,
    @Optional() private readonly articleStorage?: RecapArticleStorage,
  ) {}

  async getRecap(raceId: string): Promise<RaceRecapResponseDto> {
    const cacheKey = `${RaceRecapService.RECAP_PREFIX}${raceId}`;
    const cached = await this.safeRedisGet(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as RaceRecapResponseDto;
      } catch {
        this.logger.warn(`[getRecap] cache parse failed for ${raceId}`);
      }
    }

    const raceLookup = await this.racesService.getRaceById(raceId, false);
    if (!raceLookup.success || !raceLookup.data) {
      throw new NotFoundException('Recap không tồn tại cho race này');
    }
    const race = raceLookup.data as {
      _id: string;
      title: string;
      slug?: string;
      endDate?: Date;
      status?: string;
      courses?: unknown[];
    };

    if (race.status !== 'ended') {
      throw new NotFoundException('Recap không tồn tại cho race này');
    }

    const resultCount = await this.resultModel
      .countDocuments({ raceId })
      .exec();
    if (resultCount === 0) {
      throw new NotFoundException('Đang chuẩn bị recap');
    }

    const lockKey = `${RaceRecapService.LOCK_PREFIX}${raceId}`;
    const lockAcquired = await this.safeRedisSetNx(
      lockKey,
      RaceRecapService.LOCK_TTL,
    );
    if (!lockAcquired) {
      await this.sleep(200);
      const retryCache = await this.safeRedisGet(cacheKey);
      if (retryCache) {
        try {
          return JSON.parse(retryCache) as RaceRecapResponseDto;
        } catch {
          /* fall through */
        }
      }
    }

    try {
      const recap = await this.computeRecap(race, raceId);
      await this.safeRedisSetEx(
        cacheKey,
        RaceRecapService.RECAP_CACHE_TTL,
        JSON.stringify(recap),
      );
      return recap;
    } finally {
      await this.safeRedisDel(lockKey);
    }
  }

  async getPublicInsight(raceId: string): Promise<RecapInsightPublicDto> {
    const cacheKey = `${RaceRecapService.INSIGHT_PREFIX}${raceId}`;
    const cached = await this.safeRedisGet(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as RecapInsightPublicDto;
      } catch {
        /* fall through */
      }
    }

    const doc = await this.insightModel
      .findOne({ raceId, courseId: null, publishedAt: { $ne: null } })
      .exec();

    const dto: RecapInsightPublicDto = doc
      ? {
          insightMarkdown: doc.insightMarkdown,
          insightHtml: doc.insightHtml,
          publishedAt: doc.publishedAt?.toISOString() ?? null,
          updatedAt: doc.updated_at?.toISOString() ?? null,
          authorName: doc.authorName,
        }
      : {
          insightMarkdown: null,
          insightHtml: null,
          publishedAt: null,
          updatedAt: null,
          authorName: null,
        };

    await this.safeRedisSetEx(
      cacheKey,
      RaceRecapService.INSIGHT_CACHE_TTL,
      JSON.stringify(dto),
    );
    return dto;
  }

  async getAdminInsight(raceId: string): Promise<RecapInsightAdminDto | null> {
    const doc = await this.insightModel
      .findOne({ raceId, courseId: null })
      .exec();
    if (!doc) return null;
    return this.toAdminInsightDto(doc);
  }

  async upsertInsight(
    raceId: string,
    actor: { userId: string; userName: string },
    body: UpsertRecapInsightDto,
  ): Promise<RecapInsightAdminDto> {
    const sanitizedMarkdown = sanitizeHtml(
      body.insightMarkdown,
      SANITIZE_ALLOWLIST,
    );
    const renderedHtml = this.markdownToHtml(sanitizedMarkdown);

    const existing = await this.insightModel
      .findOne({ raceId, courseId: null })
      .exec();

    if (existing) {
      if (
        body.expectedVersion != null &&
        body.expectedVersion !== existing.version
      ) {
        throw new ConflictException({
          message:
            'Insight đã được update bởi admin khác, refresh để xem version mới',
          currentVersion: existing.version,
        });
      }

      const isNowPublished = body.publish;
      const wasPublished = existing.publishedAt != null;
      const publishedAtToSet =
        isNowPublished && wasPublished
          ? existing.publishedAt
          : isNowPublished
            ? new Date()
            : null;

      const updated = await this.insightModel
        .findOneAndUpdate(
          { _id: existing._id, version: existing.version },
          {
            $set: {
              insightMarkdown: sanitizedMarkdown,
              insightHtml: renderedHtml,
              authorUserId: actor.userId,
              authorName: actor.userName,
              publishedAt: publishedAtToSet,
            },
            $inc: { version: 1 },
          },
          { new: true },
        )
        .exec();

      if (!updated) {
        const fresh = await this.insightModel
          .findOne({ raceId, courseId: null })
          .exec();
        throw new ConflictException({
          message:
            'Insight đã được update bởi admin khác, refresh để xem version mới',
          currentVersion: fresh?.version,
        });
      }

      await this.invalidateInsightCaches(raceId);
      return this.toAdminInsightDto(updated);
    }

    const created = await this.insightModel.create({
      raceId,
      courseId: null,
      insightMarkdown: sanitizedMarkdown,
      insightHtml: renderedHtml,
      authorUserId: actor.userId,
      authorName: actor.userName,
      publishedAt: body.publish ? new Date() : null,
      version: 1,
    });

    await this.invalidateInsightCaches(raceId);
    return this.toAdminInsightDto(created);
  }

  async invalidateRecapCache(raceId: string): Promise<void> {
    await this.safeRedisDel(`${RaceRecapService.RECAP_PREFIX}${raceId}`);
  }

  // ─── Core aggregation (F-056 refactor — consumes pure helpers) ─────────

  private async computeRecap(
    race: {
      _id: string;
      title: string;
      slug?: string;
      endDate?: Date;
      courses?: unknown[];
    },
    raceId: string,
  ): Promise<RaceRecapResponseDto> {
    const allResults = await this.resultModel
      .find({ raceId })
      .lean<CourseResultRow[]>()
      .exec();

    const courseMap = new Map<string, CourseInfo>();
    const racesCourses = (race.courses ?? []) as Array<{
      courseId: string;
      name?: string;
      distance?: string;
      // F-056 scope expansion 2026-05-21 PAUSE-56-09 — elevationGain from race
      // schema (admin-input field). Used to derive hero.elevationGain (max).
      elevationGain?: number;
    }>;
    for (const c of racesCourses) {
      if (c.courseId) {
        courseMap.set(c.courseId, {
          courseId: c.courseId,
          name: c.name ?? c.courseId,
          distance: c.distance,
          elevationGain: c.elevationGain ?? undefined,
        });
      }
    }
    for (const r of allResults) {
      if (r.courseId && !courseMap.has(r.courseId)) {
        courseMap.set(r.courseId, { courseId: r.courseId, name: r.courseId });
      }
    }

    const courses = Array.from(courseMap.values());
    // DATA INTEGRITY: hero counts derived from FULL result set (all statuses),
    // helper applies status classification per RaceResult.started + chipTime.
    const heroCounts = computeStatusCountsHelper(allResults);
    // Hero with extra fields built AFTER per-course loop (needs longest-course
    // podium winner + max elevationGain). Placeholder, overridden below.
    let hero = this.computeHero(heroCounts, race.title);

    const podiums: RecapPodiumPerCourseDto[] = [];
    const paceStats: RecapPaceStatsDto[] = [];
    const negativeSplits: RecapNegativeSplitDto[] = [];
    const agBreakdowns: RecapAGBreakdownPerCourseDto[] = [];
    // F-056 scope expansion 2026-05-21 BR-56-28 — Variation B distribution chart.
    const finisherDistribution: RecapCourseDistributionDto[] = [];

    // Load admin-curated insight (if any) up front so spotlight builder can
    // merge curated vs auto-gen entries per BR-56-03 fallback chain.
    const insightDoc = await this.insightModel
      .findOne({ raceId, courseId: null })
      .lean()
      .exec();
    const curatedStories = insightDoc?.spotlightStories ?? [];

    const spotlightStoriesByCourse: RecapSpotlightPerCourseDto[] = [];

    for (const course of courses) {
      const courseResults = allResults.filter(
        (r) => r.courseId === course.courseId,
      );

      // ── Podium (helper) ───────────────────────────────────────────────
      const podiumRaw = computePodiumHelper(courseResults as RaceResultLean[]);
      // DATA INTEGRITY: city resolved per cell via derive chain (BR-56-04).
      // Use raw RaceResult row matched by bib (helper already filtered finishers).
      const male = podiumRaw.male.map((cell) =>
        this.enrichCellWithCity(cell, courseResults),
      );
      const female = podiumRaw.female.map((cell) =>
        this.enrichCellWithCity(cell, courseResults),
      );
      podiums.push({
        courseId: course.courseId,
        courseName: course.name,
        distance: course.distance,
        male,
        female,
        maleFinisherCount: podiumRaw.maleFinisherCount,
        femaleFinisherCount: podiumRaw.femaleFinisherCount,
      });

      // ── Pace stats (helper) ───────────────────────────────────────────
      const paceRaw = computePaceStatsHelper(courseResults as RaceResultLean[]);
      paceStats.push({
        courseId: course.courseId,
        courseName: course.name,
        medianPace: paceRaw.medianPace,
        p10Pace: paceRaw.p10Pace,
        p90Pace: paceRaw.p90Pace,
        distribution: paceRaw.distribution,
        finisherCount: paceRaw.finisherCount,
      });

      // ── Negative split (helper — F-056 GAP #2 + Clarification #3) ────
      const negRaw = computeNegSplitHelper(courseResults as RaceResultLean[]);
      negativeSplits.push({
        courseId: course.courseId,
        courseName: course.name,
        negativeSplitPercent: negRaw.value,
        interpretation: negRaw.interpretation,
        avgFirstHalf: negRaw.avgFirstHalf,
        avgSecondHalf: negRaw.avgSecondHalf,
        deltaSeconds: negRaw.deltaSeconds,
        finishersAnalyzed: negRaw.finishersAnalyzed,
        benchmark: negRaw.benchmark,
      });

      // ── AG breakdown (helper) ─────────────────────────────────────────
      const agRaw = computeAGBreakdownHelper(courseResults as RaceResultLean[]);
      const buckets: RecapAGBucketDto[] = agRaw.map((b) => ({
        category: b.category,
        finisherCount: b.finisherCount,
        top5: b.top5.map((c) => this.toCellDto(c)),
      }));
      agBreakdowns.push({
        courseId: course.courseId,
        courseName: course.name,
        buckets,
      });

      // ── Spotlight stories (F-056 GAP #3) ──────────────────────────────
      const stories = this.buildSpotlightStoriesForCourse(
        course,
        podiumRaw,
        curatedStories,
      );
      if (stories.length > 0) {
        spotlightStoriesByCourse.push({
          courseId: course.courseId,
          courseName: course.name,
          stories,
        });
      }

      // ── Finisher distribution (F-056 scope expansion BR-56-28) ────────
      const distRaw = computeCourseDistributionHelper(
        courseResults as RaceResultLean[],
      );
      finisherDistribution.push({
        courseId: course.courseId,
        courseName: course.name,
        distance: course.distance,
        finisherCount: distRaw.finisherCount,
        medianPace: distRaw.medianPace,
        bestChipTime: distRaw.bestChipTime,
      });
    }

    // F-056 scope expansion 2026-05-21 — Sort distribution by numeric distance
    // ASC for left-to-right bar chart render (BR-56-28).
    finisherDistribution.sort((a, b) => {
      const da = parseFloat((a.distance ?? '0').replace(',', '.'));
      const db = parseFloat((b.distance ?? '0').replace(',', '.'));
      return da - db;
    });

    // F-056 scope expansion 2026-05-21 BR-56-26 — Hero winning M/F from the
    // longest-distance course (cinematic header). Picks last sorted distance.
    const longestCourseDist = [...finisherDistribution].sort((a, b) => {
      const da = parseFloat((a.distance ?? '0').replace(',', '.'));
      const db = parseFloat((b.distance ?? '0').replace(',', '.'));
      return db - da;
    })[0];
    const longestCoursePodium = longestCourseDist
      ? podiums.find((p) => p.courseId === longestCourseDist.courseId)
      : podiums[0];
    const winnerMale = longestCoursePodium?.male[0];
    const winnerFemale = longestCoursePodium?.female[0];

    // F-056 scope expansion 2026-05-21 PAUSE-56-09 — elevationGain = max across
    // course.elevationGain (admin input). Null if no course has data → hide
    // tile in UI.
    const elevationGains = courses
      .map((c) => c.elevationGain)
      .filter((g): g is number => typeof g === 'number' && g > 0);
    const elevationGain =
      elevationGains.length > 0 ? Math.max(...elevationGains) : undefined;

    // Merge extra hero fields (winning M/F + elevation) per scope expansion.
    hero = {
      ...hero,
      winningTimeMale: winnerMale?.chipTime,
      winningNameMale: winnerMale?.name,
      winningTimeFemale: winnerFemale?.chipTime,
      winningNameFemale: winnerFemale?.name,
      elevationGain,
    };

    const response: RaceRecapResponseDto = {
      raceId,
      raceTitle: race.title,
      raceSlug: race.slug ?? raceId,
      endDate: race.endDate ? race.endDate.toString() : undefined,
      hero,
      podiums,
      paceStats,
      negativeSplits,
      agBreakdowns,
      spotlightStoriesByCourse:
        spotlightStoriesByCourse.length > 0
          ? spotlightStoriesByCourse
          : undefined,
      finisherDistribution:
        finisherDistribution.length > 0 ? finisherDistribution : undefined,
      computedAt: new Date().toISOString(),
    };

    // F-056 Phase 4 — Auto-articles: try S3 read first, fallback generate +
    // write back. Best-effort: if S3 fails, generator runs inline and articles
    // returned without persistence (UX preserved, S3 retry next call).
    response.recapArticles = await this.assembleArticles(raceId, response);

    return response;
  }

  /**
   * F-056 Phase 4 — Admin trigger: delete all S3 articles for race + invalidate
   * recap cache so next public GET regenerates fresh. Returns deleted count.
   */
  async regenerateArticles(raceId: string): Promise<number> {
    if (!this.articleStorage) return 0;
    const deleted = await this.articleStorage.deleteAllForRace(raceId);
    await this.invalidateRecapCache(raceId);
    return deleted;
  }

  /**
   * F-056 Phase 4 — Fetch articles from S3 if present, else generate + persist.
   * Returns DTO shape (re-renders HTML from markdown to keep sanitize allowlist
   * consistent even for older S3 entries).
   */
  private async assembleArticles(
    raceId: string,
    recap: RaceRecapResponseDto,
  ): Promise<RecapArticleMetaDto[] | undefined> {
    if (!this.articleGenerator || !this.articleStorage) {
      return undefined; // DI optional — graceful skip in tests
    }
    try {
      let stored = await this.articleStorage.getArticles(raceId);
      if (!stored || stored.length === 0) {
        // Cold path: generate + write to S3
        const generated = this.articleGenerator.generateForRace(recap);
        if (generated.length === 0) return undefined;
        await this.articleStorage.putArticles(raceId, generated);
        stored = generated;
      } else {
        // Warm path: re-render HTML from markdown for fresh sanitize.
        // Storage layer leaves html field empty by design (avoid drift).
        stored = stored.map((a) => ({
          ...a,
          html: this.articleGenerator
            ? rerenderMarkdownToSanitizedHtml(a.markdown)
            : a.html,
        }));
      }
      return stored.map(toArticleMetaDto);
    } catch (err) {
      this.logger.warn(
        `[assembleArticles] race=${raceId} failed: ${(err as Error).message} — articles skipped`,
      );
      return undefined;
    }
  }

  /**
   * Map helper output to DTO + resolve city per podium athlete (BR-56-04).
   * DATA INTEGRITY: bib match is exact-string; if missing or duplicate, city = null
   * (do not guess — defamation risk).
   */
  private enrichCellWithCity(
    cell: AggregatedPodiumCell,
    courseRows: CourseResultRow[],
  ): RecapPodiumCellDto {
    const row = courseRows.find((r) => r.bib === cell.bib);
    const city = row
      ? deriveCity({
          nationality: row.nationality ?? null,
          club: row.club ?? null,
        })
      : null;
    return {
      name: cell.name,
      bib: cell.bib,
      chipTime: cell.chipTime,
      category: cell.category,
      medal: cell.medal,
      avatarUrl: cell.avatarUrl,
      city: city ?? undefined,
    };
  }

  private toCellDto(cell: AggregatedPodiumCell): RecapPodiumCellDto {
    return {
      name: cell.name,
      bib: cell.bib,
      chipTime: cell.chipTime,
      category: cell.category,
      medal: cell.medal,
      avatarUrl: cell.avatarUrl,
      city: cell.city,
    };
  }

  private computeHero(
    counts: {
      finishers: number;
      dnf: number;
      dns: number;
      dsq: number;
      registered: number;
    },
    raceTitle: string,
  ): RecapHeroStatsDto {
    const headline = `${counts.finishers.toLocaleString('vi-VN')} VĐV về đích tại ${raceTitle}`;
    return {
      totalFinishers: counts.finishers,
      dnsCount: counts.dns,
      dnfCount: counts.dnf,
      dsqCount: counts.dsq,
      registered: counts.registered,
      headline,
    };
  }

  /**
   * F-056 GAP #3 — Spotlight per course. For each podium top-1 (M + F), look up
   * admin-curated entry in `RaceRecapInsight.spotlightStories`. If missing,
   * auto-gen neutral factual Vietnamese sentence (BR-56-03/20).
   *
   * DATA INTEGRITY: auto-gen template avoids editorial interpretation per Danny
   * mandate ("k nó kiện đấy"). Only objective facts: name, bib, distance, time.
   */
  private buildSpotlightStoriesForCourse(
    course: CourseInfo,
    podium: {
      male: AggregatedPodiumCell[];
      female: AggregatedPodiumCell[];
    },
    curated: ReadonlyArray<{
      courseId: string;
      gender: 'M' | 'F';
      winnerBib: string;
      markdown: string;
      html: string;
    }>,
  ): RecapSpotlightStoryDto[] {
    const stories: RecapSpotlightStoryDto[] = [];

    // Iterate Top-1 male then Top-1 female (BR-56-20 order matches podium).
    const winners: Array<{ gender: 'M' | 'F'; cell?: AggregatedPodiumCell }> = [
      { gender: 'M', cell: podium.male[0] },
      { gender: 'F', cell: podium.female[0] },
    ];

    for (const { gender, cell } of winners) {
      if (!cell) continue; // course has no podium for that gender
      const curatedEntry = curated.find(
        (s) =>
          s.courseId === course.courseId &&
          s.gender === gender &&
          s.winnerBib === cell.bib,
      );

      if (curatedEntry) {
        stories.push({
          courseId: course.courseId,
          gender,
          winnerBib: cell.bib,
          winnerName: cell.name,
          markdown: curatedEntry.markdown,
          html: curatedEntry.html,
          source: 'admin',
        });
      } else {
        const auto = this.autoGenSpotlight(cell, course, gender);
        stories.push(auto);
      }
    }

    return stories;
  }

  /**
   * Auto-gen neutral fallback (BR-56-03/20).
   * Template strictly factual — no superlatives, no comparisons.
   */
  private autoGenSpotlight(
    cell: AggregatedPodiumCell,
    course: CourseInfo,
    gender: 'M' | 'F',
  ): RecapSpotlightStoryDto {
    const distance = course.distance ?? course.name;
    const category = cell.category ? ` hạng ${cell.category}` : '';
    const markdown = `**${cell.name}** đã hoàn thành ${distance} với chip time **${cell.chipTime}** — đứng top 1${category}.`;
    const html = sanitizeHtml(
      `<p><strong>${escapeHtml(cell.name)}</strong> đã hoàn thành ${escapeHtml(distance)} với chip time <strong>${escapeHtml(cell.chipTime)}</strong> — đứng top 1${escapeHtml(category)}.</p>`,
      SPOTLIGHT_SANITIZE,
    );
    return {
      courseId: course.courseId,
      gender,
      winnerBib: cell.bib,
      winnerName: cell.name,
      markdown,
      html,
      source: 'auto',
    };
  }

  // ─── Backward-compatible helper retained for tests (delegate to util) ──

  /**
   * Backward-compat shim — F-046 spec asserts on this public method
   * (`service.parseChipTimeSeconds(...)`). Delegates to pure helper.
   */
  parseChipTimeSeconds(chipTime: string): number {
    return chipTimeToSeconds(chipTime);
  }

  // ─── Insight admin helpers (unchanged from F-046) ──────────────────────

  private toAdminInsightDto(
    doc: RaceRecapInsightDocument,
  ): RecapInsightAdminDto {
    return {
      id: doc._id.toString(),
      raceId: doc.raceId,
      courseId: doc.courseId,
      insightMarkdown: doc.insightMarkdown,
      insightHtml: doc.insightHtml,
      status: doc.publishedAt ? 'published' : 'draft',
      publishedAt: doc.publishedAt?.toISOString() ?? null,
      updatedAt: doc.updated_at.toISOString(),
      authorName: doc.authorName,
      version: doc.version,
    };
  }

  private markdownToHtml(markdown: string): string {
    let html = markdown
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    html = html
      .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>');

    html = html
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');

    html = html.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" rel="noopener nofollow">$1</a>',
    );

    const lines = html.split('\n');
    const out: string[] = [];
    let inUl = false;
    let inOl = false;
    for (const line of lines) {
      if (/^- /.test(line)) {
        if (!inUl) {
          if (inOl) {
            out.push('</ol>');
            inOl = false;
          }
          out.push('<ul>');
          inUl = true;
        }
        out.push(`<li>${line.replace(/^- /, '')}</li>`);
      } else if (/^\d+\. /.test(line)) {
        if (!inOl) {
          if (inUl) {
            out.push('</ul>');
            inUl = false;
          }
          out.push('<ol>');
          inOl = true;
        }
        out.push(`<li>${line.replace(/^\d+\. /, '')}</li>`);
      } else {
        if (inUl) {
          out.push('</ul>');
          inUl = false;
        }
        if (inOl) {
          out.push('</ol>');
          inOl = false;
        }
        if (line.trim()) {
          if (!line.startsWith('<h')) out.push(`<p>${line}</p>`);
          else out.push(line);
        }
      }
    }
    if (inUl) out.push('</ul>');
    if (inOl) out.push('</ol>');

    return sanitizeHtml(out.join('\n'), SANITIZE_ALLOWLIST);
  }

  private async invalidateInsightCaches(raceId: string): Promise<void> {
    await this.safeRedisDel(`${RaceRecapService.RECAP_PREFIX}${raceId}`);
    await this.safeRedisDel(`${RaceRecapService.INSIGHT_PREFIX}${raceId}`);
  }

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

/** Minimal HTML escape for auto-gen spotlight HTML — sanitize-html backstop after. */
function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── F-056 Phase 4 helpers ──────────────────────────────────────────────

/**
 * Re-render markdown body to sanitized HTML when serving from S3.
 * Uses sanitize-html allowlist matching RecapArticleGenerator output.
 * Lightweight regex-based markdown (mirrors generator's markdownToHtml).
 */
function rerenderMarkdownToSanitizedHtml(md: string): string {
  // Mirror generator's lightweight markdown → HTML; sanitize on result.
  const lines = md.split('\n');
  const out: string[] = [];
  let inUl = false;
  let inOl = false;
  let inTable = false;

  const escape = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const inline = (s: string): string => {
    let r = escape(s);
    r = r.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    r = r.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    r = r.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    return r;
  };

  const closeLists = () => {
    if (inUl) {
      out.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      out.push('</ol>');
      inOl = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length === 0) {
      closeLists();
      if (inTable) {
        out.push('</tbody></table>');
        inTable = false;
      }
      continue;
    }
    if (line.startsWith('### ')) {
      closeLists();
      out.push(`<h3>${inline(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith('## ')) {
      closeLists();
      out.push(`<h2>${inline(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith('# ')) {
      closeLists();
      continue;
    }
    if (line.startsWith('|') && line.endsWith('|')) {
      const next = (lines[i + 1] ?? '').trim();
      if (next.startsWith('|') && /[-:]+/.test(next)) {
        closeLists();
        const headers = line
          .slice(1, -1)
          .split('|')
          .map((h) => h.trim());
        out.push(
          '<table><thead><tr>' +
            headers.map((h) => `<th>${inline(h)}</th>`).join('') +
            '</tr></thead><tbody>',
        );
        inTable = true;
        i++;
        continue;
      }
      if (inTable) {
        const cells = line
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());
        out.push(
          '<tr>' +
            cells.map((c) => `<td>${inline(c)}</td>`).join('') +
            '</tr>',
        );
        continue;
      }
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      if (inOl) {
        out.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        out.push('<ul>');
        inUl = true;
      }
      out.push(`<li>${inline(line.slice(2))}</li>`);
      continue;
    }
    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (ol) {
      if (inUl) {
        out.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        out.push('<ol>');
        inOl = true;
      }
      out.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }
    closeLists();
    out.push(`<p>${inline(line)}</p>`);
  }
  closeLists();
  if (inTable) out.push('</tbody></table>');

  const html = out.join('\n');
  return sanitizeHtml(html, {
    allowedTags: ['p', 'h2', 'h3', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'br', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
    allowedAttributes: { a: ['href', 'rel', 'target'] },
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', {
        rel: 'nofollow noopener',
        target: '_blank',
      }),
    },
  });
}

function toArticleMetaDto(a: GeneratedRecapArticle): RecapArticleMetaDto {
  return {
    slug: a.slug,
    title: a.title,
    summary: a.summary,
    category: a.category,
    readMinutes: a.readMinutes,
    source: a.source,
    html: a.html,
    publishedAt: a.publishedAt,
  };
}
