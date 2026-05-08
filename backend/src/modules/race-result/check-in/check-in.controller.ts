import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Sse,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { LogtoAdminGuard } from '../../logto-auth/logto-admin.guard';
import { CheckInService } from './check-in.service';
import { CheckInSseService } from './check-in-sse.service';
import {
  CmndLookupRequestDto,
  ConfirmRequestDto,
  ConfirmResponseDto,
  LookupRequestDto,
  LookupResponseDto,
} from './dto/check-in.dto';
import { CheckInStatsResponseDto } from './dto/check-in-stats.dto';

/**
 * F-015 — Check-In Kiosk admin endpoints. ALL routes require BTC admin auth
 * (LogtoAdminGuard). NO public token-gated routes here — chip-verification
 * module owns that domain (BR-CK-20 boundary).
 *
 * Endpoint surface (7 total):
 *   POST  /api/race-results/:raceId/lookup-by-bib
 *   POST  /api/race-results/:raceId/lookup-by-cmnd
 *   POST  /api/race-results/:raceId/lookup-by-qr
 *   POST  /api/race-results/:raceId/:bib/check-in
 *   GET   /api/race-results/:raceId/check-in/stream  (SSE)
 *   GET   /api/race-results/:raceId/check-in/stats
 *
 * BR-CK-10 PII guard at controller boundary: incoming `value` is the user-
 * typed query (BIB / CMND-last-4 / QR text). We NEVER `console.log` or call
 * `Logger.log` with this payload — controller passes it through to service
 * without echoing.
 */
@ApiTags('Race Results · Check-In Kiosk')
@ApiBearerAuth()
@UseGuards(LogtoAdminGuard)
@Controller('race-results')
export class CheckInController {
  constructor(
    private readonly service: CheckInService,
    private readonly sse: CheckInSseService,
  ) {}

  private actorOf(req: Request): { userId: string | null } {
    // LogtoAdminGuard attaches `req.user` shape — be defensive across versions.
    const u = (req as Request & { user?: { sub?: string; userId?: string } }).user;
    return { userId: u?.sub ?? u?.userId ?? null };
  }

  @Post(':raceId/lookup-by-bib')
  @ApiOperation({ summary: 'Lookup athlete by BIB (admin auth required)' })
  @ApiResponse({ status: 200, type: LookupResponseDto })
  async lookupByBib(
    @Param('raceId') raceId: string,
    @Body() body: LookupRequestDto,
  ): Promise<LookupResponseDto> {
    // No logging of body.value (BR-CK-10 — even though BIB is not PII, keep
    // controller silent for consistency).
    const data = await this.service.lookupByBib(raceId, body.value);
    return { success: data !== null, data };
  }

  @Post(':raceId/lookup-by-cmnd')
  @ApiOperation({
    summary: 'Lookup athlete by CMND last-4 (admin auth required)',
    description:
      'BR-CK-10 PII boundary: accepts EXACTLY 4 digits. Backend NEVER logs ' +
      'the typed value. Returns up to 5 candidates; >5 throws 503.',
  })
  @ApiResponse({ status: 200, type: LookupResponseDto })
  async lookupByCmnd(
    @Param('raceId') raceId: string,
    @Body() body: CmndLookupRequestDto,
  ): Promise<LookupResponseDto> {
    // CMND value MUST NOT be logged here — service implementation also
    // refrains from logging.
    const candidates = await this.service.lookupByCmndLastFour(raceId, body.value);
    if (candidates.length === 0) {
      return { success: false, data: null };
    }
    return { success: true, data: candidates };
  }

  @Post(':raceId/lookup-by-qr')
  @ApiOperation({ summary: 'Lookup athlete by QR scanned payload (admin auth required)' })
  @ApiResponse({ status: 200, type: LookupResponseDto })
  async lookupByQr(
    @Param('raceId') raceId: string,
    @Body() body: LookupRequestDto,
  ): Promise<LookupResponseDto> {
    const data = await this.service.lookupByQr(raceId, body.value);
    return { success: data !== null, data };
  }

  @Post(':raceId/:bib/check-in')
  @ApiOperation({
    summary: 'Atomic confirm pickup (BR-CK-04 first-wins)',
    description:
      'Redis SETNX lock + Mongo findOneAndUpdate({racekit_received:false}, ...). ' +
      'Returns 409 on conflict. Inserts check_in_logs audit. Broadcasts SSE.',
  })
  @ApiResponse({ status: 200, type: ConfirmResponseDto })
  @ApiResponse({ status: 409, description: 'Already picked up at another station OR Redis lock held' })
  async confirmPickup(
    @Param('raceId') raceId: string,
    @Param('bib') bib: string,
    @Body() body: ConfirmRequestDto,
    @Req() req: Request,
  ): Promise<ConfirmResponseDto> {
    const actor = this.actorOf(req);
    const data = await this.service.confirmPickup(raceId, bib, body, actor);
    return { success: true, data };
  }

  @Get(':raceId/check-in/stats')
  @ApiOperation({ summary: 'Aggregate per-station + global pickup stats (60s cache)' })
  @ApiResponse({ status: 200, type: CheckInStatsResponseDto })
  async getStats(@Param('raceId') raceId: string): Promise<CheckInStatsResponseDto> {
    const data = await this.service.getStats(raceId);
    return { success: true, data };
  }

  @Sse(':raceId/check-in/stream')
  @ApiOperation({
    summary: 'SSE realtime check-in stream',
    description:
      'EventSource pushes pickup events when athletes are checked in. ' +
      'Heartbeat every 25s prevents proxy idle timeout drop.',
  })
  stream(
    @Param('raceId') raceId: string,
  ): Observable<{ type: string; data: string; id: string }> {
    return this.sse.subscribe(raceId);
  }
}
