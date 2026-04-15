import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { OPS_ROLES_KEY } from '../decorators/ops-roles.decorator';
import { OpsRole, isOpsRole } from '../types/ops-role.type';

/**
 * Role gate. Phải đặt SAU `JwtAuthGuard` trong `@UseGuards(...)`.
 *
 * - Đọc `@OpsRoles(...)` metadata.
 * - Kiểm `req.user.token_type === 'ops'` và `req.user.role ∈ roles`.
 * - Admin token (không có `token_type='ops'`) → 403 (isolation).
 */
@Injectable()
export class OpsRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<OpsRole[] | undefined>(
      OPS_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Nếu không khai @OpsRoles() → guard pass (chỉ cần JwtAuthGuard bảo vệ)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request & { user?: unknown }>();
    const user = req.user;

    if (!user || typeof user !== 'object') {
      throw new UnauthorizedException('Missing auth');
    }

    const u = user as { token_type?: unknown; role?: unknown };

    if (u.token_type !== 'ops') {
      throw new ForbiddenException('Not an ops token');
    }

    if (!isOpsRole(u.role) || !requiredRoles.includes(u.role)) {
      throw new ForbiddenException(
        `Role ${String(u.role)} not allowed. Required: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
