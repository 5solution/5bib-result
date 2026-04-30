import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

/**
 * MUST-DO #9: throttle key = `${token}_${ip}`.
 * Pure-IP tracker is bypassed via X-Forwarded-For rotation; pure-token tracker
 * is bypassed by single-attacker-many-IPs. Combined gives both walls:
 * 60 req/min/IP/token.
 */
@Injectable()
export class ChipThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    const token = String(
      (req as Request & { params?: { token?: string } }).params?.token ?? '',
    );
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    return `chip:${token}:${ip}`;
  }
}
