import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LogtoAdminGuard } from '../../logto-auth/logto-admin.guard';
import type { AuthenticatedRequest } from '../../logto-auth/types';
import { RaceAthleteLookupService } from '../services/race-athlete-lookup.service';
import { RaceAthleteAdminDto } from '../dto/race-athlete-admin.dto';
import {
  ListAthletesQueryDto,
  ListAthletesResponseDto,
} from '../dto/list-athletes.dto';
import { RaceAthleteStatsDto } from '../dto/stats.dto';
import {
  SyncLogDto,
  SyncLogListDto,
  TriggerSyncRequestDto,
  TriggerSyncResponseDto,
} from '../dto/sync.dto';
import { RaceMasterSyncLogDocument } from '../schemas/race-master-sync-log.schema';

/**
 * Admin endpoints for race master data overview + manual sync trigger.
 *
 * All endpoints scoped by `:raceId` URL param. Guard `LogtoAdminGuard`
 * enforces JWT — same pattern as chip-verification admin controller.
 *
 * Path: `/admin/races/:raceId/master-data/...` for consistency với
 * existing admin URL structure.
 */
@ApiTags('race-master-data (admin)')
@ApiBearerAuth()
@Controller('admin/races/:raceId/master-data')
@UseGuards(LogtoAdminGuard)
export class RaceMasterDataAdminController {
  private readonly logger = new Logger(RaceMasterDataAdminController.name);

  constructor(
    private readonly lookupService: RaceAthleteLookupService,
  ) {}

  // ─────────── ATHLETES ───────────

  @Get('athletes')
  @ApiOperation({
    summary: 'List athletes (paginated, with PII for admin)',
  })
  @ApiResponse({ status: 200, type: ListAthletesResponseDto })
  async listAthletes(
    @Param('raceId', ParseIntPipe) raceId: number,
    @Query() query: ListAthletesQueryDto,
  ): Promise<ListAthletesResponseDto> {
    return this.lookupService.list(raceId, query);
  }

  @Get('athletes/:bibNumber')
  @ApiOperation({
    summary: 'Get one athlete by bib (admin view with PII)',
  })
  @ApiResponse({ status: 200, type: RaceAthleteAdminDto })
  @ApiResponse({ status: 404, description: 'Athlete not found' })
  async getAthlete(
    @Param('raceId', ParseIntPipe) raceId: number,
    @Param('bibNumber') bibNumber: string,
  ): Promise<RaceAthleteAdminDto> {
    const athlete = await this.lookupService.lookupByBibAdmin(raceId, bibNumber);
    if (!athlete) {
      throw new NotFoundException(`Athlete with bib=${bibNumber} not found`);
    }
    return athlete;
  }

  // ─────────── STATS ───────────

  @Get('stats')
  @ApiOperation({ summary: 'Athlete stats per race (cached 60s)' })
  @ApiResponse({ status: 200, type: RaceAthleteStatsDto })
  async stats(
    @Param('raceId', ParseIntPipe) raceId: number,
  ): Promise<RaceAthleteStatsDto> {
    return this.lookupService.getStats(raceId);
  }

  // ─────────── SYNC TRIGGER ───────────

  @Post('sync')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Manual trigger full or delta sync',
    description:
      'syncType=ATHLETE_FULL re-pulls toàn bộ athletes của race. ATHLETE_DELTA chỉ pull rows có `modified_on > last checkpoint`. Idempotent — nhiều admin click cùng lúc đều OK (sync-lock).',
  })
  @ApiResponse({ status: 200, type: TriggerSyncResponseDto })
  @ApiResponse({
    status: 409,
    description: 'Sync đang chạy cho race này — wait & retry',
  })
  async triggerSync(
    @Param('raceId', ParseIntPipe) raceId: number,
    @Body() body: TriggerSyncRequestDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<TriggerSyncResponseDto> {
    const userId = req.user?.sub ?? 'unknown';
    const log = await this.lookupService.triggerSync(raceId, {
      syncType: body.syncType ?? 'ATHLETE_FULL',
      triggeredBy: `admin:${userId}`,
    });
    return { log: this.toSyncLogDto(log) };
  }

  // ─────────── SYNC LOGS ───────────

  @Get('sync-logs')
  @ApiOperation({ summary: 'Recent sync log entries (immutable audit)' })
  @ApiResponse({ status: 200, type: SyncLogListDto })
  async syncLogs(
    @Param('raceId', ParseIntPipe) raceId: number,
    @Query('limit') limit?: string,
  ): Promise<SyncLogListDto> {
    const cap = limit ? Number.parseInt(limit, 10) : 50;
    if (Number.isNaN(cap)) {
      throw new BadRequestException('limit must be integer');
    }
    const logs = await this.lookupService.listSyncLogs(raceId, cap);
    return {
      items: logs.map((l) => this.toSyncLogDto(l)),
      total: logs.length,
    };
  }

  private toSyncLogDto(l: RaceMasterSyncLogDocument): SyncLogDto {
    return {
      id: l._id.toString(),
      mysql_race_id: l.mysql_race_id,
      sync_type: l.sync_type,
      status: l.status,
      started_at: l.started_at,
      completed_at: l.completed_at,
      rows_fetched: l.rows_fetched,
      rows_inserted: l.rows_inserted,
      rows_updated: l.rows_updated,
      rows_skipped: l.rows_skipped,
      duration_ms: l.duration_ms,
      error_message: l.error_message,
      triggered_by: l.triggered_by,
    };
  }
}
