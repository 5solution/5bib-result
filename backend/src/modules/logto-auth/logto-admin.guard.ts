import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { LogtoAuthGuard } from './logto-auth.guard';

/**
 * Admin-only guard — verifies Logto access token AND requires admin rights.
 *
 * Two equivalent ways a user can be admin, both checked:
 *
 *  (a) JWT `roles` claim contains `"admin"`
 *      — populated when the role has at least one permission on the
 *        requested API resource.
 *
 *  (b) JWT `scope` claim contains `"admin"`
 *      — populated when the user's role has the `admin` permission
 *        assigned on the API resource.
 *
 * In Logto Dashboard this means:
 *   Resources → 5BIB Result API → Permissions → create `admin`
 *   Roles → admin → Assign permissions → tick `admin` of that resource
 *
 * As long as one of the two conditions is true, guard accepts.
 */
@Injectable()
export class LogtoAdminGuard extends LogtoAuthGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const ok = await super.canActivate(ctx);
    if (!ok) return false;

    const req = ctx.switchToHttp().getRequest();
    const roles: string[] = req.logto?.roles ?? [];
    const scopes: string[] = req.logto?.scopes ?? [];

    const isAdmin =
      roles.includes('admin') ||
      scopes.includes('admin') ||
      scopes.includes('admin:all');

    if (!isAdmin) {
      throw new ForbiddenException(
        'Admin required. Ensure the `admin` role is assigned the `admin` permission on the `5BIB Result API` resource in Logto Dashboard, then sign out and sign in again to refresh the access token.',
      );
    }
    return true;
  }
}
