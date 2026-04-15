import { Request } from 'express';

/**
 * Request shape after JwtStrategy.validate() attaches the admin user.
 * Used by controllers with @UseGuards(JwtAuthGuard) or
 * @UseGuards(OptionalJwtAuthGuard) to avoid `(req as any).user` casts.
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    sub: string;
    email: string;
    role: string;
  };
}
