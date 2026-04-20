import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ClerkAuthGuard } from './clerk-auth.guard';
import type { ClerkUser } from './types';

/**
 * Admin-only guard: extends ClerkAuthGuard + yêu cầu publicMetadata.role === 'admin'.
 *
 * Set trong Clerk Dashboard → Users → [user] → Metadata → Public:
 *   { "role": "admin" }
 *
 * Guard cũng normalize req.user theo shape cũ (userId, email, role) để các
 * controller đã viết với `req.user.userId` không phải sửa code.
 */
@Injectable()
export class ClerkAdminGuard extends ClerkAuthGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const ok = await super.canActivate(ctx);
    if (!ok) return false;

    const req = ctx.switchToHttp().getRequest();
    const clerkUser = req.clerk as ClerkUser | undefined;
    if (!clerkUser) {
      throw new ForbiddenException('Clerk user not attached');
    }

    const role =
      (clerkUser.metadata as Record<string, unknown> | undefined)?.role;
    if (role !== 'admin') {
      throw new ForbiddenException(
        'Admin role required (set publicMetadata.role = "admin" in Clerk Dashboard)',
      );
    }

    // Normalize to legacy `req.user` shape for backward compat
    req.user = {
      userId: clerkUser.clerkId,
      sub: clerkUser.clerkId,
      email: clerkUser.email || '',
      role: 'admin',
    };
    return true;
  }
}
