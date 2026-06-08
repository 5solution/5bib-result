/**
 * F-076 BR-31 — daily counters cho EOD Recap.
 *
 * Redis hash key `invoice-reconcile:daily-counters:<YYYY-MM-DD>` TTL 48h.
 * Fields:
 *   - scan-ticks: number of scan cron ticks today
 *   - misa-ok / misa-degraded / misa-fail: Layer 2 call status counts
 *   - alert-warn / alert-critical / alert-breached / alert-duplicate /
 *     alert-misa-down / alert-misa-auth: alert sent per loại
 *
 * All operations best-effort — Redis fail không block business flow.
 */
import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

const COUNTERS_TTL_SECONDS = 48 * 3600;

export type CounterField =
  | 'scan-ticks'
  | 'misa-ok'
  | 'misa-degraded'
  | 'misa-fail'
  | 'alert-warn'
  | 'alert-critical'
  | 'alert-breached'
  | 'alert-duplicate'
  | 'alert-misa-down'
  | 'alert-misa-auth';

@Injectable()
export class DailyCountersService {
  private readonly logger = new Logger(DailyCountersService.name);

  constructor(@Optional() @InjectRedis() private readonly redis?: Redis) {}

  private key(date: string): string {
    return `invoice-reconcile:daily-counters:${date}`;
  }

  async increment(date: string, field: CounterField, by = 1): Promise<void> {
    if (!this.redis) return;
    try {
      const k = this.key(date);
      await this.redis.hincrby(k, field, by);
      await this.redis.expire(k, COUNTERS_TTL_SECONDS);
    } catch (e) {
      this.logger.warn(
        `[counters] increment ${field} fail: ${(e as Error).message}`,
      );
    }
  }

  async getAll(date: string): Promise<Record<string, number>> {
    if (!this.redis) return {};
    try {
      const raw = await this.redis.hgetall(this.key(date));
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(raw)) {
        const n = Number(v);
        out[k] = Number.isFinite(n) ? n : 0;
      }
      return out;
    } catch (e) {
      this.logger.warn(
        `[counters] getAll fail: ${(e as Error).message}`,
      );
      return {};
    }
  }
}
