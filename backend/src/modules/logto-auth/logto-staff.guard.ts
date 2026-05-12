import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { LogtoAuthGuard } from './logto-auth.guard';

/**
 * Staff-level guard — verify Logto access token + require staff/admin/all permission.
 *
 * Permission hierarchy: `staff` < `admin` < `all` (super admin).
 * User có scope hoặc role nào trong tập hợp đó đều pass.
 *
 * Logto Dashboard setup (Resources → 5BIB Result API → Permissions):
 *  - `staff` — Nhân sự 5BIB (Tâm, Hằng, ...) cấp basic access daily ops.
 *  - `admin` — CEO / Danny / quản lý cấp cao.
 *  - `all`   — Super admin override (bypass mọi check).
 *
 * Use cho module daily-ops: Contracts / Reconciliations / Master data /
 * Command Center / Medical / Awards / Dashboard.
 *
 * KHÔNG dùng cho: Analytics (F-026) / Finance P&L (F-028) — những module này
 * dùng `LogtoAdminGuard` (admin-only) để bảo vệ thông tin business/finance.
 */
@Injectable()
export class LogtoStaffGuard extends LogtoAuthGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const ok = await super.canActivate(ctx);
    if (!ok) return false;

    const req = ctx.switchToHttp().getRequest();
    const roles: string[] = req.logto?.roles ?? [];
    const scopes: string[] = req.logto?.scopes ?? [];

    const hasPermission =
      // Scope-based (Logto API resource permissions)
      scopes.includes('staff') ||
      scopes.includes('admin') ||
      scopes.includes('all') ||
      scopes.includes('admin:all') ||
      // Role-based (Logto roles claim)
      roles.includes('staff') ||
      roles.includes('admin') ||
      roles.includes('super_admin');

    if (!hasPermission) {
      throw new ForbiddenException(
        'Cần quyền staff hoặc cao hơn. Trong Logto Dashboard, gán permission `staff` (hoặc `admin` / `all`) trên resource `5BIB Result API` cho role của bạn, sau đó đăng xuất + đăng nhập lại để refresh access token.',
      );
    }
    return true;
  }
}
