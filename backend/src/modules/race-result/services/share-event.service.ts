import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import { ShareEvent, ShareEventDocument } from '../schemas/share-event.schema';

export interface LogShareInput {
  raceId: string;
  bib: string;
  template: string;
  channel: string;
  gradient?: string;
  size?: string;
  templateFallback?: boolean;
  userAgent?: string;
}

export interface TemplateCount {
  template: string;
  count: number;
}

export interface ShareStats {
  totalShares: number;
  totalUniqueBibs: number;
  byTemplate: TemplateCount[];
  byChannel: { channel: string; count: number }[];
  fallbackRate: number;
}

/**
 * Service for analytics logging + aggregations used by the admin dashboard.
 * Writes are fire-and-forget (errors swallowed) so a DB hiccup never breaks
 * the user share flow. Reads are cached by Redis at the caller (controller)
 * when called from the admin widget.
 */
@Injectable()
export class ShareEventService {
  private readonly logger = new Logger(ShareEventService.name);

  constructor(
    @InjectModel(ShareEvent.name)
    private readonly model: Model<ShareEventDocument>,
  ) {}

  async log(input: LogShareInput): Promise<void> {
    try {
      await this.model.create({
        raceId: input.raceId,
        bib: input.bib,
        template: input.template,
        channel: input.channel,
        gradient: input.gradient,
        size: input.size,
        templateFallback: input.templateFallback ?? false,
        userAgent: input.userAgent?.slice(0, 255),
      });
    } catch (err) {
      // Analytics failures must never surface to user
      this.logger.warn(
        `Share event log failed: ${(err as Error).message}`,
        { raceId: input.raceId, bib: input.bib },
      );
    }
  }

  async getStats(filter?: { raceId?: string; since?: Date }): Promise<ShareStats> {
    const match: Record<string, unknown> = {};
    if (filter?.raceId) match.raceId = filter.raceId;
    if (filter?.since) match.createdAt = { $gte: filter.since };

    const pipeline: PipelineStage[] = [
      { $match: match },
      {
        $facet: {
          total: [{ $count: 'n' }],
          uniqueBibs: [
            { $group: { _id: { raceId: '$raceId', bib: '$bib' } } },
            { $count: 'n' },
          ],
          byTemplate: [
            { $group: { _id: '$template', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $project: { _id: 0, template: '$_id', count: 1 } },
          ],
          byChannel: [
            { $group: { _id: '$channel', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $project: { _id: 0, channel: '$_id', count: 1 } },
          ],
          fallbackCount: [
            { $match: { templateFallback: true } },
            { $count: 'n' },
          ],
        },
      },
    ];

    const [res] = (await this.model.aggregate(pipeline).exec()) as [{
      total?: { n: number }[];
      uniqueBibs?: { n: number }[];
      byTemplate?: TemplateCount[];
      byChannel?: { channel: string; count: number }[];
      fallbackCount?: { n: number }[];
    }];

    const total = res?.total?.[0]?.n ?? 0;
    const uniqueBibs = res?.uniqueBibs?.[0]?.n ?? 0;
    const fallbacks = res?.fallbackCount?.[0]?.n ?? 0;

    return {
      totalShares: total,
      totalUniqueBibs: uniqueBibs,
      byTemplate: res?.byTemplate ?? [],
      byChannel: res?.byChannel ?? [],
      fallbackRate: total > 0 ? Math.round((fallbacks / total) * 10000) / 10000 : 0,
    };
  }

  /**
   * Find bibs that crossed a share threshold in the last 24h.
   * Used by the email-nurture cron (D-4): "Ảnh của bạn đã được X người chia sẻ".
   * Returns `{raceId, bib, shareCount}` grouped by athlete for the given window.
   */
  async findTrendingAthletes(options: {
    sinceHoursAgo: number;
    minShares: number;
    limit?: number;
  }): Promise<{ raceId: string; bib: string; shares: number }[]> {
    const since = new Date(Date.now() - options.sinceHoursAgo * 60 * 60 * 1000);
    const result = await this.model
      .aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: { raceId: '$raceId', bib: '$bib' },
            shares: { $sum: 1 },
          },
        },
        { $match: { shares: { $gte: options.minShares } } },
        { $sort: { shares: -1 } },
        { $limit: options.limit ?? 500 },
        {
          $project: {
            _id: 0,
            raceId: '$_id.raceId',
            bib: '$_id.bib',
            shares: 1,
          },
        },
      ])
      .exec();
    return result as { raceId: string; bib: string; shares: number }[];
  }
}
