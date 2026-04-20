import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { verifyToken } from '@clerk/backend';
import { env } from 'src/config';
import type { ClerkUser } from './types';

/**
 * Verify Clerk JWT từ header Authorization: Bearer <token>.
 * Gán user vào req.clerk cho các decorator downstream.
 *
 * Dùng `CLERK_JWT_KEY` (PEM public key từ Clerk Dashboard) để verify networkless.
 * Nếu chưa có JWT_KEY, fallback sang secretKey (gọi JWKS — chậm hơn).
 */
@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly logger = new Logger(ClerkAuthGuard.name);

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers?.authorization;

    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    const token = header.slice(7).trim();
    if (!token) {
      throw new UnauthorizedException('Empty token');
    }

    if (!env.clerk.jwtKey && !env.clerk.secretKey) {
      throw new UnauthorizedException('Clerk not configured');
    }

    try {
      const payload = await verifyToken(token, {
        jwtKey: env.clerk.jwtKey || undefined,
        secretKey: env.clerk.jwtKey ? undefined : env.clerk.secretKey,
        authorizedParties:
          env.clerk.authorizedParties.length > 0
            ? env.clerk.authorizedParties
            : undefined,
      });

      const p = payload as Record<string, any>;
      // Các field ngoài sub/sid chỉ có khi Custom Session Token template
      // được cấu hình trong Clerk Dashboard → Sessions → Customize session token
      const firstName: string | null = p.first_name || null;
      const lastName: string | null = p.last_name || null;
      const user: ClerkUser = {
        clerkId: String(payload.sub),
        sessionId: String(payload.sid || ''),
        email: p.email || p.primary_email_address || null,
        imageUrl: p.image_url || null,
        fullName:
          [firstName, lastName].filter(Boolean).join(' ') ||
          p.username ||
          null,
        metadata: (p.metadata || p.public_metadata || {}) as Record<
          string,
          unknown
        >,
      };

      req.clerk = user;
      return true;
    } catch (err) {
      this.logger.warn(`Clerk verify failed: ${(err as Error).message}`);
      throw new UnauthorizedException('Invalid Clerk token');
    }
  }
}
