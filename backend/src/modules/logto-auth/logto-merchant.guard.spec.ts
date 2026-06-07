/**
 * F-069 M1 — Unit tests cho LogtoMerchantGuard.
 *
 * Pattern port từ logto-staff.guard.spec.ts (80 dòng, proven F-068).
 * super.canActivate() (JWT verify) mock = true để chỉ test scope/role gating.
 *
 * BR-MP-02 — merchant_viewer / merchant_finance / merchant:read / merchant:finance
 * pass; admin / staff / no-role FAIL với ForbiddenException VN message.
 */

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { LogtoMerchantGuard } from './logto-merchant.guard';

describe('LogtoMerchantGuard', () => {
  let guard: LogtoMerchantGuard;

  beforeEach(() => {
    guard = new LogtoMerchantGuard();
    // Bypass JWT verify — tập trung test merchant role/scope gating
    jest
      .spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate',
      )
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
  // PASS cases — merchant access
  // ──────────────────────────────────────────────────────────

  it('PASS khi role chứa "merchant_viewer"', async () => {
    const ctx = makeCtx([], ['merchant_viewer']);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('PASS khi role chứa "merchant_finance" (inherit viewer)', async () => {
    const ctx = makeCtx([], ['merchant_finance']);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('PASS khi scope chứa "merchant:read"', async () => {
    const ctx = makeCtx(['merchant:read']);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('PASS khi scope chứa "merchant:finance" (inherit read)', async () => {
    const ctx = makeCtx(['merchant:finance']);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('PASS khi user có cả 2 role (merchant_viewer + merchant_finance)', async () => {
    const ctx = makeCtx([], ['merchant_viewer', 'merchant_finance']);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  // ──────────────────────────────────────────────────────────
  // FAIL cases — non-merchant accounts
  // ──────────────────────────────────────────────────────────

  it('FAIL ForbiddenException khi scope rỗng + role rỗng', async () => {
    const ctx = makeCtx([], []);
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('FAIL khi user có role "admin" only (BR-MP-02 — admin KHÔNG pass merchant guard)', async () => {
    const ctx = makeCtx([], ['admin']);
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('FAIL khi user có role "super_admin" only (admin KHÔNG pass merchant)', async () => {
    const ctx = makeCtx([], ['super_admin']);
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('FAIL khi user có role "staff" only (staff KHÔNG pass merchant)', async () => {
    const ctx = makeCtx([], ['staff']);
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('FAIL khi scope chứa "admin" only (admin scope KHÔNG pass merchant)', async () => {
    const ctx = makeCtx(['admin'], []);
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('FAIL khi scope chứa "viewer" / role "guest" (irrelevant scopes)', async () => {
    const ctx = makeCtx(['viewer'], ['guest']);
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  // ──────────────────────────────────────────────────────────
  // Error message — bilingual VN per BR-MP-27 403_NO_ROLE
  // ──────────────────────────────────────────────────────────

  it('ForbiddenException message tiếng Việt (BR-MP-27 403_NO_ROLE)', async () => {
    const ctx = makeCtx([], []);
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      /Cần quyền merchant.*admin 5BIB/,
    );
  });

  // ──────────────────────────────────────────────────────────
  // JWT layer — super.canActivate returns false
  // ──────────────────────────────────────────────────────────

  it('FAIL false khi super.canActivate trả false (JWT invalid)', async () => {
    jest
      .spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate',
      )
      .mockResolvedValue(false);
    const ctx = makeCtx(['merchant:finance'], ['merchant_finance']);
    await expect(guard.canActivate(ctx)).resolves.toBe(false);
  });
});
