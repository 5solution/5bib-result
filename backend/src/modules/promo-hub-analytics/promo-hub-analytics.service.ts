import {
  BadRequestException,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import * as crypto from 'crypto';
import { Model, Types } from 'mongoose';
import {
  PromoHubClick,
  PromoHubClickDocument,
} from './schemas/promo-hub-click.schema';
import {
  PromoHubView,
  PromoHubViewDocument,
} from './schemas/promo-hub-view.schema';
import { TrackClickDto } from './dto/track-click.dto';
import { TrackViewDto } from './dto/track-view.dto';
import { AnalyticsSummaryDto } from './dto/analytics-summary.dto';

/**
 * FEATURE-027 — PromoHubAnalyticsService.
 *
 * Two write paths (public):
 *   - `trackClick(dto, ip, userAgent, referer)` — no rate limit (BR-PH-10)
 *   - `trackView(dto, ip, userAgent, referer)` — rate-limited 1 view/5min per
 *     IP+slug via `ratelimit:promo-view:<slug>:<ip-hash>` Redis key TTL 300s.
 *
 * Privacy: SHA-256 hashed IP stored, never raw IP (BR-PH-08).
 *
 * Read path (admin):
 *   - `getSummary(hubId)` — aggregate views/clicks last 30 days into
 *     `AnalyticsSummaryDto` (totals + by-day series + top sections/labels/referers).
 */
@Injectable()
export class PromoHubAnalyticsService {
  private readonly logger = new Logger(PromoHubAnalyticsService.name);

  private static readonly VIEW_RATELIMIT_PREFIX = 'ratelimit:promo-view:';
  private static readonly VIEW_RATELIMIT_TTL_SECONDS = 300; // 5 phút
  private static readonly SUMMARY_WINDOW_DAYS = 30;
  private static readonly TOP_LIMIT = 10;

  constructor(
    @InjectModel(PromoHubClick.name)
    private readonly clickModel: Model<PromoHubClickDocument>,
    @InjectModel(PromoHubView.name)
    private readonly viewModel: Model<PromoHubViewDocument>,
    @Optional() @InjectRedis() private readonly redis?: Redis,
  ) {}

  /**
   * Record a click event. No rate limit (BR-PH-10).
   */
  async trackClick(
    dto: TrackClickDto,
    ip: string,
    userAgent?: string,
    referer?: string,
  ): Promise<{ success: true }> {
    await this.clickModel.create({
      hubId: new Types.ObjectId(dto.hubId),
      sectionId: new Types.ObjectId(dto.sectionId),
      label: dto.label,
      url: dto.url,
      ip: this.hashIp(ip),
      userAgent: userAgent?.slice(0, 500),
      referer: (dto.referer ?? referer)?.slice(0, 2000),
      clickedAt: new Date(),
    });
    return { success: true };
  }

  /**
   * Record a view event. Rate-limited per IP+slug 1 view per 5 minutes
   * (BR-PH-09). Returns `recorded: false` when rate-limited (silent skip,
   * no error — frontend doesn't need to handle).
   */
  async trackView(
    dto: TrackViewDto,
    ip: string,
    userAgent?: string,
    referer?: string,
  ): Promise<{ recorded: boolean }> {
    const ipHash = this.hashIp(ip);

    // Rate limit check (only if Redis available + slug provided).
    if (this.redis && dto.slug) {
      const rlKey = `${PromoHubAnalyticsService.VIEW_RATELIMIT_PREFIX}${dto.slug}:${ipHash}`;
      try {
        const setResult = await this.redis.set(
          rlKey,
          '1',
          'EX',
          PromoHubAnalyticsService.VIEW_RATELIMIT_TTL_SECONDS,
          'NX',
        );
        if (setResult !== 'OK') {
          // Rate limit hit — skip recording but return success to client.
          return { recorded: false };
        }
      } catch (e) {
        this.logger.warn(
          `[promo-hub-analytics] rate-limit Redis fail (continuing): ${(e as Error).message}`,
        );
      }
    }

    await this.viewModel.create({
      hubId: new Types.ObjectId(dto.hubId),
      ip: ipHash,
      userAgent: userAgent?.slice(0, 500),
      referer: (dto.referer ?? referer)?.slice(0, 2000),
      viewedAt: new Date(),
    });
    return { recorded: true };
  }

  /**
   * Admin summary: totals + time series + top labels/sections/referers
   * for last 30 days.
   */
  async getSummary(hubId: string): Promise<AnalyticsSummaryDto> {
    if (!Types.ObjectId.isValid(hubId)) {
      throw new BadRequestException('hubId không hợp lệ');
    }
    const hubObjectId = new Types.ObjectId(hubId);
    const now = new Date();
    const since = new Date(now);
    since.setDate(
      since.getDate() - PromoHubAnalyticsService.SUMMARY_WINDOW_DAYS,
    );

    const [
      totalViews,
      totalClicks,
      viewsByDay,
      clicksByDay,
      topSections,
      topLabels,
      topReferers,
    ] = await Promise.all([
      this.viewModel.countDocuments({
        hubId: hubObjectId,
        viewedAt: { $gte: since },
      }),
      this.clickModel.countDocuments({
        hubId: hubObjectId,
        clickedAt: { $gte: since },
      }),
      this.aggregateByDay(this.viewModel, hubObjectId, 'viewedAt', since),
      this.aggregateByDay(this.clickModel, hubObjectId, 'clickedAt', since),
      this.aggregateTop(
        this.clickModel,
        hubObjectId,
        'clickedAt',
        'sectionId',
        since,
      ),
      this.aggregateTop(
        this.clickModel,
        hubObjectId,
        'clickedAt',
        'label',
        since,
      ),
      this.aggregateTop(
        this.viewModel,
        hubObjectId,
        'viewedAt',
        'referer',
        since,
      ),
    ]);

    const ctr = totalViews > 0 ? totalClicks / totalViews : 0;

    return {
      hubId,
      totalViews,
      totalClicks,
      ctr: Math.round(ctr * 1000) / 1000,
      viewsByDay,
      clicksByDay,
      topSections: topSections.map((t) => ({
        sectionId: String(t.key ?? ''),
        clicks: t.count,
      })),
      topLabels: topLabels.map((t) => ({
        label: String(t.key ?? ''),
        clicks: t.count,
      })),
      topReferers: topReferers.map((t) => ({
        referer: String(t.key ?? ''),
        views: t.count,
      })),
      generatedAt: now.toISOString(),
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────

  /**
   * SHA-256 hash of IP. Unsalted — we want stable hashing across requests
   * to enable unique-visitor counting (different days same IP → same hash).
   * Salting would break that property.
   */
  private hashIp(ip: string): string {
    return crypto.createHash('sha256').update(ip).digest('hex');
  }

  private async aggregateByDay(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model: Model<any>,
    hubId: Types.ObjectId,
    dateField: string,
    since: Date,
  ): Promise<{ date: string; count: number }[]> {
    const rows = await model.aggregate<{ _id: string; count: number }>([
      { $match: { hubId, [dateField]: { $gte: since } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: `$${dateField}` },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    return rows.map((r) => ({ date: r._id, count: r.count }));
  }

  private async aggregateTop(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model: Model<any>,
    hubId: Types.ObjectId,
    dateField: string,
    groupKey: string,
    since: Date,
  ): Promise<{ key: unknown; count: number }[]> {
    const rows = await model.aggregate<{ _id: unknown; count: number }>([
      {
        $match: {
          hubId,
          [dateField]: { $gte: since },
          [groupKey]: { $exists: true, $nin: [null, ''] },
        },
      },
      { $group: { _id: `$${groupKey}`, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: PromoHubAnalyticsService.TOP_LIMIT },
    ]);
    return rows.map((r) => ({ key: r._id, count: r.count }));
  }
}
