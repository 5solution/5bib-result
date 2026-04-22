import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { LogtoAuthGuard } from './logto-auth.guard';

/**
 * Optional variant of LogtoAuthGuard — never throws 401.
 *
 * If a valid Bearer token is present, attach req.logto / req.user.
 * Otherwise, let the request proceed anonymously (controllers can branch
 * on `req.user` being undefined). Used for public endpoints that return
 * extra data for authenticated admins (e.g. races listing that includes
 * draft races for admins only).
 */
@Injectable()
export class OptionalLogtoAuthGuard
  extends LogtoAuthGuard
  implements CanActivate
{
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    try {
      return await super.canActivate(ctx);
    } catch {
      // Swallow — request continues without req.user
      return true;
    }
  }
}
