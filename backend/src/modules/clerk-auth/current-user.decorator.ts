import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { ClerkUser } from './types';

/**
 * Lấy Clerk user từ request (đã được ClerkAuthGuard attach vào req.clerk).
 *
 * @example
 * ```ts
 * @UseGuards(ClerkAuthGuard)
 * @Get('me')
 * getMe(@CurrentUser() user: ClerkUser) { return user; }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): ClerkUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.clerk;
  },
);
