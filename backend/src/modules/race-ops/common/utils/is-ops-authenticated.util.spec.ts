import { isOpsAuthenticated } from './is-ops-authenticated.util';

describe('isOpsAuthenticated', () => {
  const baseCtx = {
    userId: 'u1',
    sub: 'u1',
    role: 'ops_admin',
    tenant_id: '5bib-default',
    event_id: 'e1',
    phone: '0900000000',
    full_name: 'Test',
  };

  describe('accepts', () => {
    it('native ops token (token_type="ops")', () => {
      expect(isOpsAuthenticated({ ...baseCtx, token_type: 'ops' })).toBe(true);
    });

    it('admin bridge (token_type="admin-bridge")', () => {
      expect(
        isOpsAuthenticated({ ...baseCtx, token_type: 'admin-bridge' }),
      ).toBe(true);
    });
  });

  describe('rejects', () => {
    it('null', () => {
      expect(isOpsAuthenticated(null)).toBe(false);
    });

    it('undefined', () => {
      expect(isOpsAuthenticated(undefined)).toBe(false);
    });

    it('primitives', () => {
      expect(isOpsAuthenticated('ops')).toBe(false);
      expect(isOpsAuthenticated(42)).toBe(false);
      expect(isOpsAuthenticated(true)).toBe(false);
    });

    it('object without token_type', () => {
      expect(isOpsAuthenticated(baseCtx)).toBe(false);
    });

    it('unknown token_type', () => {
      expect(isOpsAuthenticated({ ...baseCtx, token_type: 'guest' })).toBe(
        false,
      );
      expect(isOpsAuthenticated({ ...baseCtx, token_type: '' })).toBe(false);
    });

    it('non-string token_type (defense-in-depth)', () => {
      expect(isOpsAuthenticated({ ...baseCtx, token_type: 1 })).toBe(false);
      expect(isOpsAuthenticated({ ...baseCtx, token_type: null })).toBe(false);
      expect(isOpsAuthenticated({ ...baseCtx, token_type: ['ops'] })).toBe(
        false,
      );
    });
  });

  describe('type narrowing', () => {
    it('narrows user to OpsUserContext for TS consumers', () => {
      const user: unknown = { ...baseCtx, token_type: 'ops' };
      if (isOpsAuthenticated(user)) {
        // Compile-time check: `user.role` / `user.tenant_id` must be accessible
        // without casts. If this file compiles, narrowing works.
        expect(user.role).toBe('ops_admin');
        expect(user.tenant_id).toBe('5bib-default');
        expect(user.token_type).toBe('ops');
      } else {
        fail('isOpsAuthenticated should have returned true');
      }
    });
  });
});
