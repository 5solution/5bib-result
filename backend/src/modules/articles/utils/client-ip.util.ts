import type { Request } from 'express';

/**
 * Extract real client IP from a request, respecting reverse-proxy headers.
 * Order of trust: `X-Forwarded-For` (first hop) → `X-Real-IP` → `req.ip` →
 * connection remote address. Returns 'unknown' if all fail (still usable as
 * a Redis key — just dedups all anonymous-source traffic together).
 *
 * NOTE: We don't enable Express `trust proxy` globally because it would
 * affect every module's `req.ip`. Reading the header directly here is
 * scoped to articles' rate-limit logic only.
 */
export function getClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }
  if (Array.isArray(xff) && xff.length > 0) {
    return xff[0].split(',')[0].trim();
  }
  const xri = req.headers['x-real-ip'];
  if (typeof xri === 'string' && xri.length > 0) return xri.trim();

  return req.ip || req.socket?.remoteAddress || 'unknown';
}
