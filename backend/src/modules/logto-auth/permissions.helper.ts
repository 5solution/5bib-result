/**
 * Permission helpers — pure functions to check Logto user permission tier
 * without instantiating a guard. Useful for services that branch on
 * privilege level (e.g. F-029 public race-result endpoint where anon users
 * are blocked from `draft` races but staff+ can preview).
 *
 * **DUAL CHECK pattern** — mirrors `LogtoAdminGuard` + `LogtoStaffGuard`
 * verbatim. Both `roles[]` and `scopes[]` are checked; either match passes.
 * This defensive style lets Logto Dashboard config either:
 *   (a) Role-based: assign user a role like `admin`/`staff` whose `roles`
 *       claim is populated when token issued, OR
 *   (b) Scope-based: assign the role permission `admin`/`staff` on resource
 *       `5BIB Result API` so the `scope` claim is populated.
 *
 * Permission hierarchy: `staff` < `admin` < `all`/`super_admin`.
 * Higher tier passes lower tier check (admin passes isStaffOrHigher).
 *
 * Source of truth for hierarchy: `logto-staff.guard.ts` + `logto-admin.guard.ts`.
 * If those guards change, update these helpers verbatim.
 */

import type { LogtoUser } from './types';

/**
 * True if user is anonymous (no Logto token) OR has any 5BIB permission tier.
 * Convenience guard against undefined user.
 */
export function hasUser(user: LogtoUser | undefined): user is LogtoUser {
  return !!user;
}

/**
 * True if user has `admin` permission or higher (admin / super_admin / all).
 * Staff does NOT pass — use `isStaffOrHigher` for staff-level routes.
 *
 * Mirrors `LogtoAdminGuard.canActivate` permission check verbatim.
 */
export function isAdminOrHigher(user: LogtoUser | undefined): boolean {
  if (!user) return false;
  const roles = user.roles ?? [];
  const scopes = user.scopes ?? [];
  return (
    roles.includes('admin') ||
    roles.includes('super_admin') ||
    scopes.includes('admin') ||
    scopes.includes('admin:all') ||
    scopes.includes('all')
  );
}

/**
 * True if user has `staff` permission or higher (staff / admin / super_admin / all).
 * Use for daily-ops routes (contracts, reconciliations, awards, medical,
 * race-result preview of draft races).
 *
 * Mirrors `LogtoStaffGuard.canActivate` permission check verbatim.
 */
export function isStaffOrHigher(user: LogtoUser | undefined): boolean {
  if (!user) return false;
  const roles = user.roles ?? [];
  const scopes = user.scopes ?? [];
  return (
    scopes.includes('staff') ||
    scopes.includes('admin') ||
    scopes.includes('all') ||
    scopes.includes('admin:all') ||
    roles.includes('staff') ||
    roles.includes('admin') ||
    roles.includes('super_admin')
  );
}

/**
 * F-078 BR-78-17 — True if user has `finance` permission or higher (finance /
 * admin / super_admin / all). Staff DOES NOT pass — finance là tier song
 * song staff, không subset.
 *
 * Use cho service-level branching cần biết user có quyền finance tier
 * không (vd: future feature conditional rendering kpi summary).
 *
 * Mirrors `LogtoFinanceGuard.canActivate` permission check verbatim.
 */
export function isFinanceOrAdmin(user: LogtoUser | undefined): boolean {
  if (!user) return false;
  const roles = user.roles ?? [];
  const scopes = user.scopes ?? [];
  return (
    // Finance tier
    roles.includes('finance') ||
    scopes.includes('finance') ||
    // Admin inheritance
    roles.includes('admin') ||
    roles.includes('super_admin') ||
    scopes.includes('admin') ||
    scopes.includes('admin:all') ||
    scopes.includes('all')
  );
}

/**
 * F-078 BR-78-05 — True if user has `staff` OR `finance` permission or higher.
 * Loosened union for /contracts (PAUSE-78-01 chốt — staff Tâm/Hằng giữ quyền
 * existing, finance Hiền access mới).
 *
 * Mirrors `LogtoStaffOrFinanceGuard.canActivate` permission check verbatim.
 *
 * Reserved cho future service-level branching trong contracts domain.
 */
export function isStaffOrFinanceOrHigher(
  user: LogtoUser | undefined,
): boolean {
  if (!user) return false;
  return isStaffOrHigher(user) || isFinanceOrAdmin(user);
}
