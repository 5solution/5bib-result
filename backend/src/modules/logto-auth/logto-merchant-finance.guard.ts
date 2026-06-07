import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { LogtoMerchantGuard } from './logto-merchant.guard';

/**
 * Merchant finance guard — extends LogtoMerchantGuard, then narrows access to
 * the finance tier only.
 *
 * After the base merchant check passes (token valid + has merchant access),
 * a user must ALSO have ONE of:
 *
 *  (a) JWT `roles` claim contains `"merchant_finance"`
 *  (b) JWT `scope` claim contains `"merchant:finance"`
 *
 * `merchant_viewer` (báo cáo bán vé only) is rejected here — finance routes
 * expose doanh thu and require the elevated tier.
 */
@Injectable()
export class LogtoMerchantFinanceGuard
  extends LogtoMerchantGuard
  implements CanActivate
{
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const ok = await super.canActivate(ctx);
    if (!ok) return false;

    const req = ctx.switchToHttp().getRequest();
    const roles: string[] = req.logto?.roles ?? [];
    const scopes: string[] = req.logto?.scopes ?? [];

    const hasFinanceAccess =
      roles.includes('merchant_finance') || scopes.includes('merchant:finance');

    if (!hasFinanceAccess) {
      throw new ForbiddenException(
        'Bạn chỉ có quyền xem báo cáo bán vé. Liên hệ admin 5BIB để nâng cấp quyền xem doanh thu.',
      );
    }
    return true;
  }
}
