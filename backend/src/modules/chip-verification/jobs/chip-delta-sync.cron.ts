import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ChipConfigService } from '../services/chip-config.service';
import { ChipCacheService } from '../services/chip-cache.service';

/**
 * Delta sync every 30 seconds. Replaces the dropped bib_number hook.
 *
 * MUST-DO #5 (Eng+QC): use Promise.all + per-race lock so multi-race
 * concurrency doesn't fan out into sequential awaits that overrun the tick.
 */
@Injectable()
export class ChipDeltaSyncCron {
  private readonly logger = new Logger(ChipDeltaSyncCron.name);
  /** Prevent the same Node instance from re-entering the tick handler. */
  private running = false;

  constructor(
    private readonly configService: ChipConfigService,
    private readonly cacheService: ChipCacheService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS, { name: 'chip-delta-sync' })
  async syncDelta(): Promise<void> {
    if (this.running) {
      this.logger.warn('[delta-sync] previous tick still running — skip');
      return;
    }
    this.running = true;
    const t0 = Date.now();
    try {
      const races = await this.configService.listEnabled();
      if (races.length === 0) return;

      // Promise.all for parallelism, but each race wrapped in cron-lock
      // so multiple Node instances (HA) don't double-query.
      const results = await Promise.all(
        races.map(async (r) => {
          const acquired = await this.cacheService.tryLockCron(
            r.mysql_race_id,
          );
          if (!acquired) {
            return { raceId: r.mysql_race_id, patched: 0, skipped: true };
          }
          try {
            const { patched } = await this.cacheService.patchDelta(
              r.mysql_race_id,
            );
            return { raceId: r.mysql_race_id, patched, skipped: false };
          } catch (err) {
            this.logger.error(
              `[delta-sync] race=${r.mysql_race_id} error: ${(err as Error).message}`,
            );
            return { raceId: r.mysql_race_id, patched: 0, skipped: false };
          } finally {
            await this.cacheService.releaseCronLock(r.mysql_race_id);
          }
        }),
      );

      const totalPatched = results.reduce((sum, r) => sum + r.patched, 0);
      const ms = Date.now() - t0;
      if (totalPatched > 0 || ms > 5000) {
        this.logger.log(
          `[delta-sync] races=${races.length} patched=${totalPatched} ms=${ms}`,
        );
      }
    } finally {
      this.running = false;
    }
  }
}
