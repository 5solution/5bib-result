import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { ChipRedisKeys } from '../utils/redis-keys';
import { ChipConfigService } from '../services/chip-config.service';

/**
 * Resolves token → mysql_race_id.
 * Two paths:
 *   1. Redis token index (HOT path) — set by ChipConfigService on
 *      generate/rotate. DEL on rotate/disable (BR-05 — instant invalidation).
 *   2. Mongo fallback (Redis miss/cold start) — only matches if
 *      chip_verify_enabled=true.
 *
 * On match, mutates request.params.raceId so downstream controllers can
 * reuse same accessor as admin endpoints.
 */
@Injectable()
export class ChipVerifyTokenGuard implements CanActivate {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ChipConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<{
      params: Record<string, string | number>;
      chipVerifyRaceId?: number;
      chipVerifyToken?: string;
    }>();

    const token = String(req.params?.token ?? '');
    if (!token || token.length !== 32 || !/^[A-Za-z0-9_-]{32}$/.test(token)) {
      throw new UnauthorizedException('Invalid token');
    }

    // Hot path: Redis
    let raceIdStr = await this.redis.get(ChipRedisKeys.tokenIndex(token));
    if (!raceIdStr) {
      // Cold fallback — verify against Mongo (and re-index if found)
      const cfg = await this.configService.getByToken(token);
      if (!cfg) {
        throw new UnauthorizedException('Invalid or revoked token');
      }
      raceIdStr = String(cfg.mysql_race_id);
    }

    const raceId = Number(raceIdStr);
    if (!Number.isFinite(raceId) || raceId <= 0) {
      throw new UnauthorizedException('Invalid token');
    }

    req.chipVerifyRaceId = raceId;
    req.chipVerifyToken = token;
    req.params.raceId = raceId; // for stats endpoint reuse
    return true;
  }
}
