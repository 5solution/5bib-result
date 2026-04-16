import { OpsRole } from './ops-role.type';

/**
 * JWT payload shape dành cho ops tokens (login qua /race-ops/auth/login).
 * Khác với admin JWT payload ở `token_type = 'ops'` + thêm `event_id`, `team_id`.
 *
 * JwtStrategy.validate() dispatch theo `token_type`:
 *  - 'ops'   → load từ `ops_users` collection
 *  - default → load từ `admin_users` (existing behavior, backward compat)
 */
export interface OpsJwtPayload {
  sub: string; // ops_users._id
  token_type: 'ops';
  role: OpsRole;
  tenant_id: string; // resolved từ event.tenant_id tại login time
  event_id: string;
  team_id?: string; // optional cho ops_admin
  email?: string;
  phone: string;
}

/** Authenticated ops user attached vào `req.user` sau validate(). */
export interface OpsUserContext {
  userId: string;
  sub: string;
  token_type: 'ops';
  role: OpsRole;
  tenant_id: string;
  event_id: string;
  team_id?: string;
  email?: string;
  phone: string;
  full_name: string;
}
