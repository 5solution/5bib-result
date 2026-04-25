/**
 * LogtoUser — shape normalized from OIDC access token claims.
 *
 * The access token we verify is issued for API resource
 * `https://api.5bib.com` with Logto's standard role claim.
 * Controllers consume `req.user` with the legacy Clerk-compatible shape
 * { userId, sub, email, role } so existing code keeps working.
 */

export interface LogtoUser {
  /** Logto user UUID — matches legacy userId semantics. */
  userId: string;
  /** OIDC `sub` claim — same as userId. */
  sub: string;
  /** Primary email, if `email` scope granted. */
  email: string;
  /** Highest role for quick checks (admin | user). */
  role: string;
  /** All roles (if multi-role setup). */
  roles: string[];
  /** Scopes granted on this token (space-split). */
  scopes: string[];
  /** Raw `username` claim from Logto (if set). */
  username?: string;
  /** Full name composed from name claim or username. */
  name?: string;
  /** Profile picture URL. */
  picture?: string;
}

declare module 'express' {
  interface Request {
    logto?: LogtoUser;
    user?: LogtoUser;
  }
}

/**
 * Request where LogtoAuthGuard has been applied — req.user is guaranteed
 * set. Used for controllers that annotate `@Req() req: AuthenticatedRequest`.
 */
import type { Request } from 'express';
export interface AuthenticatedRequest extends Request {
  user?: LogtoUser;
}
