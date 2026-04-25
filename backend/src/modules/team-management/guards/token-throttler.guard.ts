import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Throttle keyed by `:token` URL param instead of IP.
 *
 * Why: the magic-token sign endpoints (`/team-contract/:token/sign`,
 * `/team-acceptance/:token/sign`) are hit by crew members from a single
 * shared office NAT — a few accidental form submits from one phone
 * exhausts the IP-keyed throttle and locks out everyone behind that NAT
 * for 5 minutes. Keying by token isolates the rate-limit budget to one
 * registration: a typo in someone else's signing flow can never DoS
 * yours.
 *
 * Falls back to IP if `:token` is somehow absent (defensive — every
 * route this guard is applied to has the param, but the fallback keeps
 * the route functional rather than 500-ing).
 */
@Injectable()
export class TokenThrottlerGuard extends ThrottlerGuard {
  private readonly log = new Logger(TokenThrottlerGuard.name);

  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const params = req.params as Record<string, string> | undefined;
    const url = req.url as string | undefined;
    const method = req.method as string | undefined;
    // Extract token from URL path directly — req.params may be empty
    // at guard time depending on Nest's routing pipeline. Match the
    // segment after `/team-contract/` or `/team-acceptance/` and before
    // a trailing slash or end of path.
    let token = params?.token;
    if (!token && url) {
      const m = url.match(/\/team-(?:contract|acceptance)\/([0-9a-f]{32,128})(?:[/?]|$)/);
      if (m) token = m[1];
    }
    if (token && typeof token === 'string') {
      this.log.debug(
        `[throttle] ${method} ${url} → key=token:${token.slice(0, 8)}.. (params=${JSON.stringify(params)})`,
      );
      return `token:${token}`;
    }
    const ip = await super.getTracker(req);
    this.log.debug(
      `[throttle] ${method} ${url} → FALLBACK ip=${ip} (params=${JSON.stringify(params)})`,
    );
    return ip;
  }

  /**
   * Override request extraction to ensure params are populated for the
   * tracker. NestJS calls handleRequest → getTracker; default impl
   * already passes the request, so we just forward.
   */
  protected getRequestResponse(context: ExecutionContext): {
    req: Record<string, unknown>;
    res: Record<string, unknown>;
  } {
    return super.getRequestResponse(context);
  }
}
