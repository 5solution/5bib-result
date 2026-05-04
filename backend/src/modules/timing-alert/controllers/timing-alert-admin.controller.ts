import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
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
import { TimingAlertConfigService } from '../services/timing-alert-config.service';
import { TimingAlertPollService } from '../services/timing-alert-poll.service';
import { CheckpointDiscoveryService } from '../services/checkpoint-discovery.service';
import { DashboardSnapshotService } from '../services/dashboard-snapshot.service';
import { PodiumService } from '../services/podium.service';
import {
  CreateTimingAlertConfigDto,
  TimingAlertConfigResponseDto,
} from '../dto/create-config.dto';
import { AlertActionDto, ListAlertsQueryDto } from '../dto/alert-action.dto';
import {
  ApplyCheckpointsDto,
  ApplyCheckpointsResponseDto,
  CheckpointDiscoveryResponseDto,
} from '../dto/checkpoint-discovery.dto';
import { DashboardSnapshotResponseDto } from '../dto/dashboard-snapshot.dto';
import { PodiumResponseDto } from '../dto/podium.dto';

/**
 * Admin REST API cho Timing Miss Alert config.
 *
 * Phase 1A scope: chỉ config CRUD. Polling, alert list, force-poll, SSE
 * stream sẽ implement Phase 1B/1C/2.
 *
 * **Security:**
 * - All endpoints behind `LogtoAdminGuard` — Logto JWT bắt buộc.
 * - `triggered_by` / `enabled_by_user_id` luôn lấy từ JWT `req.user.sub`,
 *   KHÔNG từ body (chống spoof audit).
 * - Response NEVER trả plaintext API key — masked qua `ApiKeyCrypto.mask()`.
 */
@ApiTags('Timing Alert (Admin)')
@ApiBearerAuth()
@UseGuards(LogtoAdminGuard)
@Controller('admin/races/:raceId/timing-alert')
export class TimingAlertAdminController {
  constructor(
    private readonly configService: TimingAlertConfigService,
    private readonly pollService: TimingAlertPollService,
    private readonly discoveryService: CheckpointDiscoveryService,
    private readonly snapshotService: DashboardSnapshotService,
    private readonly podiumService: PodiumService,
  ) {}

