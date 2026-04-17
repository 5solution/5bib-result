import { OpsRole } from './ops-role.type';

/**
 * Source of truth cho mọi `token_type` được accept bởi ops endpoints.
 *
 * - `'ops'`         → native ops JWT (login qua `/race-ops/auth/login`).
 * - `'admin-bridge'`→ admin JWT được `OpsJwtStrategy` synthesize thành
 *                     `ops_admin` context (single-tenant MVP — admin Dashboard
 *                     chia sẻ UI quản race-ops mà không cần dual login).
 *
 * THÊM token type mới phải update mảng này trước; `OpsTokenType` + consumers
 * (`isOpsAuthenticated`, guard, decorator) tự động pick up.
 */
export const OPS_TOKEN_TYPES = ['ops', 'admin-bridge'] as const;

export type OpsTokenType = (typeof OPS_TOKEN_TYPES)[number];

/**
 * JWT payload shape dành cho ops tokens (login qua /race-ops/auth/login).
 * Khác với admin JWT payload ở `token_type = 'ops'` + thêm `event_id`, `team_id`.
 *
 * OpsJwtStrategy.validate() accept cả admin tokens (`role === 'admin'`):
 *  - Admin được synthesize thành context với role='ops_admin' + tenant_id default
 *  - Dùng chung UI admin cho race-ops mà không cần dual-login UX
 */
export interface OpsJwtPayload {
  sub: string; // ops_users._id hoặc admin_users._id
  token_type?: 'ops'; // missing nếu là admin token
  role: OpsRole | 'admin';
  tenant_id?: string; // resolved từ event.tenant_id tại login time (missing nếu admin)
  event_id?: string; // missing nếu admin
  team_id?: string; // optional cho ops_admin
  email?: string;
  phone?: string;
}

/**
 * Authenticated ops user attached vào `req.user` sau validate().
 *
 * `token_type` bị gò theo {@link OpsTokenType} — thay vì literal union tự viết
 * tay ở nhiều nơi. Đổi `OPS_TOKEN_TYPES` một chỗ → cả guard + decorator +
 * strategy đều gò compile cùng lúc.
 */
export interface OpsUserContext {
  userId: string;
  sub: string;
  token_type: OpsTokenType;
  role: OpsRole;
  tenant_id: string;
  event_id: string;
  team_id?: string;
  email?: string;
  phone: string;
  full_name: string;
}
