import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RaceResultService } from './race-result.service';

/**
 * Cron interval used by `handleCron`. Exposed for cron-aware UI features
 * (F-068 BR-68-06 — `getNextScheduledRunAt` compute) and tests.
 */
export const RACE_SYNC_CRON_INTERVAL_MINUTES = 10;

@Injectable()
export class RaceSyncCron {
  private readonly logger = new Logger(RaceSyncCron.name);
  private isSyncing = false;

  constructor(private readonly raceResultService: RaceResultService) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleCron() {
    if (this.isSyncing) {
      this.logger.warn('Previous sync still in progress, skipping...');
      return;
    }

    try {
      this.isSyncing = true;
      this.logger.log('Starting scheduled race results sync');
      await this.raceResultService.syncAllRaceResults();
    } catch (error) {
      this.logger.error(`Cron job error: ${error.message}`, error.stack);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * F-068 BR-68-06: public getter để CourseDataStatsService check cron state
   * khi compute `nextCronAt` + `cronStatus`. KHÔNG đổi `isSyncing` thành public
   * field — giữ encapsulation, chỉ expose method.
   */
  isCurrentlySync(): boolean {
    return this.isSyncing;
  }

  /**
   * F-068 BR-68-06: compute Date của lần cron run tiếp theo theo
   * `EVERY_10_MINUTES` = `*\/10 * * * *` UTC. Return `null` khi cron đang
   * chạy (caller dùng cronStatus='in_progress').
   *
   * Logic: round UP `now.getMinutes()` lên mốc 10 phút tiếp theo, KHÔNG round
   * cùng phút (vì cron đã chạy / sắp chạy). Ví dụ now=12:34:00 → next=12:40,
   * now=12:30:00 → next=12:40 (NOT 12:30).
   *
   * Edge case: now=12:59:30 → next=13:00 (đầu giờ tiếp).
   *
   * @param now Optional override for testability (default `new Date()`).
   */
  getNextScheduledRunAt(now: Date = new Date()): Date | null {
    if (this.isSyncing) return null;

    const interval = RACE_SYNC_CRON_INTERVAL_MINUTES;
    const next = new Date(now.getTime());
    // Always step to the NEXT mark (even if `now` exactly on a mark) to avoid
    // returning a Date in the past once the cron tick has already started.
    next.setUTCSeconds(0, 0);
    const minutes = next.getUTCMinutes();
    const nextMark = Math.floor(minutes / interval) * interval + interval;
    if (nextMark >= 60) {
      next.setUTCHours(next.getUTCHours() + 1, nextMark - 60, 0, 0);
    } else {
      next.setUTCMinutes(nextMark, 0, 0);
    }
    return next;
  }
}
