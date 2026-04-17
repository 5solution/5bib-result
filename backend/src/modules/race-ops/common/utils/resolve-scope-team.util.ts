import { ForbiddenException } from '@nestjs/common';
import { OpsUserContext } from '../types/ops-jwt-payload.type';

/**
 * BR-02 team isolation helper — single source of truth.
 *
 * Rule:
 *  - ops_admin      → returns `undefined` (no scope → sees all teams in event)
 *  - ops_leader     → returns their `team_id` (scoped to own team only)
 *  - ops_leader without team_id → throws 403 (cannot broaden scope)
 *  - ops_crew/ops_tnv → không expect gọi endpoint này (role-guard đã chặn ở
 *    tầng controller). Defensive: coi như leader → yêu cầu team_id.
 *
 * Callers must use the returned value to:
 *  - ADD `team_id` to Mongoose filters (list queries)
 *  - ASSERT target entity.team_id matches before mutating (approve/reject)
 *  - REJECT body payloads that specify a team_id ≠ returned scope
 *
 * Chọn duplicate-then-extract là cố ý: supply.controller.ts lẫn
 * applications.controller.ts đều cần — giữ chung một helper tránh lệch logic
 * giữa hai module khi policy thay đổi.
 */
export function resolveScopeTeamId(user: OpsUserContext): string | undefined {
  if (user.role === 'ops_admin') return undefined;
  if (!user.team_id) {
    throw new ForbiddenException(
      'Leader must be assigned to a team to perform this action',
    );
  }
  return user.team_id;
}
