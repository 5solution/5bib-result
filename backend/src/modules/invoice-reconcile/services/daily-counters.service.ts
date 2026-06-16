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

/**
 * F-086 BR-86-05 — cumulative "tổng hóa đơn đã xuất từ 08/06" persist key.
 * NO TTL (sống mãi). SET (không INCR) từ MISA authoritative count → idempotent,
 * không double-count. Redis flush mất → refresh lại từ MISA ở heartbeat kế.
 */
const CUMULATIVE_ISSUED_KEY = 'invoice-reconcile:cumulative:issued';

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

  /**
   * F-086 BR-86-05 — persist cumulative issued count (SET no-TTL, best-effort).
   * SET (không INCR) vì nguồn là MISA authoritative count — gọi lại ghi đè cùng số.
   */
  async setCumulativeIssued(n: number): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.set(CUMULATIVE_ISSUED_KEY, String(Math.max(0, Math.trunc(n))));
    } catch (e) {
      this.logger.warn(
        `[counters] setCumulativeIssued fail: ${(e as Error).message}`,
      );
    }
  }

  /** F-086 BR-86-05 — đọc cumulative issued. 0 nếu chưa có / Redis fail. */
  async getCumulativeIssued(): Promise<number> {
    if (!this.redis) return 0;
    try {
      const raw = await this.redis.get(CUMULATIVE_ISSUED_KEY);
      const n = Number(raw);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    } catch (e) {
      this.logger.warn(
        `[counters] getCumulativeIssued fail: ${(e as Error).message}`,
      );
      return 0;
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
