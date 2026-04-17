import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { OpsUserContext } from '../types/ops-jwt-payload.type';
import { isOpsAuthenticated } from '../utils/is-ops-authenticated.util';

/**
 * Extract ops user context từ `req.user`.
 * Throw 401 nếu không có (không pass JwtAuthGuard), hoặc `token_type` không
 * thuộc `OPS_TOKEN_TYPES` (native ops hoặc admin-bridge).
 *
 * Dùng chung `isOpsAuthenticated` với {@link OpsRoleGuard} để tránh drift.
 *
 * @example
 * @Get('my-team/overview')
 * overview(@OpsUserCtx() user: OpsUserContext) { ... }
 */
export const OpsUserCtx = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): OpsUserContext => {
    const req = ctx.switchToHttp().getRequest<Request & { user?: unknown }>();

    if (!isOpsAuthenticated(req.user)) {
      throw new UnauthorizedException('Not an ops token');
    }

    return req.user;
  },
);
