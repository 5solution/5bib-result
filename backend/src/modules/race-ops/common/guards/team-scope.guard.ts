import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { OpsRole } from '../types/ops-role.type';

/**
 * Enforce BR-02: Leader/Crew chỉ thấy data team mình.
 *
 * Cách dùng: sau `OpsRoleGuard`, service layer phải dùng `ctx.user.team_id`
 * để filter query. Guard này là fallback/preflight check đảm bảo
 * `team_id` present trong token cho role cần scope.
 *
 * @example
 * @UseGuards(JwtAuthGuard, OpsRoleGuard, TeamScopeGuard)
 * @OpsRoles('ops_leader', 'ops_crew')
 * @Get('my-team/overview')
 */
@Injectable()
export class TeamScopeGuard implements CanActivate {
  private static readonly SCOPED_ROLES: ReadonlyArray<OpsRole> = [
    'ops_leader',
    'ops_crew',
    'ops_tnv',
  ];

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { user?: unknown }>();
    const user = req.user;

    if (!user || typeof user !== 'object') {
      throw new UnauthorizedException('Missing auth');
    }

    const u = user as { role?: unknown; team_id?: unknown; event_id?: unknown };

    if (!u.event_id || typeof u.event_id !== 'string') {
      throw new ForbiddenException('Token missing event_id');
    }

    // ops_admin không cần team scope
    if (u.role === 'ops_admin') {
      return true;
    }

    if (
      typeof u.role === 'string' &&
      (TeamScopeGuard.SCOPED_ROLES as ReadonlyArray<string>).includes(u.role)
    ) {
      if (!u.team_id || typeof u.team_id !== 'string') {
        throw new ForbiddenException(`Role ${u.role} requires team_id in token`);
      }
    }

    return true;
  }
}
