import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { verifyToken } from '@clerk/backend';
import { env } from 'src/config';

/**
 * Like ClerkAuthGuard but NEVER throws.
 *
 * - Valid Clerk JWT  → sets req.user = { userId: sub, email } so downstream
 *   `isAdmin = !!req.user` checks work without modification.
 * - Missing / invalid token → continues with req.user = undefined (public access).
 *
 * Use on endpoints that serve both public and privileged callers (e.g. race
 * list / detail), where privileged callers get extra fields (_id, draft races).
 */
@Injectable()
export class OptionalClerkAuthGuard implements CanActivate {
  private readonly logger = new Logger(OptionalClerkAuthGuard.name);

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers?.authorization;

    if (!header?.startsWith('Bearer ')) return true; // no token → public

    const token = header.slice(7).trim();
    if (!token) return true;

    if (!env.clerk.jwtKey && !env.clerk.secretKey) return true; // Clerk not configured

    try {
      const payload = await verifyToken(token, {
        jwtKey: env.clerk.jwtKey || undefined,
        secretKey: env.clerk.jwtKey ? undefined : env.clerk.secretKey,
        authorizedParties:
          env.clerk.authorizedParties.length > 0
            ? env.clerk.authorizedParties
            : undefined,
      });

      const p = payload as Record<string, unknown>;
      // Set req.user so existing `isAdmin = !!req.user` checks work unchanged.
      req.user = {
        userId: String(payload.sub),
        email: (p.email as string) || null,
        role: ((p.metadata as Record<string, unknown>)?.role as string) || 'admin',
      };
    } catch (err) {
      // Invalid token — treat as public, don't throw
      this.logger.debug(`Optional Clerk verify skipped: ${(err as Error).message}`);
    }

    return true;
  }
}
