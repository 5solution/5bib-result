import {
  OPS_TOKEN_TYPES,
  OpsUserContext,
} from '../types/ops-jwt-payload.type';

/**
 * Type-guard: trả `true` nếu `user` (từ `req.user`) có shape là authenticated
 * ops context — tức đã qua `OpsJwtStrategy.validate()`.
 *
 * Dùng ở `OpsRoleGuard` + `@OpsUserCtx()` decorator để tránh drift giữa 2 chỗ
 * check (trước đây cả 2 hard-check `token_type === 'ops'`, miss
 * `'admin-bridge'` → admin bridge bị 403/401).
 *
 * **Single source of truth**: logic accept/reject nằm ở một chỗ. Thêm token
 * type mới chỉ cần update `OPS_TOKEN_TYPES`.
 *
 * @example
 * if (!isOpsAuthenticated(req.user)) {
 *   throw new UnauthorizedException('Not an ops token');
 * }
 * // sau đây `req.user` đã được narrow về OpsUserContext
 */
export function isOpsAuthenticated(user: unknown): user is OpsUserContext {
  if (!user || typeof user !== 'object') {
    return false;
  }
  const tokenType = (user as { token_type?: unknown }).token_type;
  return (
    typeof tokenType === 'string' &&
    (OPS_TOKEN_TYPES as readonly string[]).includes(tokenType)
  );
}
