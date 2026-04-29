import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import type { Request } from 'express';
import { LogtoAdminGuard } from '../logto-auth/logto-admin.guard';
import { ApiKeysService } from './api-keys.service';

/**
 * Decorator to require a specific scope on the API-key fallback path.
 * Admin endpoints decorate with @RequireScope('articles:write') and use this
 * guard — letting either a Logto admin JWT OR an API key holding the scope
 * pass through.
 */
export const REQUIRED_SCOPE_KEY = 'requiredApiKeyScope';
export const RequireScope = (scope: string) => SetMetadata(REQUIRED_SCOPE_KEY, scope);

const HEADER = 'x-api-key';

/**
 * Auth-OR guard: passes if EITHER
 *   1. Request carries a valid Logto admin JWT (delegates to LogtoAdminGuard), OR
 *   2. Request carries `X-API-Key` whose key holds the @RequireScope(...) scope.
 *
 * Use case: AI agents / scripts that can't acquire a Logto session token can
 * still write articles by holding a scoped key issued via admin /api-keys.
 *
 * If neither path passes:
 *   - missing both → 401
 *   - has key but missing scope → 403
 */
@Injectable()
export class LogtoOrApiKeyWriteGuard implements CanActivate {
  private readonly logger = new Logger(LogtoOrApiKeyWriteGuard.name);

  constructor(
    private readonly logtoGuard: LogtoAdminGuard,
    private readonly apiKeyService: ApiKeysService,
    private readonly reflector: Reflector,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const headerVal = req.headers[HEADER];
    const apiKey = Array.isArray(headerVal) ? headerVal[0] : headerVal;

    // No API key — must be Logto admin (will throw 401 itself if missing/invalid).
    if (!apiKey) {
      return this.logtoGuard.canActivate(ctx) as Promise<boolean>;
    }

    // API key path
    const requiredScope =
      this.reflector.get<string>(REQUIRED_SCOPE_KEY, ctx.getHandler()) ??
      this.reflector.get<string>(REQUIRED_SCOPE_KEY, ctx.getClass());
    if (!requiredScope) {
      // Defensive: shouldn't happen. Endpoint mounted this guard but didn't
      // declare a scope → block instead of silently allowing.
      throw new UnauthorizedException(
        'Endpoint missing @RequireScope() — refuse to authorize via API key',
      );
    }

    const origin = (req.headers.origin as string) || undefined;
    const keyDoc = await this.apiKeyService.verify(apiKey, origin);
    if (!keyDoc) {
      throw new UnauthorizedException('Invalid or revoked API key');
    }

    if (!Array.isArray(keyDoc.scopes) || !keyDoc.scopes.includes(requiredScope)) {
      throw new ForbiddenException(
        `API key missing required scope: ${requiredScope}`,
      );
    }

    // Per-minute rate limit shared with read-path guard semantics.
    if (keyDoc.rateLimitPerMinute > 0) {
      const minuteBucket = Math.floor(Date.now() / 60_000);
      const rateKey = `apikey:rate:${keyDoc.keyPrefix}:${minuteBucket}`;
      try {
        const count = await this.redis.incr(rateKey);
        if (count === 1) await this.redis.expire(rateKey, 70);
        if (count > keyDoc.rateLimitPerMinute) {
          throw new ForbiddenException('API key rate limit exceeded');
        }
      } catch (err) {
        if (err instanceof ForbiddenException) throw err;
        this.logger.warn(`Rate limit check failed: ${(err as Error).message}`);
      }
    }

    // Stash a synthetic actor on req so controllers that resolve the current
    // user (via @CurrentUser() which reads `req.logto`) get a stable identity
    // for things like authorId on article create.
    const syntheticUser = {
      userId: `apikey:${keyDoc.keyPrefix}`,
      name: `API: ${keyDoc.name}`,
      username: keyDoc.keyPrefix,
      email: '',
      picture: '',
      isApiKey: true,
    };
    (req as unknown as { user: unknown; logto: unknown }).user = syntheticUser;
    (req as unknown as { user: unknown; logto: unknown }).logto = syntheticUser;

    return true;
  }
}
