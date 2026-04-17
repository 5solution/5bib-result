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
import { isOpsAuthenticated } from '../utils/is-ops-authenticated.util';

/**
 * Role gate. Phải đặt SAU `JwtAuthGuard` trong `@UseGuards(...)`.
 *
 * - Đọc `@OpsRoles(...)` metadata.
 * - Kiểm `req.user` là authenticated ops context (qua `isOpsAuthenticated`)
 *   và `req.user.role ∈ roles`.
 * - Token không có `token_type ∈ OPS_TOKEN_TYPES` → 403 (isolation).
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

    if (!isOpsAuthenticated(user)) {
      throw new ForbiddenException('Not an ops token');
    }

    if (!isOpsRole(user.role) || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Role ${String(user.role)} not allowed. Required: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
