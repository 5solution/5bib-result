import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { OpsUserContext } from '../types/ops-jwt-payload.type';

/**
 * Extract ops user context từ `req.user`.
 * Throw 401 nếu không có (không pass JwtAuthGuard), hoặc không phải ops token.
 *
 * @example
 * @Get('my-team/overview')
 * overview(@OpsUserCtx() user: OpsUserContext) { ... }
 */
export const OpsUserCtx = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): OpsUserContext => {
    const req = ctx.switchToHttp().getRequest<Request & { user?: unknown }>();
    const user = req.user;

    if (
      !user ||
      typeof user !== 'object' ||
      (user as { token_type?: unknown }).token_type !== 'ops'
    ) {
      throw new UnauthorizedException('Not an ops token');
    }

    return user as OpsUserContext;
  },
);
