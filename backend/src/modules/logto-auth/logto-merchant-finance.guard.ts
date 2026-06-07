import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { LogtoMerchantGuard } from './logto-merchant.guard';

/**
 * F-069 BR-MP-03 — Merchant Finance guard.
 *
 * Verify Logto access token + base merchant role (via super) + REQUIRE
 * `merchant_finance` role hoặc `merchant:finance` scope.
 *
 * Tách biệt với `LogtoMerchantGuard`:
 *   - LogtoMerchantGuard: PASS cho cả `merchant_viewer` và `merchant_finance`
 *   - LogtoMerchantFinanceGuard: CHỈ PASS cho `merchant_finance` — viewer FAIL
 *
 * Hệ quả: viewer truy cập revenue endpoint → 403 với message rõ ràng VN
 * (BR-MP-27 403_NO_FINANCE). Frontend redirect /ticket-sales + toast warning.
 *
 * Use guard này cho revenue endpoints (BR-MP-26 phần sau):
 *   - GET /api/merchant-portal/revenue/summary
 *   - GET /api/merchant-portal/revenue/breakdown
 *   - GET /api/merchant-portal/revenue/trend
 *   - GET /api/merchant-portal/revenue/export
 *
 * BR-MP-09 ZERO TOLERANCE: ngay cả nếu viewer bypass UI (truy cập URL trực tiếp
 * via Postman / curl) thì guard này phải reject — defense in depth.
 */
@Injectable()
export class LogtoMerchantFinanceGuard
  extends LogtoMerchantGuard
  implements CanActivate
{
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    // Step 1: parent guard verify JWT + base merchant role.
    // Nếu user là viewer-only thì super pass (vì viewer is merchant) →
    // bước 2 sẽ catch + throw finance-specific exception.
    const ok = await super.canActivate(ctx);
    if (!ok) return false;

    // Step 2: thêm check finance-specific role/scope
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
