import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ChipVerifyTokenGuard } from './guards/chip-verify-token.guard';
import { ChipThrottlerGuard } from './guards/chip-throttler.guard';
import { ChipLookupService } from './services/chip-lookup.service';
import { ChipStatsService } from './services/chip-stats.service';
import {
  ChipLookupQueryDto,
  ChipLookupResponseDto,
  ChipRecentResponseDto,
  ChipStatsResponseDto,
} from './dto/chip-lookup.dto';

interface RequestWithChipScope extends Request {
  chipVerifyRaceId?: number;
}

/**
 * PUBLIC kiosk endpoints. Token-based auth (NO login).
 * BR-03: NEVER return PII (DTO has strict allowlist).
 * BR-10 + Token URL leak risk: response headers Cache-Control: no-store +
 *        Referrer-Policy: no-referrer + X-Robots-Tag: noindex.
 */
@ApiTags('chip-verification (public kiosk)')
@Controller('chip-verify')
export class ChipVerificationPublicController {
  constructor(
    private readonly lookupService: ChipLookupService,
    private readonly statsService: ChipStatsService,
  ) {}

  @Get(':token/lookup')
  @UseGuards(ChipVerifyTokenGuard, ChipThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Lookup chip → BIB → athlete (RFID kiosk)' })
  @ApiResponse({ status: 200, type: ChipLookupResponseDto })
  async lookup(
    @Param('token') _token: string,
    @Query() query: ChipLookupQueryDto,
    @Req() req: RequestWithChipScope,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ChipLookupResponseDto> {
    this.applySecurityHeaders(res);
    const raceId = req.chipVerifyRaceId!;
    const ip = req.ip ?? req.socket?.remoteAddress ?? '';
    return this.lookupService.lookup(raceId, query.chip_id, query.device, ip);
  }

  @Get(':token/recent')
  @UseGuards(ChipVerifyTokenGuard, ChipThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Recent N verifications (kiosk history list)' })
  @ApiResponse({ status: 200, type: ChipRecentResponseDto })
  async recent(
    @Param('token') _token: string,
    @Query('limit') limitRaw: string | undefined,
    @Req() req: RequestWithChipScope,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ChipRecentResponseDto> {
    this.applySecurityHeaders(res);
    const raceId = req.chipVerifyRaceId!;
    const limit = Math.min(50, Math.max(1, Number(limitRaw) || 20));
    return this.lookupService.recent(raceId, limit);
  }

  @Get(':token/stats')
  @UseGuards(ChipVerifyTokenGuard, ChipThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Race-level stats (lighter polling cadence)' })
  @ApiResponse({ status: 200, type: ChipStatsResponseDto })
  async stats(
    @Param('token') _token: string,
    @Req() req: RequestWithChipScope,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ChipStatsResponseDto> {
    this.applySecurityHeaders(res);
    const raceId = req.chipVerifyRaceId!;
    return this.statsService.forRace(raceId);
  }

  /** MUST-DO #7: prevent CDN/browser caching + referrer leak + crawler index. */
  private applySecurityHeaders(res: Response): void {
    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, private',
    );
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }
}
