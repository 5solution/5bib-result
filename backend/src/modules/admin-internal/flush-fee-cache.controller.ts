import {
  Controller,
  Logger,
  Optional,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type { Redis } from 'ioredis';
import { LogtoAdminGuard } from '../logto-auth';

/**
 * F-061 BR-61-12 + PAUSE-61-BA-C — Response DTO cho admin manual flush.
 */
export class FlushFeeCacheResponseDto {
  @ApiProperty({ description: 'Số pattern đã flush' })
  flushedPatterns!: number;

  @ApiProperty({ description: 'Tổng số Redis keys xóa qua các pattern' })
  deletedKeys!: number;

  @ApiProperty({ description: 'Thời gian thực thi (ms)' })
  durationMs!: number;

  @ApiProperty({ type: [String], description: 'Patterns đã flush' })
  patterns!: string[];
}

/**
 * F-061 BR-61-12 — 11 Redis patterns flush sau deploy F-061.
 *
 * Sau khi deploy bug-fix SPLIT_BY_PAYMENT_REF extend, cached fee data trên
 * Redis (pnl + analytics + dashboard + merchant overrides) đã stale. Endpoint
 * này admin manual trigger 1-lần (PAUSE-61-05 = A) → invalidate toàn bộ.
 *
 * KHÔNG đụng `merchant.service.flushEventOverrideCache()` existing — endpoint
 * chuyên dụng (PAUSE-61-BA-C = NEW dedicated endpoint) tránh trigger spam
 * audit log khi override edit.
 */
const F061_FLUSH_PATTERNS: readonly string[] = [
  // F-040 P&L
  'pnl:*',
  // F-043 merchant fee overrides
  'merchant:fee-overrides:*',
  // F-058 Analytics — 6 sub-pattern
  'analytics:overview:*',
  'analytics:daily:*',
  'analytics:top-races:*',
  'analytics:rev-by-cat:*',
  'analytics:merchants:*',
  'analytics:races:*',
  // F-059 Dashboard — 2 sub-pattern
  'dashboard:kpi:*',
  'dashboard:sparkline:*',
];

/**
 * F-061 admin internal endpoint — flush fee cache 1-time post-deploy.
 *
 * Auth: LogtoAdminGuard (admin scope OR all super admin) — KHÔNG cho staff.
 * Idempotent: re-call sau khi đã flush → return `deletedKeys: 0` (TTL natural
 * expire). KHÔNG có rate-limit vì admin manual one-shot.
 *
 * @example
 * curl -X POST -H "Authorization: Bearer <admin-jwt>" \
 *   https://result-api.5bib.com/api/admin/internal/flush-fee-cache-f061
 */
@ApiTags('admin-internal')
@ApiBearerAuth()
@Controller('admin/internal')
@UseGuards(LogtoAdminGuard)
export class FlushFeeCacheController {
  private readonly logger = new Logger(FlushFeeCacheController.name);

  constructor(@Optional() @InjectRedis() private readonly redis?: Redis) {}

  @Post('flush-fee-cache-f061')
  @ApiOperation({
    summary: 'F-061 post-deploy flush 10 Redis fee cache patterns',
    description:
      'Admin manual 1-time trigger sau deploy F-061 (SPLIT_BY_PAYMENT_REF extend) — invalidate pnl + analytics + dashboard + merchant overrides cache. Idempotent.',
  })
  @ApiResponse({
    status: 200,
    description: 'Flush success — return total keys deleted + duration.',
    type: FlushFeeCacheResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid admin token' })
  @ApiResponse({ status: 403, description: 'Not admin role' })
  async flushAll(): Promise<FlushFeeCacheResponseDto> {
    const startTs = Date.now();
    let deletedCount = 0;

    if (!this.redis) {
      this.logger.warn(
        '[F-061 flush] Redis not configured — skip flush, returning zero counts',
      );
      return {
        flushedPatterns: 0,
        deletedKeys: 0,
        durationMs: Date.now() - startTs,
        patterns: [],
      };
    }

    for (const pattern of F061_FLUSH_PATTERNS) {
      try {
        const stream = (
          this.redis as unknown as {
            scanStream: (opts: {
              match: string;
              count: number;
            }) => NodeJS.ReadableStream;
          }
        ).scanStream({ match: pattern, count: 200 });
        const pipeline = this.redis.pipeline();
        let countThisPattern = 0;
        await new Promise<void>((resolve, reject) => {
          stream.on('data', (keys: string[]) => {
            for (const k of keys) {
              pipeline.del(k);
              countThisPattern++;
            }
          });
          stream.on('end', () => resolve());
          stream.on('error', (err: Error) => reject(err));
        });
        if (countThisPattern > 0) await pipeline.exec();
        deletedCount += countThisPattern;
      } catch (e) {
        this.logger.warn(
          `[F-061 flush] pattern=${pattern} fail: ${(e as Error).message}`,
        );
      }
    }

    const durationMs = Date.now() - startTs;
    this.logger.warn(
      `[F-061 flush] admin triggered — ${deletedCount} keys flushed across ${F061_FLUSH_PATTERNS.length} patterns in ${durationMs}ms`,
    );

    return {
      flushedPatterns: F061_FLUSH_PATTERNS.length,
      deletedKeys: deletedCount,
      durationMs,
      patterns: [...F061_FLUSH_PATTERNS],
    };
  }
}
