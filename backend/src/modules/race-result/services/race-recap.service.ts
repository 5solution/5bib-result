/**
 * FEATURE-046 — Race Recap Service (programmatic SEO race recap pages).
 *
 * Aggregation engine cho `/giai-chay/[slug]/recap`. Cache Redis 1h TTL.
 * SETNX anti-stampede lock port pattern F-027. PII strip enforced at DTO.
 *
 * Per Manager Plan Adjustment #2 (backend pre-render markdown → insightHtml),
 * #4 (atomic findOneAndUpdate version lock), #5 (publishedAt stays original on re-edit).
 *
 * BR coverage: BR-46-01..02/05..14/19..21/25..26/31..33.
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
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
} from '../dto/race-recap-response.dto';
import {
  RecapInsightPublicDto,
  RecapInsightAdminDto,
  UpsertRecapInsightDto,
} from '../dto/recap-insight.dto';

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

interface CourseInfo {
  courseId: string;
  name: string;
  distance?: string;
}

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
  categoryRank?: string;
  chiptimes?: string;
  paces?: string;
  started?: number;
  finished?: number;
  dnf?: number;
  avatarUrl?: string; // F-046 Phase 1.5 — public-shareable
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

  // ─── Core aggregation ──────────────────────────────────────────────────

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
    }>;
    for (const c of racesCourses) {
      if (c.courseId) {
        courseMap.set(c.courseId, {
          courseId: c.courseId,
          name: c.name ?? c.courseId,
          distance: c.distance,
        });
      }
    }
    for (const r of allResults) {
      if (r.courseId && !courseMap.has(r.courseId)) {
        courseMap.set(r.courseId, { courseId: r.courseId, name: r.courseId });
      }
    }

    const courses = Array.from(courseMap.values());
    const hero = this.computeHero(allResults, race.title);

    const podiums: RecapPodiumPerCourseDto[] = [];
    const paceStats: RecapPaceStatsDto[] = [];
    const negativeSplits: RecapNegativeSplitDto[] = [];
    const agBreakdowns: RecapAGBreakdownPerCourseDto[] = [];

    for (const course of courses) {
      const courseResults = allResults.filter(
        (r) => r.courseId === course.courseId,
      );
      const finishers = courseResults.filter(
        (r) =>
          this.isFinisherChipTime(r.chipTime) &&
          this.parseChipTimeSeconds(r.chipTime!) > 0,
      );

      podiums.push(this.computePodium(course, finishers));
      paceStats.push(this.computePaceStats(course, finishers));
      negativeSplits.push(this.computeNegativeSplit(course, finishers));
      agBreakdowns.push(this.computeAGBreakdown(course, finishers));
    }

    return {
      raceId,
      raceTitle: race.title,
      raceSlug: race.slug ?? raceId,
      endDate: race.endDate ? race.endDate.toString() : undefined,
      hero,
      podiums,
      paceStats,
      negativeSplits,
      agBreakdowns,
      computedAt: new Date().toISOString(),
    };
  }

  private computeHero(
    results: CourseResultRow[],
    raceTitle: string,
  ): RecapHeroStatsDto {
    let totalFinishers = 0;
    let dnsCount = 0;
    let dnfCount = 0;
    let dsqCount = 0;

    for (const r of results) {
      const status = this.deriveStatus(r);
      if (status === 'finished') totalFinishers++;
      else if (status === 'dns') dnsCount++;
      else if (status === 'dnf') dnfCount++;
      else if (status === 'dsq') dsqCount++;
    }

    const headline = `${totalFinishers.toLocaleString('vi-VN')} VĐV về đích tại ${raceTitle}`;
    return { totalFinishers, dnsCount, dnfCount, dsqCount, headline };
  }

  private computePodium(
    course: CourseInfo,
    finishers: CourseResultRow[],
  ): RecapPodiumPerCourseDto {
    const sorted = [...finishers].sort(
      (a, b) =>
        this.parseChipTimeSeconds(a.chipTime ?? '') -
        this.parseChipTimeSeconds(b.chipTime ?? ''),
    );

    const male = sorted
      .filter((r) => this.normalizeGender(r.gender) === 'male')
      .slice(0, 3)
      .map((r, i) => this.toPodiumCell(r, i));
    const female = sorted
      .filter((r) => this.normalizeGender(r.gender) === 'female')
      .slice(0, 3)
      .map((r, i) => this.toPodiumCell(r, i));

    return {
      courseId: course.courseId,
      courseName: course.name,
      distance: course.distance,
      male,
      female,
    };
  }

  private computePaceStats(
    course: CourseInfo,
    finishers: CourseResultRow[],
  ): RecapPaceStatsDto {
    const paceSeconds: number[] = finishers
      .map((r) => this.parsePaceSeconds(r.pace))
      .filter((s) => s > 0);

    if (paceSeconds.length === 0) {
      return {
        courseId: course.courseId,
        courseName: course.name,
        medianPace: '—',
        p10Pace: '—',
        p90Pace: '—',
        distribution: new Array(10).fill(0),
        finisherCount: 0,
      };
    }

    paceSeconds.sort((a, b) => a - b);
    const median = paceSeconds[Math.floor(paceSeconds.length / 2)];
    const p10 = paceSeconds[Math.floor(paceSeconds.length * 0.1)];
    const p90 = paceSeconds[Math.floor(paceSeconds.length * 0.9)];

    const min = paceSeconds[0];
    const max = paceSeconds[paceSeconds.length - 1];
    const bucketWidth = (max - min) / 10 || 1;
    const distribution = new Array(10).fill(0);
    for (const s of paceSeconds) {
      const idx = Math.min(9, Math.floor((s - min) / bucketWidth));
      distribution[idx]++;
    }

    return {
      courseId: course.courseId,
      courseName: course.name,
      medianPace: this.formatPace(median),
      p10Pace: this.formatPace(p10),
      p90Pace: this.formatPace(p90),
      distribution,
      finisherCount: paceSeconds.length,
    };
  }

  private computeNegativeSplit(
    course: CourseInfo,
    finishers: CourseResultRow[],
  ): RecapNegativeSplitDto {
    let negativeCount = 0;
    let validCount = 0;

    for (const r of finishers) {
      const verdict = this.checkNegativeSplit(r);
      if (verdict === null) continue;
      validCount++;
      if (verdict) negativeCount++;
    }

    const percent =
      validCount > 0 ? Math.round((negativeCount / validCount) * 1000) / 10 : 0;

    let interpretation: string;
    if (validCount === 0) {
      interpretation = 'Không đủ dữ liệu split để tính.';
    } else if (percent < 20) {
      interpretation = `Chỉ ${percent}% VĐV chạy nửa sau nhanh hơn nửa đầu — đây là một race đầy thử thách về sức bền.`;
    } else if (percent < 35) {
      interpretation = `${percent}% VĐV negative split — kết quả tương đối phân hoá theo kinh nghiệm phân bổ sức.`;
    } else {
      interpretation = `${percent}% VĐV negative split — race có pacing strategy tốt, nhiều VĐV finish mạnh.`;
    }

    return {
      courseId: course.courseId,
      courseName: course.name,
      negativeSplitPercent: percent,
      interpretation,
    };
  }

  private computeAGBreakdown(
    course: CourseInfo,
    finishers: CourseResultRow[],
  ): RecapAGBreakdownPerCourseDto {
    const groups = new Map<string, CourseResultRow[]>();
    for (const r of finishers) {
      const ag = (r.category ?? '').trim();
      if (!ag) continue;
      if (!groups.has(ag)) groups.set(ag, []);
      groups.get(ag)!.push(r);
    }

    const buckets: RecapAGBucketDto[] = [];
    const sortedAGs = Array.from(groups.keys()).sort();
    for (const ag of sortedAGs) {
      const rows = groups.get(ag)!;
      const sorted = [...rows].sort(
        (a, b) =>
          this.parseChipTimeSeconds(a.chipTime ?? '') -
          this.parseChipTimeSeconds(b.chipTime ?? ''),
      );
      const top5 = sorted.slice(0, 5).map((r, i) => this.toPodiumCell(r, i));
      buckets.push({
        category: ag,
        finisherCount: rows.length,
        top5,
      });
    }

    return {
      courseId: course.courseId,
      courseName: course.name,
      buckets,
    };
  }

  // ─── Helper functions ──────────────────────────────────────────────────

  parseChipTimeSeconds(chipTime: string): number {
    if (!chipTime) return 0;
    const trimmed = chipTime.trim();
    if (!trimmed || trimmed === '0:00:00' || trimmed === '00:00:00') return 0;
    const parts = trimmed.split(':').map((p) => parseInt(p, 10));
    if (parts.some((n) => isNaN(n))) return 0;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  }

  private parsePaceSeconds(pace: string | undefined): number {
    if (!pace) return 0;
    const cleaned = pace.replace(/\/km$/i, '').trim();
    if (!cleaned) return 0;
    const parts = cleaned.split(':').map((p) => parseInt(p, 10));
    if (parts.some((n) => isNaN(n))) return 0;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  }

  private formatPace(seconds: number): string {
    if (seconds <= 0) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}/km`;
  }

  private isFinisherChipTime(chipTime: string | undefined): boolean {
    if (!chipTime) return false;
    const trimmed = chipTime.trim();
    return Boolean(trimmed) && trimmed !== '0:00:00' && trimmed !== '00:00:00';
  }

  private deriveStatus(r: CourseResultRow): 'finished' | 'dns' | 'dnf' | 'dsq' {
    if (
      this.isFinisherChipTime(r.chipTime) &&
      this.parseChipTimeSeconds(r.chipTime!) > 0
    ) {
      return 'finished';
    }
    if (r.started && r.started > 0) return 'dnf';
    return 'dns';
  }

  private normalizeGender(
    gender: string | undefined,
  ): 'male' | 'female' | null {
    if (!gender) return null;
    const g = gender.toLowerCase().trim();
    if (g === 'm' || g === 'male' || g === 'nam') return 'male';
    if (g === 'f' || g === 'female' || g === 'nu' || g === 'nữ')
      return 'female';
    return null;
  }

  private checkNegativeSplit(r: CourseResultRow): boolean | null {
    if (!r.chiptimes) return null;
    let parsed: Record<string, string>;
    try {
      parsed = JSON.parse(r.chiptimes) as Record<string, string>;
    } catch {
      return null;
    }
    const checkpoints = Object.entries(parsed)
      .filter(([k]) => k !== 'Start')
      .map(([k, v]) => ({ name: k, seconds: this.parseChipTimeSeconds(v) }))
      .filter((c) => c.seconds > 0);

    if (checkpoints.length < 2) return null;

    const finishSeconds = this.parseChipTimeSeconds(r.chipTime ?? '');
    if (finishSeconds <= 0) return null;

    const halfTime = finishSeconds / 2;
    let midpoint = checkpoints[0];
    let minDiff = Math.abs(midpoint.seconds - halfTime);
    for (const c of checkpoints) {
      const diff = Math.abs(c.seconds - halfTime);
      if (diff < minDiff) {
        midpoint = c;
        minDiff = diff;
      }
    }

    const firstHalf = midpoint.seconds;
    const secondHalf = finishSeconds - midpoint.seconds;
    return secondHalf < firstHalf;
  }

  private toPodiumCell(r: CourseResultRow, index: number): RecapPodiumCellDto {
    return {
      name: r.name ?? '',
      bib: r.bib,
      chipTime: r.chipTime ?? '',
      category: r.category,
      medal: index === 0 ? 'gold' : index === 1 ? 'silver' : 'bronze',
      avatarUrl: r.avatarUrl,
    };
  }

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
