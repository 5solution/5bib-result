import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TimingAlertConfigService } from '../services/timing-alert-config.service';
import { TimingAlertPollService } from '../services/timing-alert-poll.service';

/**
 * Phase 1B — race day cron, tick mỗi 30 giây.
 *
 * Trade-off interval:
 * - Spec section 3 + section 7.1 default `poll_interval_seconds = 90`
 * - Cron 30s tick → check enabled configs mỗi 30s, NHƯNG poll service có
 *   internal lock per (race, course) TTL = poll_interval_seconds → effective
 *   poll rate = max(30s, config.poll_interval_seconds)
 *
 * Vậy nếu config 90s, lock TTL 90s → mỗi 90s mới actually poll race đó.
 * Cron 30s thread chỉ check & dispatch — KHÔNG hammer RR API.
 *
 * **Active config filter:** chỉ poll những config có `enabled: true`.
 * Phase 1C có thể thêm time window filter (event_start_date - 1h →
 * event_end_date + 2h).
 *
 * **Fan-out:** Promise.all parallel cho mỗi race. Race có nhiều course
 * sẽ poll sequential trong `pollRace`. Acceptable vì N races thường < 5.
 */
@Injectable()
export class TimingAlertPollCron {
  private readonly logger = new Logger(TimingAlertPollCron.name);
  private running = false;

  constructor(
    private readonly configService: TimingAlertConfigService,
    private readonly pollService: TimingAlertPollService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS, { name: 'timing-alert-poll' })
  async tick(): Promise<void> {
    if (this.running) {
      this.logger.warn('[poll-cron] previous tick still running — skip');
      return;
    }
    this.running = true;
    const t0 = Date.now();
    try {
      const enabledConfigs = await this.configService.listActiveConfigs();
      if (enabledConfigs.length === 0) return;

      const results = await Promise.allSettled(
        enabledConfigs.map((cfg) =>
          this.pollService.pollRace(cfg.race_id, 'cron'),
        ),
      );

      const fulfilled = results.filter((r) => r.status === 'fulfilled').length;
      const rejected = results.filter((r) => r.status === 'rejected').length;
      const ms = Date.now() - t0;

      // Quiet log — only when activity hoặc tick quá chậm
      if (fulfilled > 0 || rejected > 0 || ms > 10_000) {
        this.logger.log(
          `[poll-cron] races=${enabledConfigs.length} ok=${fulfilled} err=${rejected} ms=${ms}`,
        );
      }
    } finally {
      this.running = false;
    }
  }
}
