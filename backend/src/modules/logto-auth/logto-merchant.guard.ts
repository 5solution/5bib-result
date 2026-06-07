import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { LogtoAuthGuard } from './logto-auth.guard';

/**
 * Merchant guard — verifies Logto access token AND requires merchant access.
 *
 * A user passes if ANY of the following is true:
 *
 *  (a) JWT `roles` claim contains `"merchant_viewer"` or `"merchant_finance"`
 *  (b) JWT `scope` claim contains `"merchant:read"` or `"merchant:finance"`
 *
 * `merchant_viewer` / `merchant:read`   → báo cáo bán vé (read-only).
 * `merchant_finance` / `merchant:finance` → doanh thu (finance, higher tier).
 *
 * Finance-only routes use LogtoMerchantFinanceGuard instead, which narrows
 * this to the finance role/scope.
 */
@Injectable()
export class LogtoMerchantGuard extends LogtoAuthGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const ok = await super.canActivate(ctx);
    if (!ok) return false;

    const req = ctx.switchToHttp().getRequest();
    const roles: string[] = req.logto?.roles ?? [];
    const scopes: string[] = req.logto?.scopes ?? [];

    const hasMerchantAccess =
      roles.includes('merchant_viewer') ||
      roles.includes('merchant_finance') ||
      scopes.includes('merchant:read') ||
      scopes.includes('merchant:finance');

    if (!hasMerchantAccess) {
      throw new ForbiddenException(
        'Cần quyền merchant. Liên hệ admin 5BIB để được cấp quyền.',
      );
    }
    return true;
  }
}
