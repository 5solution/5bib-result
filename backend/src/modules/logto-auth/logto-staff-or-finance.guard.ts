import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { LogtoAuthGuard } from './logto-auth.guard';

/**
 * F-078 — Loosened guard cho module Hợp đồng (PAUSE-78-01 chốt).
 *
 * Chấp nhận union: staff OR finance OR admin OR super_admin OR all.
 *
 * Lý do: existing staff (Tâm, Hằng, …) đang dùng /contracts daily ops
 * (F-029 BR-HD-30 + F-066/F-067 contract revamp evidence). Khi mở thêm
 * role finance, KHÔNG được làm staff mất quyền — loosened policy = union
 * thay vì replace.
 *
 * Use cho 4 controller F-078:
 *   - contracts/contracts.controller.ts
 *   - contracts/contract-templates.controller.ts
 *   - contracts/partners.controller.ts
 *   - contracts/service-catalog.controller.ts
 *
 * Phân biệt:
 *   - `LogtoStaffGuard`: staff/admin/super_admin/all — KHÔNG finance pass
 *   - `LogtoStaffOrFinanceGuard`: staff/finance/admin/super_admin/all (union)
 *   - `LogtoFinanceGuard`: finance/admin/super_admin/all — KHÔNG staff pass
 *
 * Pattern reuse: F-069 + F-029 dual-check.
 */
@Injectable()
export class LogtoStaffOrFinanceGuard
  extends LogtoAuthGuard
  implements CanActivate
{
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    // Step 1: parent guard verify JWT signature + audience + issuer.
    const ok = await super.canActivate(ctx);
    if (!ok) return false;

    // Step 2: union check — staff ∪ finance ∪ admin.
    const req = ctx.switchToHttp().getRequest();
    const roles: string[] = req.logto?.roles ?? [];
    const scopes: string[] = req.logto?.scopes ?? [];

    const hasPermission =
      // Staff tier (existing — không regress)
      roles.includes('staff') ||
      scopes.includes('staff') ||
      // Finance tier (NEW — kế toán Hiền)
      roles.includes('finance') ||
      scopes.includes('finance') ||
      // Admin tier (inheritance)
      roles.includes('admin') ||
      roles.includes('super_admin') ||
      scopes.includes('admin') ||
      scopes.includes('admin:all') ||
      scopes.includes('all');

    if (!hasPermission) {
      throw new ForbiddenException(
        'Module Hợp đồng cần quyền staff, finance, hoặc admin. Liên hệ Danny để được cấp role phù hợp trên Logto Dashboard, sau đó đăng xuất + đăng nhập lại.',
      );
    }
    return true;
  }
}
