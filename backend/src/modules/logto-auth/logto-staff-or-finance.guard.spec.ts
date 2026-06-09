import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { LogtoStaffOrFinanceGuard } from './logto-staff-or-finance.guard';

/**
 * F-078 — Unit tests cho LogtoStaffOrFinanceGuard (loosened policy contracts).
 *
 * Verify union check: staff ∪ finance ∪ admin. PAUSE-78-01 chốt — existing
 * staff (Tâm, Hằng) KHÔNG được mất quyền /contracts khi mở thêm role finance.
 *
 * Coverage map (theo PRD `01-ba-prd.md`):
 *  - TC-05 Happy path Staff token (existing không regress)
 *  - TC-06 Happy path Finance token (NEW access)
 *  - TC-07 Anonymous → 401 (via super)
 *  - Plus admin inheritance + negative cases
 */
describe('LogtoStaffOrFinanceGuard (F-078)', () => {
  let guard: LogtoStaffOrFinanceGuard;

  beforeEach(() => {
    guard = new LogtoStaffOrFinanceGuard();
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

  describe('TC-05 — Happy path Staff token (existing không regress)', () => {
    it('PASS khi scope chứa "staff"', async () => {
      const ctx = makeCtx(['staff']);
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('PASS khi role chứa "staff"', async () => {
      const ctx = makeCtx([], ['staff']);
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });
  });

  describe('TC-06 — Happy path Finance token (NEW access)', () => {
    it('PASS khi scope chứa "finance"', async () => {
      const ctx = makeCtx(['finance']);
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('PASS khi role chứa "finance"', async () => {
      const ctx = makeCtx([], ['finance']);
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });
  });

  describe('TC-07 — Anonymous / Invalid JWT', () => {
    it('returns false khi super.canActivate trả false', async () => {
      jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(guard)),
          'canActivate',
        )
        .mockResolvedValue(false);
      const ctx = makeCtx(['staff']);
      await expect(guard.canActivate(ctx)).resolves.toBe(false);
    });
  });

  describe('Admin inheritance', () => {
    it('PASS khi role chứa "admin"', async () => {
      const ctx = makeCtx([], ['admin']);
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('PASS khi role chứa "super_admin"', async () => {
      const ctx = makeCtx([], ['super_admin']);
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('PASS khi scope chứa "all"', async () => {
      const ctx = makeCtx(['all']);
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('PASS khi scope chứa "admin:all"', async () => {
      const ctx = makeCtx(['admin:all']);
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });
  });

  describe('Negative — Unrelated permissions', () => {
    it('FAIL khi cả scopes + roles đều rỗng', async () => {
      const ctx = makeCtx([], []);
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('FAIL khi chỉ có "viewer" scope', async () => {
      const ctx = makeCtx(['viewer']);
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('FAIL khi chỉ có "merchant" role', async () => {
      const ctx = makeCtx([], ['merchant']);
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('FAIL ForbiddenException với VN message đúng (BR-78-06)', async () => {
      const ctx = makeCtx([], ['merchant']);
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        /Module Hợp đồng cần quyền staff, finance, hoặc admin/,
      );
    });
  });

  describe('Union coverage matrix', () => {
    // Verify cả 3 tier (staff/finance/admin) đều pass — union semantic
    const cases: Array<{ name: string; scopes: string[]; roles: string[] }> = [
      { name: 'staff scope', scopes: ['staff'], roles: [] },
      { name: 'finance scope', scopes: ['finance'], roles: [] },
      { name: 'admin scope', scopes: ['admin'], roles: [] },
      { name: 'staff role', scopes: [], roles: ['staff'] },
      { name: 'finance role', scopes: [], roles: ['finance'] },
      { name: 'admin role', scopes: [], roles: ['admin'] },
      {
        name: 'staff + finance dual',
        scopes: ['staff'],
        roles: ['finance'],
      },
    ];
    it.each(cases)('PASS với $name', async ({ scopes, roles }) => {
      const ctx = makeCtx(scopes, roles);
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });
  });
});
