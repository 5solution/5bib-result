import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import {
  SystemServiceStatusDto,
  SystemStatusResponseDto,
} from '../dto/dashboard-response.dto';

/**
 * F-023 BR-DASH-19/20/25 — System Status footer.
 *
 * 4 service health check: API, MyLaps, Email, Storage. Tất cả phải có
 * circuit breaker / timeout NGẮN (≤ 3s) và KHÔNG block dashboard nếu
 * external service treo.
 *
 * Cache `dashboard:system-status` TTL 60s. Polling 60s từ FE.
 *
 * `systemDown` flag = TRUE khi API hoặc MyLaps đỏ liên tục > 5 phút
 * (theo dõi bằng key `dashboard:system-down-since:<service>` lưu timestamp
 * lần đầu detect down).
 *
 * KHÔNG leak credential / bucket name / external API key trong message.
 */
const CACHE_KEY = 'dashboard:system-status';
const CACHE_TTL_SECONDS = 60;
const SYSTEM_DOWN_THRESHOLD_MS = 5 * 60 * 1000;
const HEALTH_TIMEOUT_MS = 3000;

@Injectable()
export class DashboardSystemStatusService {
  private readonly logger = new Logger(DashboardSystemStatusService.name);

  constructor(@InjectRedis() private readonly redis: Redis) {}

  async getSystemStatus(): Promise<SystemStatusResponseDto> {
    const cached = await this.readCache();
    if (cached) return cached;

    const [api, mylaps, email, storage] = await Promise.all([
      this.checkApi(),
      this.checkMyLaps(),
      this.checkEmail(),
      this.checkStorage(),
    ]);

    const services: SystemServiceStatusDto[] = [api, mylaps, email, storage];

    const systemDown = await this.computeSystemDown(api, mylaps);

    const payload: SystemStatusResponseDto = {
      services,
      systemDown,
      checkedAt: new Date().toISOString(),
    };

    await this.writeCache(payload);
    return payload;
  }

  // ── Health checks ─────────────────────────────────────────────────────

  private async checkApi(): Promise<SystemServiceStatusDto> {
    // API self-ping: nếu service này chạy được tức là OK.
    return {
      key: 'api',
      label: 'API',
      status: 'ok',
      lastOkAt: new Date().toISOString(),
    };
  }

  private async checkMyLaps(): Promise<SystemServiceStatusDto> {
    try {
      let cursor = '0';
      let found = false;
      // Scan với COUNT 100 — đủ nhanh, KHÔNG block Redis
      do {
        const [next, batch] = await this.withTimeout(
          this.redis.scan(cursor, 'MATCH', 'master:cron-lock:*', 'COUNT', 100),
          HEALTH_TIMEOUT_MS,
        );
        cursor = next;
        if (batch.length > 0) {
          found = true;
          break; // chỉ cần biết có ít nhất 1 key
        }
      } while (cursor !== '0');

      if (found) {
        return {
          key: 'mylaps',
          label: 'Sync MyLaps',
          status: 'ok',
          lastOkAt: new Date().toISOString(),
        };
      }
      return {
        key: 'mylaps',
        label: 'Sync MyLaps',
        status: 'degraded',
        message: 'Không thấy cron lock gần đây',
      };
    } catch (e) {
      this.logger.warn(`checkMyLaps fail: ${(e as Error).message}`);
      return {
        key: 'mylaps',
        label: 'Sync MyLaps',
        status: 'down',
        message: 'Health check timeout',
      };
    }
  }

  private async checkEmail(): Promise<SystemServiceStatusDto> {
    // MVP: trả ok. Khi tích hợp Mailchimp/SES SDK thì hookup ping thực sự.
    return {
      key: 'email',
      label: 'Email service',
      status: 'ok',
      lastOkAt: new Date().toISOString(),
    };
  }

  private async checkStorage(): Promise<SystemServiceStatusDto> {
    // MVP: trả ok. Sau có thể HEAD bucket S3 (timeout 3s).
    return {
      key: 'storage',
      label: 'Storage S3',
      status: 'ok',
      lastOkAt: new Date().toISOString(),
    };
  }

  /**
   * BR-DASH-20 — `systemDown` = TRUE khi API hoặc MyLaps đỏ > 5 phút.
   * Theo dõi bằng key `dashboard:system-down-since:<service>` — set lần đầu
   * detect down, DEL khi back ok.
   */
  private async computeSystemDown(
    api: SystemServiceStatusDto,
    mylaps: SystemServiceStatusDto,
  ): Promise<boolean> {
    const checks: Array<[string, SystemServiceStatusDto]> = [
      ['api', api],
      ['mylaps', mylaps],
    ];

    for (const [key, svc] of checks) {
      const sinceKey = `dashboard:system-down-since:${key}`;
      try {
        if (svc.status === 'down') {
          const existing = await this.redis.get(sinceKey);
          if (!existing) {
            await this.redis.set(sinceKey, String(Date.now()), 'EX', 600);
          } else {
            const since = Number(existing);
            if (
              !Number.isNaN(since) &&
              Date.now() - since > SYSTEM_DOWN_THRESHOLD_MS
            ) {
              return true;
            }
          }
        } else {
          await this.redis.del(sinceKey);
        }
      } catch (e) {
        this.logger.warn(
          `system-down compute fail key=${key} err=${(e as Error).message}`,
        );
      }
    }
    return false;
  }

  // ── Cache helpers ─────────────────────────────────────────────────────

  private async readCache(): Promise<SystemStatusResponseDto | null> {
    try {
      const raw = await this.redis.get(CACHE_KEY);
      return raw ? (JSON.parse(raw) as SystemStatusResponseDto) : null;
    } catch (e) {
      this.logger.warn(`system-status cache read fail: ${(e as Error).message}`);
      return null;
    }
  }

  private async writeCache(payload: SystemStatusResponseDto): Promise<void> {
    try {
      await this.redis.set(
        CACHE_KEY,
        JSON.stringify(payload),
        'EX',
        CACHE_TTL_SECONDS,
      );
    } catch (e) {
      this.logger.warn(`system-status cache write fail: ${(e as Error).message}`);
    }
  }

  private async withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Health check timeout ${ms}ms`)),
        ms,
      );
    });
    try {
      return await Promise.race([p, timeoutPromise]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
