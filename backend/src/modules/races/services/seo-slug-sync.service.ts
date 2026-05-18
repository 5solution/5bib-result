import {
  Injectable,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { HttpService } from '@nestjs/axios';
import { Model } from 'mongoose';
import Redis from 'ioredis';
import { firstValueFrom } from 'rxjs';
import { Race, RaceDocument } from '../schemas/race.schema';
import {
  SeoSyncLog,
  SeoSyncLogDocument,
} from '../schemas/seo-sync-log.schema';
import { slugifyWithYear } from '../utils/slugify';
import { SeoSyncResultDto } from '../../admin-seo/dto/seo-sync-result.dto';

const LOCK_KEY = 'cron:seo-slug-sync:lock';
const LOCK_TTL_SECONDS = 600;
const REVALIDATE_MAX_RETRIES = 3;

/**
 * FEATURE-036 — SEO slug sync service.
 *
 * Shared by:
 *   - SeoSlugSyncCron (weekly Sunday 02:00 GMT+7)
 *   - AdminSeoController (manual trigger from /admin/seo UI)
 *
 * Responsibility:
 *   1. Acquire Redis SETNX lock (anti-stampede multi-pod) — BR-04
 *   2. Find races với slug = null/empty (excl. draft)
 *   3. Generate slug via slugify(title) + year suffix + uniqueness check (BR-01~03)
 *   4. updateOne per race (idempotent `$set`)
 *   5. POST frontend revalidate endpoint with retry (BR-05, BR-06)
 *   6. Insert audit log entry
 *   7. Release lock
 */
@Injectable()
export class SeoSlugSyncService {
  private readonly logger = new Logger(SeoSlugSyncService.name);

  constructor(
    @InjectModel(Race.name)
    private readonly raceModel: Model<RaceDocument>,
    @InjectModel(SeoSyncLog.name)
    private readonly logModel: Model<SeoSyncLogDocument>,
    @InjectRedis() private readonly redis: Redis,
    private readonly httpService: HttpService,
  ) {}

  async syncSlugs(
    triggeredBy: 'cron' | 'manual',
    userId?: string,
  ): Promise<SeoSyncResultDto> {
    const startedAt = new Date();
    const t0 = Date.now();

    // 1. Acquire SETNX lock — BR-04
    const lockAcquired = await this.acquireLock();
    if (!lockAcquired) {
      this.logger.warn(
        `[seo-slug-sync] Lock not acquired (concurrent run) — triggeredBy=${triggeredBy}`,
      );
      const result: SeoSyncResultDto = {
        racesScanned: 0,
        slugsGenerated: 0,
        revalidatedPaths: [],
        errors: ['Lock not acquired — concurrent sync in progress'],
        durationMs: Date.now() - t0,
        lockSkipped: true,
      };
      await this.writeLog(startedAt, triggeredBy, userId, result);
      if (triggeredBy === 'manual') {
        throw new ConflictException(
          'Một lần sync khác đang chạy. Thử lại sau vài giây.',
        );
      }
      return result;
    }

    const errors: string[] = [];
    const revalidatedPaths: string[] = [];
    let racesScanned = 0;
    let slugsGenerated = 0;

    try {
      // 2. Find races needing slug — BR-08 excludes draft
      const candidates = await this.raceModel
        .find({
          status: { $ne: 'draft' },
          $or: [
            { slug: null },
            { slug: '' },
            { slug: { $exists: false } },
          ],
        })
        .select('_id title startDate status slug')
        .lean()
        .exec();
      racesScanned = candidates.length;
      this.logger.log(
        `[seo-slug-sync] Found ${racesScanned} races needing slug`,
      );

      // 3+4. Generate + uniqueness + updateOne
      for (const race of candidates) {
        try {
          const baseSlug = slugifyWithYear(race.title, race.startDate);
          if (!baseSlug) {
            const msg = `Race ${String(race._id)} has empty/invalid title — skipped`;
            this.logger.warn(`[seo-slug-sync] ${msg}`);
            errors.push(msg);
            continue;
          }

          const finalSlug = await this.findUniqueSlug(baseSlug);
          await this.raceModel
            .updateOne({ _id: race._id }, { $set: { slug: finalSlug } })
            .exec();
          slugsGenerated++;
          revalidatedPaths.push(`/giai-chay/${finalSlug}`);
          this.logger.log(
            `[seo-slug-sync] Race ${String(race._id)}: '${race.title}' → '${finalSlug}'`,
          );
        } catch (err) {
          const msg = `Race ${String(race._id)}: ${(err as Error).message}`;
          this.logger.error(`[seo-slug-sync] ${msg}`);
          errors.push(msg);
        }
      }

      // Always revalidate listing + sitemap (slug add/remove cases)
      const allPaths = [
        ...revalidatedPaths,
        '/giai-chay',
        '/sitemap-races.xml',
      ];

      // 5. Revalidate frontend with retry — BR-05, BR-06
      if (slugsGenerated > 0) {
        try {
          await this.triggerRevalidateWithRetry(allPaths);
        } catch (err) {
          const msg = `Revalidate failed after retries: ${(err as Error).message}`;
          this.logger.error(`[seo-slug-sync] ${msg}`);
          errors.push(msg);
        }
      }
    } finally {
      // 7. Release lock
      await this.releaseLock();
    }

    const result: SeoSyncResultDto = {
      racesScanned,
      slugsGenerated,
      revalidatedPaths,
      errors,
      durationMs: Date.now() - t0,
      lockSkipped: false,
    };

    // 6. Audit log
    await this.writeLog(startedAt, triggeredBy, userId, result);

    this.logger.log(
      `[seo-slug-sync] Done — scanned=${racesScanned} generated=${slugsGenerated} errors=${errors.length} duration=${result.durationMs}ms`,
    );
    return result;
  }

  /**
   * BR-03: uniqueness check — append -2, -3 until unique.
   */
  async findUniqueSlug(base: string): Promise<string> {
    let candidate = base;
    let suffix = 2;
    // Limit attempts to prevent infinite loop
    while (suffix < 1000) {
      const exists = await this.raceModel
        .exists({ slug: candidate })
        .exec();
      if (!exists) return candidate;
      candidate = `${base}-${suffix}`;
      suffix++;
    }
    throw new Error(`Cannot find unique slug for base '${base}' after 1000 attempts`);
  }

  private async acquireLock(): Promise<boolean> {
    const result = await this.redis.set(
      LOCK_KEY,
      String(Date.now()),
      'EX',
      LOCK_TTL_SECONDS,
      'NX',
    );
    return result === 'OK';
  }

  private async releaseLock(): Promise<void> {
    try {
      await this.redis.del(LOCK_KEY);
    } catch (err) {
      this.logger.error(
        `[seo-slug-sync] Failed to release lock: ${(err as Error).message}`,
      );
    }
  }

  /**
   * BR-06: 3 retries exponential backoff (1s, 5s, 25s).
   */
  private async triggerRevalidateWithRetry(paths: string[]): Promise<void> {
    const url = process.env.FRONTEND_REVALIDATE_GIAICHAY_URL ?? '';
    const token = process.env.REVALIDATE_TOKEN ?? '';
    if (!url || !token) {
      throw new Error(
        'FRONTEND_REVALIDATE_GIAICHAY_URL or REVALIDATE_TOKEN env not set',
      );
    }

    const delays = [1000, 5000, 25000];
    let lastErr: Error | null = null;
    for (let attempt = 0; attempt < REVALIDATE_MAX_RETRIES; attempt++) {
      try {
        await firstValueFrom(
          this.httpService.post(
            url,
            { paths },
            {
              headers: { Authorization: `Bearer ${token}` },
              timeout: 10000,
            },
          ),
        );
        if (attempt > 0) {
          this.logger.log(
            `[seo-slug-sync] Revalidate succeeded on attempt ${attempt + 1}`,
          );
        }
        return;
      } catch (err) {
        lastErr = err as Error;
        if (attempt < REVALIDATE_MAX_RETRIES - 1) {
          await this.sleep(delays[attempt]);
        }
      }
    }
    throw lastErr ?? new Error('Revalidate failed (unknown reason)');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async writeLog(
    startedAt: Date,
    triggeredBy: 'cron' | 'manual',
    userId: string | undefined,
    result: SeoSyncResultDto,
  ): Promise<void> {
    try {
      const doc = new this.logModel({
        startedAt,
        finishedAt: new Date(),
        triggeredBy,
        userId,
        racesScanned: result.racesScanned,
        slugsGenerated: result.slugsGenerated,
        revalidatedPaths: result.revalidatedPaths,
        errors: result.errors,
        durationMs: result.durationMs,
        lockSkipped: result.lockSkipped,
      });
      await doc.save();
    } catch (err) {
      this.logger.error(
        `[seo-slug-sync] Failed to write log: ${(err as Error).message}`,
      );
    }
  }

  async getRecentLogs(limit = 10): Promise<SeoSyncLogDocument[]> {
    return this.logModel
      .find()
      .sort({ startedAt: -1 })
      .limit(limit)
      .lean()
      .exec();
  }
}
