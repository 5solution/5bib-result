import {
  hasUser,
  isAdminOrHigher,
  isStaffOrHigher,
  isFinanceOrAdmin,
  isStaffOrFinanceOrHigher,
} from './permissions.helper';
import type { LogtoUser } from './types';

/**
 * Unit tests cho permissions helpers — DUAL CHECK pattern (roles[] ∪ scopes[]).
 *
 * Mirrors LogtoAdminGuard + LogtoStaffGuard + LogtoFinanceGuard +
 * LogtoStaffOrFinanceGuard verbatim. Nếu guard change, helpers + tests
 * phải sync update.
 *
 * F-078 thêm coverage:
 *  - TC-12 isFinanceOrAdmin truth table 8 case
 *  - isStaffOrFinanceOrHigher truth table mirror BR-78-05
 */

function makeUser(
  roles: string[] = [],
  scopes: string[] = [],
): LogtoUser {
  return {
    userId: 'u_test',
    sub: 'u_test',
    email: 'test@5bib.com',
    role: roles[0] ?? 'user',
    roles,
    scopes,
  };
}

describe('permissions.helper', () => {
  describe('hasUser', () => {
    it('returns false cho undefined', () => {
      expect(hasUser(undefined)).toBe(false);
    });

    it('returns true cho user object', () => {
      expect(hasUser(makeUser([], []))).toBe(true);
    });
  });

  describe('isAdminOrHigher', () => {
    it.each([
      ['admin role', ['admin'], [], true],
      ['super_admin role', ['super_admin'], [], true],
      ['admin scope', [], ['admin'], true],
      ['admin:all scope', [], ['admin:all'], true],
      ['all scope', [], ['all'], true],
      ['staff role only', ['staff'], [], false],
      ['finance role only', ['finance'], [], false],
      ['empty', [], [], false],
      ['undefined', null, null, false],
    ])(
      '%s → %s',
      (
        _name: string,
        roles: string[] | null,
        scopes: string[] | null,
        expected: boolean,
      ) => {
        const user =
          roles === null && scopes === null
            ? undefined
            : makeUser(roles ?? [], scopes ?? []);
        expect(isAdminOrHigher(user)).toBe(expected);
      },
    );
  });

  describe('isStaffOrHigher', () => {
    it.each([
      ['staff role', ['staff'], [], true],
      ['admin role inherit', ['admin'], [], true],
      ['super_admin role inherit', ['super_admin'], [], true],
      ['staff scope', [], ['staff'], true],
      ['admin scope inherit', [], ['admin'], true],
      ['all scope inherit', [], ['all'], true],
      ['finance role only', ['finance'], [], false], // finance KHÔNG inherit staff
      ['empty', [], [], false],
    ])(
      '%s → %s',
      (
        _name: string,
        roles: string[],
        scopes: string[],
        expected: boolean,
      ) => {
        expect(isStaffOrHigher(makeUser(roles, scopes))).toBe(expected);
      },
    );

    it('undefined user → false', () => {
      expect(isStaffOrHigher(undefined)).toBe(false);
    });
  });

  describe('TC-12 — isFinanceOrAdmin (F-078 BR-78-17)', () => {
    it.each([
      ['finance role', ['finance'], [], true],
      ['finance scope', [], ['finance'], true],
      ['admin role inheritance', ['admin'], [], true],
      ['super_admin role inheritance', ['super_admin'], [], true],
      ['admin scope inheritance', [], ['admin'], true],
      ['admin:all scope', [], ['admin:all'], true],
      ['all scope (super override)', [], ['all'], true],
      ['staff role only → NOT pass', ['staff'], [], false],
      ['staff scope only → NOT pass', [], ['staff'], false],
      ['merchant role unrelated', ['merchant'], [], false],
      ['viewer scope unrelated', [], ['viewer'], false],
      ['empty roles + scopes', [], [], false],
    ])(
      '%s → %s',
      (
        _name: string,
        roles: string[],
        scopes: string[],
        expected: boolean,
      ) => {
        expect(isFinanceOrAdmin(makeUser(roles, scopes))).toBe(expected);
      },
    );

    it('undefined user → false', () => {
      expect(isFinanceOrAdmin(undefined)).toBe(false);
    });

    it('finance + admin combined (dual tier) → true', () => {
      expect(isFinanceOrAdmin(makeUser(['finance', 'admin'], []))).toBe(true);
    });
  });

  describe('isStaffOrFinanceOrHigher (F-078 BR-78-05 — loosened union)', () => {
    it.each([
      // Staff path
      ['staff role', ['staff'], [], true],
      ['staff scope', [], ['staff'], true],
      // Finance path
      ['finance role', ['finance'], [], true],
      ['finance scope', [], ['finance'], true],
      // Admin inheritance
      ['admin role', ['admin'], [], true],
      ['super_admin role', ['super_admin'], [], true],
      ['admin scope', [], ['admin'], true],
      ['all scope', [], ['all'], true],
      // Negative
      ['merchant role', ['merchant'], [], false],
      ['viewer scope', [], ['viewer'], false],
      ['empty', [], [], false],
    ])(
      '%s → %s',
      (
        _name: string,
        roles: string[],
        scopes: string[],
        expected: boolean,
      ) => {
        expect(
          isStaffOrFinanceOrHigher(makeUser(roles, scopes)),
        ).toBe(expected);
      },
    );

    it('undefined user → false', () => {
      expect(isStaffOrFinanceOrHigher(undefined)).toBe(false);
    });

    it('parity check: nếu isStaffOrHigher OR isFinanceOrAdmin true → result phải true', () => {
      // Property test: function = OR composition
      const cases = [
        ['staff', []],
        ['finance', []],
        ['admin', []],
        ['merchant', []],
      ] as const;
      for (const [role] of cases) {
        const u = makeUser([role], []);
        const expected = isStaffOrHigher(u) || isFinanceOrAdmin(u);
        expect(isStaffOrFinanceOrHigher(u)).toBe(expected);
      }
    });
  });
});
