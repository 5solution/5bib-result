import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const raw = request.headers['x-analytics-key'];
    const key = Array.isArray(raw) ? raw[0] : raw;
    const expected = process.env.ANALYTICS_API_KEY;

    if (!expected) {
      throw new UnauthorizedException('Analytics API key not configured');
    }
    if (!key || typeof key !== 'string') {
      throw new UnauthorizedException('Missing x-analytics-key header');
    }

    const keyBuf = Buffer.from(key);
    const expBuf = Buffer.from(expected);
    // Length mismatch → still run timingSafeEqual on equal-length zero buffer to
    // avoid early-exit timing leak; then reject.
    if (keyBuf.length !== expBuf.length) {
      timingSafeEqual(Buffer.alloc(expBuf.length), expBuf);
      throw new UnauthorizedException('Invalid analytics API key');
    }
    if (!timingSafeEqual(keyBuf, expBuf)) {
      throw new UnauthorizedException('Invalid analytics API key');
    }
    return true;
  }
}
