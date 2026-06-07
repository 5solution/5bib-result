/**
 * F-069 M1 — Unit tests cho LogtoMerchantFinanceGuard.
 *
 * 2-layer guard inheritance: extends LogtoMerchantGuard which extends LogtoAuthGuard.
 * Test phải mock JWT verify (LogtoAuthGuard) NHƯNG cho phép LogtoMerchantGuard
 * scope/role check chạy thật (vì đây là behavior chúng ta test).
 *
 * BR-MP-03 — chỉ merchant_finance pass, viewer FAIL với 403_NO_FINANCE.
 */

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { LogtoMerchantFinanceGuard } from './logto-merchant-finance.guard';
import { LogtoAuthGuard } from './logto-auth.guard';

describe('LogtoMerchantFinanceGuard', () => {
  let guard: LogtoMerchantFinanceGuard;

  beforeEach(() => {
    guard = new LogtoMerchantFinanceGuard();
    // Bypass JWT verify ở base layer (LogtoAuthGuard).
    // Class chain: Finance → Merchant → Auth. canActivate của Finance gọi
    // super (Merchant) canActivate → gọi super (Auth) canActivate.
    // Spy phải target LogtoAuthGuard.prototype.canActivate cụ thể.
    jest
      .spyOn(LogtoAuthGuard.prototype, 'canActivate')
      .mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function makeCtx(
    scopes: string[] = [],
    roles: string[] = [],
  ): ExecutionContext {
    const req = { logto: { scopes, roles } };
    return {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
  }

  // ──────────────────────────────────────────────────────────
  // PASS cases — finance access
  // ──────────────────────────────────────────────────────────

  it('PASS khi role chứa "merchant_finance"', async () => {
    const ctx = makeCtx([], ['merchant_finance']);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('PASS khi scope chứa "merchant:finance"', async () => {
    const ctx = makeCtx(['merchant:finance']);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('PASS khi user có cả role + scope finance', async () => {
    const ctx = makeCtx(['merchant:finance'], ['merchant_finance']);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('PASS khi user có merchant_viewer + merchant_finance roles', async () => {
    // Edge: user có cả 2 role (theoretical, Logto allows multi-role)
    const ctx = makeCtx([], ['merchant_viewer', 'merchant_finance']);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  // ──────────────────────────────────────────────────────────
  // FAIL cases — viewer-only or non-merchant
  // ──────────────────────────────────────────────────────────

  it('FAIL ForbiddenException khi user là merchant_viewer only (BR-MP-03 ZERO TOLERANCE)', async () => {
    const ctx = makeCtx([], ['merchant_viewer']);
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('FAIL khi scope chỉ có "merchant:read" (viewer only)', async () => {
    const ctx = makeCtx(['merchant:read']);
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('FAIL khi user không có merchant role nào (chặn ngay tại Merchant guard layer)', async () => {
    const ctx = makeCtx([], []);
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('FAIL khi user có "admin" only (admin KHÔNG pass merchant chain)', async () => {
    const ctx = makeCtx([], ['admin']);
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  // ──────────────────────────────────────────────────────────
  // Error message specificity
  // ──────────────────────────────────────────────────────────

  it('Viewer-only → message 403_NO_FINANCE ("nâng cấp quyền xem doanh thu")', async () => {
    const ctx = makeCtx([], ['merchant_viewer']);
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      /quyền xem báo cáo bán vé.*nâng cấp quyền xem doanh thu/,
    );
  });

  it('No merchant role → message 403_NO_ROLE (bubbled from LogtoMerchantGuard)', async () => {
    // Khi user KHÔNG có merchant role nào, LogtoMerchantGuard throw FIRST
    // → message khác với viewer-only case
    const ctx = makeCtx([], []);
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      /Cần quyền merchant/,
    );
  });

  // ──────────────────────────────────────────────────────────
  // JWT layer false
  // ──────────────────────────────────────────────────────────

  it('FAIL false khi JWT verify trả false', async () => {
    jest
      .spyOn(LogtoAuthGuard.prototype, 'canActivate')
      .mockResolvedValue(false);
    const ctx = makeCtx(['merchant:finance'], ['merchant_finance']);
    await expect(guard.canActivate(ctx)).resolves.toBe(false);
  });
});