  @Post('config')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Create or update timing alert config (upsert per race)',
    description:
      'Encrypts mọi RR API key bằng AES-256-GCM trước khi save. Validate course_checkpoints PHẢI có "Finish" cuối + distance_km strictly increasing. Response trả masked API keys (KHÔNG plaintext).',
  })
  @ApiResponse({ status: 200, type: TimingAlertConfigResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Logto JWT invalid' })
  async upsertConfig(
    @Param('raceId') raceId: string,
    @Body() dto: CreateTimingAlertConfigDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<TimingAlertConfigResponseDto> {
    const userId = req.user?.sub ?? 'unknown';
    return this.configService.upsert(raceId, dto, `admin:${userId}`);
  }

  @Put('config')
  @HttpCode(200)
  @ApiOperation({ summary: 'Alias of POST config — same upsert semantics' })
  @ApiResponse({ status: 200, type: TimingAlertConfigResponseDto })
  async updateConfig(
    @Param('raceId') raceId: string,
    @Body() dto: CreateTimingAlertConfigDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<TimingAlertConfigResponseDto> {
    return this.upsertConfig(raceId, dto, req);
  }

  @Get('config')
  @ApiOperation({
    summary: 'Read timing alert config — API keys MASKED',
    description:
      'Trả masked API key preview (4-prefix + 4-suffix + length), KHÔNG plaintext. Caller PHẢI re-input plaintext nếu muốn rotate key.',
  })
  @ApiResponse({ status: 200, type: TimingAlertConfigResponseDto })
  @ApiResponse({ status: 404, description: 'Config not found for this race' })
  async getConfig(
    @Param('raceId') raceId: string,
  ): Promise<TimingAlertConfigResponseDto> {
    const config = await this.configService.getByRaceId(raceId);
    if (!config) {
      throw new NotFoundException(
        `Timing alert config not found for race=${raceId}`,
      );
    }
    return config;
  }

  // ─────────── Phase 1B — alerts + poll ───────────

  @Post('poll')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Force trigger 1 poll cycle (debug + emergency)',
    description: 'Bypass cron timer. Vẫn respect lock per (race, course) → KHÔNG concurrent với cron tick.',
  })
  async forcePoll(
    @Param('raceId') raceId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.sub ?? 'unknown';
    return this.pollService.pollRace(raceId, `admin-force:${userId}`);
  }

  @Get('alerts')
  @ApiOperation({ summary: 'List alerts với filter + stats' })
  async listAlerts(
    @Param('raceId') raceId: string,
    @Query() query: ListAlertsQueryDto,
  ) {
    return this.pollService.listAlerts(raceId, {
      severity: query.severity,
      status: query.status,
      course: query.course,
      page: query.page ? Number(query.page) : 1,
      pageSize: query.pageSize ? Number(query.pageSize) : 50,
    });
  }

  @Get('alerts/:alertId')
  @ApiOperation({
    summary: 'Get full alert detail — audit log + trajectory + current state',
    description:
      'Trả về alert + course checkpoints + per-checkpoint trajectory (passed/missing/pending) + chiptimes hiện tại từ race_results vs frozen snapshot lúc fire alert.',
  })
  async getAlertDetail(
    @Param('raceId') raceId: string,
    @Param('alertId') alertId: string,
  ) {
    return this.pollService.getAlertDetail(raceId, alertId);
  }

  @Patch('alerts/:alertId')
  @ApiOperation({
    summary: 'Resolve / mark false alarm / reopen alert',
    description:
      'Idempotent state transitions. Audit log auto-append với userId. ' +
      'IDOR fix: filter compound (_id, race_id) — admin Race A KHÔNG patch được alert Race B.',
  })
  async patchAlert(
    @Param('raceId') raceId: string,
    @Param('alertId') alertId: string,
    @Body() body: AlertActionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.sub ?? 'unknown';
    return this.pollService.resolveAlert(
      alertId,
      body.action,
      body.note,
      userId,
      raceId,
    );
  }

  @Get('poll-logs')
  @ApiOperation({ summary: 'Recent poll log entries (90d TTL)' })
  async pollLogs(
    @Param('raceId') raceId: string,
    @Query('limit') limit?: string,
  ) {
    return this.pollService.listPollLogs(
      raceId,
      limit ? Number(limit) : 50,
    );
  }

  // ─────────── Phase 2.1 — Auto-derive checkpoints ───────────

  @Post('discover-checkpoints/:courseId')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Auto-derive checkpoints từ RR API (preview, không save)',
    description:
      'Quét tất cả athletes của course → suy ra timing point keys + order chronological + distance proportional. BTC review preview rồi gọi /apply-checkpoints để save.',
  })
  @ApiResponse({ status: 200, type: CheckpointDiscoveryResponseDto })
  @ApiResponse({ status: 400, description: 'Course thiếu apiUrl' })
  @ApiResponse({ status: 404, description: 'Race hoặc course không tồn tại' })
  async discoverCheckpoints(
    @Param('raceId') raceId: string,
    @Param('courseId') courseId: string,
  ): Promise<CheckpointDiscoveryResponseDto> {
    return this.discoveryService.discover(raceId, courseId);
  }

  @Post('apply-checkpoints/:courseId')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Save checkpoints array vào race document',
    description:
      'BTC sau khi review preview có thể override name + distanceKm. Service ghi vào race.courses[].checkpoints atomic.',
  })
  @ApiResponse({ status: 200, type: ApplyCheckpointsResponseDto })
  async applyCheckpoints(
    @Param('raceId') raceId: string,
    @Param('courseId') courseId: string,
    @Body() body: ApplyCheckpointsDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApplyCheckpointsResponseDto> {
    const userId = req.user?.sub ?? 'unknown';
    return this.discoveryService.apply(raceId, courseId, body.checkpoints, userId);
  }

  // ─────────── Phase 2.2 — Dashboard cockpit ───────────

  @Get('dashboard-snapshot')
  @ApiOperation({
    summary: 'Operation dashboard snapshot — race-level + per-course + checkpoint progression + recent activity',
    description:
      'Gộp 4 query thành 1 endpoint giảm round-trip cho admin tab. Cache Redis 15s. Frontend poll 30s + invalidate khi SSE event.',
  })
  @ApiResponse({ status: 200, type: DashboardSnapshotResponseDto })
  async dashboardSnapshot(
    @Param('raceId') raceId: string,
  ): Promise<DashboardSnapshotResponseDto> {
    return this.snapshotService.getSnapshot(raceId);
  }

  // ─────────── Tab Podium — Top 10 per course ───────────

  // ─────────── Reset (test loop tool) ───────────

  @Post('reset')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Reset race test data — xóa alerts + poll logs + cache (giữ config + race document)',
    description:
      'Test tool: cho BTC re-run simulator nhiều lần. Optionally xóa race_results luôn (?includeRaceResults=true). KHÔNG xóa config, race document, courses, checkpoints.',
  })
  async resetRaceData(
    @Param('raceId') raceId: string,
    @Query('includeRaceResults') includeRaceResults: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.sub ?? 'unknown';
    return this.pollService.resetRaceData(
      raceId,
      { includeRaceResults: includeRaceResults === 'true' },
      `admin:${userId}`,
    );
  }

  @Get('podium')
  @ApiOperation({
    summary: 'Top 10 per course — actual finishers + projected on-course',
    description:
      'Mỗi course trả Top 10 từ race_results đã sync (có chiptime), sort theo overallRankNumeric ASC. Khi athlete mới xuất hiện trong top → invalidate qua SSE.',
  })
  @ApiResponse({ status: 200, type: PodiumResponseDto })
  async podium(
    @Param('raceId') raceId: string,
  ): Promise<PodiumResponseDto> {
    return this.podiumService.getPodium(raceId);
  }
}
