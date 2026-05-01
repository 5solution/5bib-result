import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  Optional,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RaceAthleteSyncService } from '../services/race-athlete-sync.service';
import { RaceMasterCacheService } from '../services/race-master-cache.service';
import {
  ChipRaceConfig,
  ChipRaceConfigDocument,
} from '../../chip-verification/schemas/chip-race-config.schema';

/**
 * Delta sync cron — every 30 seconds (W-1 fix: was 5min, restored to 30s
 * to match v1.2 behavior). Pull rows modified in last checkpoint window
 * cho mỗi active race.
 *
 * "Active" = race nào có data trong race_athletes + ít nhất 1 athlete
 * `synced_at` trong 7 ngày gần nhất (xem
 * RaceAthleteSyncService.listActiveRaces).
 *
 * Trade-off race-day:
 *   - Cron 30s + DELTA overlap 60s = athlete BIB add tại H-1 sẽ visible
 *     trong cache trong vòng 30-60s (thay vì 5 phút như v1.3 ban đầu).
 *   - Race kit BTC giao đúng giờ → VĐV check-in liên tục → cron không
 *     được trễ.
 *
 * Janitor (W-2): mỗi tick cũng sweep RUNNING sync logs > 10min để chống
 * orphan từ process kill -9 / OOM crash.
 *
 * B-1 fix: OnApplicationBootstrap → auto-trigger FULL sync cho races có
 * `chip_verify_enabled=true`. Tránh race-day brownout sau prod migration
 * khi Mongo race_athletes empty + 4 kiosks polling đồng thời hammer MySQL.
 */
@Injectable()
export class RaceMasterDeltaSyncCron implements OnApplicationBootstrap {
  private readonly logger = new Logger(RaceMasterDeltaSyncCron.name);
  private running = false;
  private bootstrapDone = false;

  constructor(
    private readonly syncService: RaceAthleteSyncService,
    private readonly cache: RaceMasterCacheService,
    @Optional()
    @InjectModel(ChipRaceConfig.name)
    private readonly chipConfigModel: Model<ChipRaceConfigDocument> | null,
  ) {}

  /**
   * B-1 fix — auto-warmup on bootstrap. Lazy: chỉ warm những race có
   * `chip_verify_enabled=true` trong ChipRaceConfig (đã enable feature).
   * Race chưa enable → skip (BTC chưa cần kiosk).
   *
   * Run async sau bootstrap → KHÔNG block app startup. Errors logged but
   * không throw (1 race fail không nên crash app).
   */
  async onApplicationBootstrap(): Promise<void> {
    if (this.bootstrapDone) return;
    this.bootstrapDone = true;

    if (!this.chipConfigModel) {
      this.logger.log(
        '[bootstrap] ChipRaceConfig model unavailable — skip auto-warmup',
      );
      return;
    }

    // Defer 5s sau bootstrap để app fully up + Redis/Mongo connected.
    setTimeout(() => {
      this.warmupEnabledRaces().catch((err: Error) =>
        this.logger.error(`[bootstrap] auto-warmup error: ${err.message}`),
      );
    }, 5000);
  }

  private async warmupEnabledRaces(): Promise<void> {
    if (!this.chipConfigModel) return;
    const enabledConfigs = await this.chipConfigModel
      .find({ chip_verify_enabled: true })
      .select({ mysql_race_id: 1 })
      .lean<{ mysql_race_id: number }[]>()
      .exec();

    if (enabledConfigs.length === 0) {
      this.logger.log('[bootstrap] no chip-verify-enabled races — skip warmup');
      return;
    }

    this.logger.log(
      `[bootstrap] auto-warmup ${enabledConfigs.length} chip-verify-enabled races: [${enabledConfigs.map((c) => c.mysql_race_id).join(',')}]`,
    );

    for (const cfg of enabledConfigs) {
      const acquired = await this.cache.tryAcquireSyncLock(cfg.mysql_race_id);
      if (!acquired) {
        this.logger.log(
          `[bootstrap] race=${cfg.mysql_race_id} sync-lock held — skip`,
        );
        continue;
      }
      try {
        // DELTA mode — nhẹ hơn FULL nếu race đã có data. Nếu race trống
        // checkpoint=null → fallback last 24h (xem deltaSyncRace logic).
        await this.syncService.deltaSyncRace(
          cfg.mysql_race_id,
          'bootstrap:auto-warmup',
        );
      } catch (err) {
        this.logger.error(
          `[bootstrap] race=${cfg.mysql_race_id} warmup failed: ${(err as Error).message}`,
        );
      } finally {
        await this.cache.releaseSyncLock(cfg.mysql_race_id);
      }
    }
  }

  @Cron(CronExpression.EVERY_30_SECONDS, { name: 'race-master-delta-sync' })
  async tick(): Promise<void> {
    if (this.running) {
      // 30s tick + previous still running = sync chậm hơn 30s. Log để
      // alert ops nếu pattern lặp.
      this.logger.warn('[delta-cron] previous tick still running — skip');
      return;
    }
    this.running = true;
    const t0 = Date.now();
    try {
      // W-2: janitor sweep stale RUNNING logs (cheap updateMany).
      await this.syncService
        .sweepStaleRunningLogs()
        .catch((err: Error) =>
          this.logger.error(`[janitor] error: ${err.message}`),
        );

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
      // Quieter log: chỉ log khi có rows hoặc tick chậm > 5s (30s interval
      // → cron chạy 120/h, log mỗi tick spam quá).
      if (total > 0 || ms > 5_000) {
        this.logger.log(
          `[delta-cron] races=${raceIds.length} skipped=${skipped} totalRows=${total} ms=${ms}`,
        );
      }
    } finally {
      this.running = false;
    }
  }
}
