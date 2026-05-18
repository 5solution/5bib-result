import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SeoSlugSyncService } from '../services/seo-slug-sync.service';

/**
 * FEATURE-036 — Weekly cron: discover races missing slug, generate, revalidate.
 *
 * Schedule: Sunday 02:00 GMT+7 (BR-04).
 * Anti-stampede SETNX lock handled inside service.syncSlugs().
 */
@Injectable()
export class SeoSlugSyncCron {
  private readonly logger = new Logger(SeoSlugSyncCron.name);

  constructor(private readonly service: SeoSlugSyncService) {}

  // Sunday 02:00 server time. Server tz is GMT+7 (per env).
  @Cron('0 2 * * 0', { name: 'seo-slug-sync' })
  async handleCron(): Promise<void> {
    try {
      const result = await this.service.syncSlugs('cron');
      if (result.lockSkipped) {
        this.logger.warn('[cron] seo-slug-sync skipped: lock active');
        return;
      }
      this.logger.log(
        `[cron] seo-slug-sync done — generated=${result.slugsGenerated} errors=${result.errors.length}`,
      );
    } catch (err) {
      this.logger.error(
        `[cron] seo-slug-sync failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }
}
