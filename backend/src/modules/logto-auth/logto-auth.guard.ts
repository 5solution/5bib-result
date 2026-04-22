import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from 'src/config';
import type { LogtoUser } from './types';

/**
 * Logto OIDC guard — verifies Bearer access tokens issued by Logto for the
 * `5BIB Result API` resource.
 *
 * Verification is networkless after first JWKS fetch (keys cached in-memory).
 * Audience + issuer are pinned so tokens from other API resources are rejected.
 */
@Injectable()
export class LogtoAuthGuard implements CanActivate {
  private readonly logger = new Logger(LogtoAuthGuard.name);
  private jwks = createRemoteJWKSet(
    new URL(`${env.logto.endpoint}/oidc/jwks`),
  );

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers?.authorization;

    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token');
    }
    const token = header.slice(7).trim();
    if (!token) throw new UnauthorizedException('Empty token');

    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: `${env.logto.endpoint}/oidc`,
        audience: env.logto.apiResource,
      });

      const p = payload as Record<string, any>;
      const roles: string[] = Array.isArray(p.roles)
        ? p.roles
        : typeof p.roles === 'string'
          ? [p.roles]
          : [];
      const scopes: string[] =
        typeof p.scope === 'string' ? p.scope.split(' ').filter(Boolean) : [];

      const user: LogtoUser = {
        userId: String(payload.sub),
        sub: String(payload.sub),
        email: p.email || '',
        role: roles[0] || 'user',
        roles,
        scopes,
        username: p.username,
        name: p.name,
        picture: p.picture,
      };

      // Attach under both keys for backward compat with legacy controllers.
      req.logto = user;
      req.user = user;
      return true;
    } catch (err) {
      this.logger.warn(`Logto JWT verify failed: ${(err as Error).message}`);
      throw new UnauthorizedException('Invalid Logto token');
    }
  }
}
