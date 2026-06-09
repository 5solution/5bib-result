import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { LogtoFinanceGuard } from './logto-finance.guard';

/**
 * F-078 — Unit tests cho LogtoFinanceGuard.
 *
 * Verify permission hierarchy: `finance < admin < all`. Admin tier tự động
 * pass (BR-78-02 #3-#4 inheritance defense-in-depth — phòng trường hợp
 * Danny quên tick permission `finance` cho admin role ở Logto).
 *
 * Coverage map (theo PRD `01-ba-prd.md`):
 *  - TC-01 Happy path Finance token (role-based)
 *  - TC-02 Happy path Admin token (inheritance)
 *  - TC-03 Forbid staff-only token
 *  - TC-04 Anonymous (super.canActivate=false) — guard returns false
 *  - TC-08 Edge: roles=['finance'] scopes=[] empty → PASS
 *  - TC-09 Edge: scopes=['finance'] roles=[] empty → PASS
 *  - TC-10 Edge: admin token KHÔNG tick `finance` permission → PASS (inheritance)
 *
 * super.canActivate() (JWT verify) mock = true để chỉ test phần
 * scope/role gating phía sau.
 */
describe('LogtoFinanceGuard (F-078)', () => {
  let guard: LogtoFinanceGuard;

  beforeEach(() => {
    guard = new LogtoFinanceGuard();
    // Bypass JWT verify — tập trung test scope/role logic.
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

  describe('TC-01 — Happy path Finance token', () => {
    it('PASS khi scope chứa "finance"', async () => {
      const ctx = makeCtx(['finance']);
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('PASS khi role chứa "finance"', async () => {
      const ctx = makeCtx([], ['finance']);
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });
  });

  describe('TC-02 — Happy path Admin inheritance', () => {
    it('PASS khi role chứa "admin"', async () => {
      const ctx = makeCtx([], ['admin']);
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('PASS khi scope chứa "admin"', async () => {
      const ctx = makeCtx(['admin']);
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('PASS khi role chứa "super_admin"', async () => {
      const ctx = makeCtx([], ['super_admin']);
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('PASS khi scope chứa "all" (super override)', async () => {
      const ctx = makeCtx(['all']);
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('PASS khi scope chứa "admin:all"', async () => {
      const ctx = makeCtx(['admin:all']);
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });
  });

  describe('TC-03 — Forbid staff-only token', () => {
    it('FAIL ForbiddenException khi chỉ có role "staff" (KHÔNG inherit finance)', async () => {
      const ctx = makeCtx([], ['staff']);
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('FAIL ForbiddenException khi chỉ có scope "staff"', async () => {
      const ctx = makeCtx(['staff']);
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('FAIL ForbiddenException với VN message rõ ràng (BR-78-06)', async () => {
      const ctx = makeCtx([], ['staff']);
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        /Module Tài chính \/ Hợp đồng \/ Đối soát hóa đơn.+role `finance`.+admin/,
      );
    });
  });

  describe('TC-04 — Anonymous / Invalid JWT', () => {
    it('returns false khi super.canActivate trả false (JWT invalid)', async () => {
      jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(guard)),
          'canActivate',
        )
        .mockResolvedValue(false);
      const ctx = makeCtx(['finance']);
      await expect(guard.canActivate(ctx)).resolves.toBe(false);
    });
  });

  describe('TC-08 — Edge: role-based path only (scope empty)', () => {
    it('PASS khi roles=["finance"] và scopes=[] empty (BR-78-16 dual-check)', async () => {
      const ctx = makeCtx([], ['finance']);
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });
  });

  describe('TC-09 — Edge: scope-based path only (role empty)', () => {
    it('PASS khi scopes=["finance"] và roles=[] empty (BR-78-16 dual-check)', async () => {
      const ctx = makeCtx(['finance'], []);
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });
  });

  describe('TC-10 — Edge: Admin inheritance fallback (no `finance` permission)', () => {
    it('PASS khi role admin nhưng KHÔNG có permission `finance` tick ở Logto', async () => {
      // Simulate case Danny quên tick permission `finance` cho role admin.
      // Token chỉ có roles=['admin'], scopes=['admin'] — KHÔNG có 'finance'
      // anywhere. Guard vẫn PASS qua admin path (BR-78-02 #3-#4).
      const ctx = makeCtx(['admin'], ['admin']);
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });
  });

  describe('Negative — Other unrelated permissions', () => {
    it('FAIL khi chỉ có "merchant" role (không liên quan internal)', async () => {
      const ctx = makeCtx([], ['merchant']);
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('FAIL khi cả scopes + roles đều rỗng', async () => {
      const ctx = makeCtx([], []);
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('FAIL khi scope là "viewer" (Logto default unrelated)', async () => {
      const ctx = makeCtx(['viewer']);
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });
});
