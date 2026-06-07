import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { LogtoAuthGuard } from './logto-auth.guard';

/**
 * F-069 BR-MP-02 — Merchant Portal base guard.
 *
 * Verify Logto access token AND require merchant role/scope.
 *
 * Permission hierarchy: `merchant_viewer` < `merchant_finance`.
 *   - `merchant_viewer` (scope `merchant:read`) — xem Ticket Sales report only.
 *   - `merchant_finance` (scope `merchant:finance`) — inherit viewer + Revenue.
 *
 * Logto Dashboard setup (Resources → 5BIB Result API → Permissions):
 *  - Permission `merchant:read` — Quyền đọc báo cáo bán vé
 *  - Permission `merchant:finance` — Quyền đọc báo cáo doanh thu
 *  - Role `merchant_viewer` assigned permission `merchant:read`
 *  - Role `merchant_finance` assigned BOTH `merchant:read` + `merchant:finance`
 *
 * KHÔNG cho `admin` / `staff` / `super_admin` pass guard này — admin có endpoint
 * riêng (`LogtoAdminGuard`) cho merchant-portal admin config. Tách bạch giúp:
 *   - Tránh nhầm lẫn admin xem trực tiếp merchant report (admin xem qua admin.5bib.com)
 *   - Per-user access config (BR-MP-04) chỉ apply cho merchant role users
 *   - Audit log phân biệt admin op vs merchant query
 *
 * Use guard này cho merchant user endpoints (BR-MP-26 phần đầu):
 *   GET /api/merchant-portal/me, /races, /ticket-sales/*, /revenue/* (CHỈ summary
 *   với view subset — finance-specific endpoints dùng `LogtoMerchantFinanceGuard`).
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
      // Role-based: 2 merchant roles
      roles.includes('merchant_viewer') ||
      roles.includes('merchant_finance') ||
      // Scope-based: cả 2 scope đều đủ để pass base guard
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
