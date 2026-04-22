import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { LogtoUser } from './types';

/**
 * Extract the authenticated Logto user from request.
 * Requires LogtoAuthGuard (or LogtoAdminGuard) to have populated req.logto.
 *
 * @example
 * ```ts
 * @UseGuards(LogtoAuthGuard)
 * @Get('me')
 * getMe(@CurrentUser() user: LogtoUser) { return user; }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): LogtoUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.logto;
  },
);
