import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import type { Request } from 'express';
import { ApiKeysService } from './api-keys.service';

const HEADER = 'x-api-key';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(
    private readonly service: ApiKeysService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const headerVal = req.headers[HEADER];
    const fullKey = Array.isArray(headerVal) ? headerVal[0] : headerVal;

    if (!fullKey) {
      throw new UnauthorizedException(
        'Missing X-API-Key header. Get a key from admin → API Keys.',
      );
    }

    const origin = (req.headers.origin as string) || undefined;
    const keyDoc = await this.service.verify(fullKey, origin);
    if (!keyDoc) {
      throw new UnauthorizedException('Invalid or revoked API key');
    }

    // Per-minute rate limit (Redis fixed window)
    if (keyDoc.rateLimitPerMinute > 0) {
      const minuteBucket = Math.floor(Date.now() / 60_000);
      const rateKey = `apikey:rate:${keyDoc.keyPrefix}:${minuteBucket}`;
      try {
        const count = await this.redis.incr(rateKey);
        if (count === 1) await this.redis.expire(rateKey, 70);
        if (count > keyDoc.rateLimitPerMinute) {
          throw new HttpException('API key rate limit exceeded', 429);
        }
      } catch (err) {
        if (err instanceof HttpException) throw err;
        // Redis down → fail open (don't block legitimate traffic)
        this.logger.warn(`Rate limit check failed: ${(err as Error).message}`);
      }
    }

    return true;
  }
}
