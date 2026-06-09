import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { LogtoAuthGuard } from './logto-auth.guard';

/**
 * F-078 — Internal Finance role guard.
 *
 * Verify Logto access token + REQUIRE permission tier finance hoặc admin.
 * Permission hierarchy: `finance < admin < all`. Admin tier tự động pass
 * (defense-in-depth — phòng trường hợp Danny quên tick permission `finance`
 * cho role admin ở Logto Dashboard, BR-78-16 + BR-78-02 #3-#4).
 *
 * Hierarchy chi tiết:
 *   - finance (kế toán Hiền) — pass
 *   - admin (Danny) — pass (inheritance)
 *   - super_admin / all / admin:all — pass (super override)
 *   - staff (Tâm, Hằng) — FAIL với message VN
 *   - anonymous — FAIL 401 (via super LogtoAuthGuard)
 *
 * Use cho 9 controller F-078: 8 finance/controllers/* + 1 invoice-reconcile.
 *
 * Phân biệt với `LogtoAdminGuard`:
 *   - `LogtoAdminGuard`: chỉ admin/super_admin/all — KHÔNG finance pass
 *   - `LogtoFinanceGuard`: finance + admin/super_admin/all — staff FAIL
 *
 * KHÔNG dùng cho contracts (dùng `LogtoStaffOrFinanceGuard` — loosened policy
 * giữ staff Tâm/Hằng quyền access /contracts, PAUSE-78-01 chốt).
 *
 * Pattern reuse: F-069 `LogtoMerchantFinanceGuard` precedent (dual-check
 * roles[] ∪ scopes[]), F-029 dual-check helper convention.
 */
@Injectable()
export class LogtoFinanceGuard extends LogtoAuthGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    // Step 1: parent guard verify JWT signature + audience + issuer.
    const ok = await super.canActivate(ctx);
    if (!ok) return false;

    // Step 2: role/scope dual-check (BR-78-16). Either path pass.
    const req = ctx.switchToHttp().getRequest();
    const roles: string[] = req.logto?.roles ?? [];
    const scopes: string[] = req.logto?.scopes ?? [];

    const hasPermission =
      // Finance tier (BR-78-02 #1, #2)
      roles.includes('finance') ||
      scopes.includes('finance') ||
      // Admin inheritance (BR-78-02 #3, #4) — defense-in-depth fallback
      roles.includes('admin') ||
      roles.includes('super_admin') ||
      scopes.includes('admin') ||
      scopes.includes('admin:all') ||
      scopes.includes('all');

    if (!hasPermission) {
      throw new ForbiddenException(
        'Module Tài chính / Hợp đồng / Đối soát hóa đơn chỉ dành cho nhân sự kế toán (role `finance`) hoặc admin. Liên hệ Danny để được cấp quyền role `finance` trên Logto Dashboard, sau đó đăng xuất + đăng nhập lại để refresh access token.',
      );
    }
    return true;
  }
}
