import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { LogtoAdminGuard } from '../logto-auth';
import { AnalyticsSummaryDto } from './dto/analytics-summary.dto';
import { TrackClickDto } from './dto/track-click.dto';
import { TrackViewDto } from './dto/track-view.dto';
import { PromoHubAnalyticsService } from './promo-hub-analytics.service';

/**
 * FEATURE-027 — Promo Hub Analytics controller.
 *
 * Public endpoints (no auth, ThrottlerGuard rate-limited):
 *   - POST /api/promo-hub-analytics/track-click — record click event
 *   - POST /api/promo-hub-analytics/track-view  — record view event (RL'd per-IP)
 *
 * Admin endpoint (LogtoAdminGuard):
 *   - GET  /api/promo-hub-analytics/:hubId/summary — aggregated summary
 *
 * IP extraction: server reads from `Request` (handles `X-Forwarded-For`
 * via Express trust-proxy config — relies on existing nginx forwarding).
 * Client cannot spoof IP via DTO field.
 */
@ApiTags('Promo Hub Analytics')
@Controller('promo-hub-analytics')
export class PromoHubAnalyticsController {
  constructor(private readonly analyticsService: PromoHubAnalyticsService) {}

  @Post('track-click')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Public — track click event on a hub CTA/link',
    description:
      'No auth required. Throttle 60 req/min/IP. IP hashed SHA-256 server-side, never raw stored. No rate limit per-IP-per-click (BR-PH-10) — multiple clicks per page expected.',
  })
  @ApiResponse({ status: 200, schema: { example: { success: true } } })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async trackClick(
    @Body() dto: TrackClickDto,
    @Req() req: Request,
  ): Promise<{ success: true }> {
    const ip = this.extractIp(req);
    const userAgent = req.headers['user-agent'];
    const referer = req.headers.referer;
    return this.analyticsService.trackClick(
      dto,
      ip,
      typeof userAgent === 'string' ? userAgent : undefined,
      typeof referer === 'string' ? referer : undefined,
    );
  }

  @Post('track-view')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Public — track page view of a published hub',
    description:
      'No auth. Server-side rate-limit: 1 view per IP per slug per 5 minutes (BR-PH-09). Excess calls return `recorded: false` silently. Throttle 30 req/min/IP additionally.',
  })
  @ApiResponse({ status: 200, schema: { example: { recorded: true } } })
  async trackView(
    @Body() dto: TrackViewDto,
    @Req() req: Request,
  ): Promise<{ recorded: boolean }> {
    const ip = this.extractIp(req);
    const userAgent = req.headers['user-agent'];
    const referer = req.headers.referer;
    return this.analyticsService.trackView(
      dto,
      ip,
      typeof userAgent === 'string' ? userAgent : undefined,
      typeof referer === 'string' ? referer : undefined,
    );
  }

  @Get(':hubId/summary')
  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Admin — aggregated analytics summary for a hub (last 30 days)',
  })
  @ApiParam({ name: 'hubId', type: String })
  @ApiResponse({ status: 200, type: AnalyticsSummaryDto })
  @ApiResponse({ status: 400, description: 'Invalid hubId format' })
  async getSummary(@Param('hubId') hubId: string): Promise<AnalyticsSummaryDto> {
    return this.analyticsService.getSummary(hubId);
  }

  /**
   * Extract client IP from request. Prefers `X-Forwarded-For` first
   * entry (left-most = original client). Falls back to `req.ip` set by
   * Express trust-proxy. Never trusts client-supplied DTO field.
   */
  private extractIp(req: Request): string {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.length > 0) {
      const first = xff.split(',')[0]?.trim();
      if (first) return first;
    }
    if (Array.isArray(xff) && xff.length > 0) {
      return xff[0];
    }
    return req.ip ?? '0.0.0.0';
  }
}
