import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { getClientIp } from '../../../common/utils/client-ip.util';

/**
 * ThrottlerGuard override that extracts the real client IP from
 * `X-Forwarded-For` / `X-Real-IP` headers instead of `req.ip`.
 *
 * Required because requests arrive through the Next.js proxy
 * (frontend / admin), which means `req.ip` always resolves to the
 * container IP of that proxy — not the end-user's IP.  Using this
 * guard ensures rate limits are enforced per real user, not per proxy.
 *
 * The Next.js proxy routes forward the original `x-forwarded-for` header
 * that nginx injected, so the first hop in that header is the real client IP.
 */
@Injectable()
export class RealIpThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    return getClientIp(req);
  }
}
