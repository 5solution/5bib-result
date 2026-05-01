import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RaceAthleteSyncService } from '../services/race-athlete-sync.service';
import { RaceMasterCacheService } from '../services/race-master-cache.service';

/**
 * Delta sync cron — every 5 minutes. Pull rows modified in last
 * checkpoint window cho mỗi active race.
 *
 * "Active" = race nào có data trong race_athletes + ít nhất 1 athlete
 * `legacy_modified_on` trong 30 ngày gần nhất (xem
 * RaceAthleteSyncService.listActiveRaces).
 *
 * Trade-off: race draft hoặc race xa trong tương lai chưa có data → cron
 * skip. Khi BTC enable chip-verify (hoặc admin click Refresh), full sync
 * sẽ seed → cron tự động pickup từ tick sau.
 */
@Injectable()
export class RaceMasterDeltaSyncCron {
  private readonly logger = new Logger(RaceMasterDeltaSyncCron.name);
  private running = false;

  constructor(
    private readonly syncService: RaceAthleteSyncService,
    private readonly cache: RaceMasterCacheService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'race-master-delta-sync' })
  async tick(): Promise<void> {
    if (this.running) {
      this.logger.warn('[delta-cron] previous tick still running — skip');
      return;
    }
    this.running = true;
    const t0 = Date.now();
    try {
      const raceIds = await this.syncService.listActiveRaces();
      if (raceIds.length === 0) return;

      const results = await Promise.all(
        raceIds.map(async (raceId) => {
          const acquired = await this.cache.tryAcquireCronLock(raceId);
          if (!acquired) {
            return { raceId, skipped: true, rows: 0 };
          }
          try {
            const log = await this.syncService.deltaSyncRace(raceId, 'cron');
            return {
              raceId,
              skipped: false,
              rows: log.rows_fetched,
            };
          } catch (err) {
            this.logger.error(
              `[delta-cron] race=${raceId} error: ${(err as Error).message}`,
            );
            return { raceId, skipped: false, rows: 0 };
          } finally {
            await this.cache.releaseCronLock(raceId);
          }
        }),
      );

      const total = results.reduce((s, r) => s + r.rows, 0);
      const skipped = results.filter((r) => r.skipped).length;
      const ms = Date.now() - t0;
      if (total > 0 || ms > 10_000) {
        this.logger.log(
          `[delta-cron] races=${raceIds.length} skipped=${skipped} totalRows=${total} ms=${ms}`,
        );
      }
    } finally {
      this.running = false;
    }
  }
}
