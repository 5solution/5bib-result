import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { LogtoStaffGuard } from './logto-staff.guard';

/**
 * Unit tests cho LogtoStaffGuard — verify permission hierarchy
 * `staff` < `admin` < `all`.
 *
 * super.canActivate() (JWT verify) mock = true để chỉ test phần
 * scope/role gating phía sau.
 */
describe('LogtoStaffGuard', () => {
  let guard: LogtoStaffGuard;

  beforeEach(() => {
    guard = new LogtoStaffGuard();
    // Bypass JWT verify — tập trung test scope/role logic.
    jest
      .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
      .mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function makeCtx(scopes: string[] = [], roles: string[] = []): ExecutionContext {
    const req = { logto: { scopes, roles } };
    return {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
  }

  it('PASS khi scope chứa "staff"', async () => {
    const ctx = makeCtx(['staff']);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('PASS khi scope chứa "admin"', async () => {
    const ctx = makeCtx(['admin']);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('PASS khi scope chứa "all" (super admin)', async () => {
    const ctx = makeCtx(['all']);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('PASS khi role chứa "staff"', async () => {
    const ctx = makeCtx([], ['staff']);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('PASS khi role chứa "admin"', async () => {
    const ctx = makeCtx([], ['admin']);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('PASS khi role chứa "super_admin"', async () => {
    const ctx = makeCtx([], ['super_admin']);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('FAIL ForbiddenException khi scope rỗng + role rỗng', async () => {
    const ctx = makeCtx([], []);
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('FAIL ForbiddenException khi scope khác (vd "viewer")', async () => {
    const ctx = makeCtx(['viewer'], ['guest']);
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('FAIL false khi super.canActivate trả false (JWT invalid)', async () => {
    jest
      .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
      .mockResolvedValue(false);
    const ctx = makeCtx(['admin']);
    await expect(guard.canActivate(ctx)).resolves.toBe(false);
  });
});
