import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { CourseDataOpsService } from './services/course-data-ops.service';
import { ResolveClaimDto } from './dto/resolve-claim.dto';
import { EditResultDto, ResolveClaimV2Dto } from './dto/edit-result.dto';
import {
  ClearApiUrlDto,
  ClearApiUrlResponseDto,
  CourseDataStatsResponseDto,
  DisableAndResetDto,
  DisableAndResetResponseDto,
  ResetDataDto,
  ResetDataResponseDto,
} from './dto/course-data-ops.dto';
import { LogtoAdminGuard } from '../logto-auth';
import { RaceResultService } from '../race-result/services/race-result.service';

@ApiTags('Admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(LogtoAdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly raceResultService: RaceResultService,
    // F-068: 4 course data ops endpoints delegate here (data-stats GET +
    // clear-api-url PATCH + disable-and-reset POST + reset-data POST EXTEND).
    private readonly courseDataOps: CourseDataOpsService,
  ) {}

  @Get('sync-logs')
  @ApiOperation({ summary: 'Get paginated sync logs' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default 1)' })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, description: 'Page size (default 20)' })
  @ApiResponse({ status: 200, description: 'Returns paginated sync logs' })
  async getSyncLogs(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.adminService.getSyncLogs(
      Number(page) || 1,
      Number(pageSize) || 20,
    );
  }

  @Post('races/:raceId/courses/:courseId/force-sync')
  @ApiOperation({ summary: 'Force-sync results for a specific course' })
  @ApiParam({ name: 'raceId', type: 'string' })
  @ApiParam({ name: 'courseId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Sync completed' })
  @ApiResponse({ status: 404, description: 'Race or course not found' })
  async forceSync(
    @Param('raceId') raceId: string,
    @Param('courseId') courseId: string,
  ) {
    return this.adminService.forceSync(raceId, courseId);
  }

  @Post('races/:raceId/courses/:courseId/reset-data')
  @ApiOperation({
    summary: 'Delete all results for a course (F-068: EXTEND response shape)',
    description:
      'F-068 BR-68-09: response shape EXTEND with `nextCronAt`, `hasApiUrl`, ' +
      '`durationMs`. Backward compat — original fields preserved. ' +
      'BR-68-13: race=live requires `confirmedLive: true` else 409. ' +
      'Danny chốt H: Redis SETNX lock (concurrent reset → 1 winner, others 409).',
  })
  @ApiParam({ name: 'raceId', type: 'string' })
  @ApiParam({ name: 'courseId', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Data reset completed',
    type: ResetDataResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Race or course not found' })
  @ApiResponse({
    status: 409,
    description: 'Race is live without confirmedLive OR concurrent reset in progress',
  })
  async resetData(
    @Param('raceId') raceId: string,
    @Param('courseId') courseId: string,
    @Body() dto: ResetDataDto = {},
  ): Promise<ResetDataResponseDto> {
    return this.courseDataOps.resetData(raceId, courseId, dto);
  }

  // ─── F-068 NEW endpoints ──────────────────────────────────────

  @Get('races/:raceId/courses/:courseId/data-stats')
  @ApiOperation({
    summary: 'F-068: Get course data stats (row count + sync status + cron + apiUrl)',
    description:
      'BR-68-01..06: real-time `rowCount` via countDocuments + latest sync_log ' +
      '+ cronStatus (scheduled/in_progress/disabled) + nextCronAt. ' +
      'BR-68-12: cached 5s in Redis to bound multi-admin polling cost.',
  })
  @ApiParam({ name: 'raceId', type: 'string' })
  @ApiParam({ name: 'courseId', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Returns course data stats',
    type: CourseDataStatsResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Race or course not found' })
  async getCourseDataStats(
    @Param('raceId') raceId: string,
    @Param('courseId') courseId: string,
  ): Promise<CourseDataStatsResponseDto> {
    return this.courseDataOps.getStats(raceId, courseId);
  }

  @Patch('races/:raceId/courses/:courseId/clear-api-url')
  @ApiOperation({
    summary: 'F-068: Tắt auto-sync (clear course.apiUrl) with audit log',
    description:
      'BR-68-07: explicit semantic, dedicated audit action `course.apiUrl.cleared`. ' +
      'BR-68-13: race=live requires `confirmedLive: true` else 409. ' +
      'Does NOT delete row data — that is `/disable-and-reset`.',
  })
  @ApiParam({ name: 'raceId', type: 'string' })
  @ApiParam({ name: 'courseId', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'apiUrl cleared',
    type: ClearApiUrlResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Race or course not found' })
  @ApiResponse({
    status: 409,
    description: 'Race is live without confirmedLive',
  })
  async clearCourseApiUrl(
    @Param('raceId') raceId: string,
    @Param('courseId') courseId: string,
    @Body() dto: ClearApiUrlDto = {},
  ): Promise<ClearApiUrlResponseDto> {
    return this.courseDataOps.clearApiUrl(raceId, courseId, dto);
  }

  @Post('races/:raceId/courses/:courseId/disable-and-reset')
  @ApiOperation({
    summary: 'F-068: Atomic combo — clear apiUrl + wait cron + delete rows',
    description:
      'BR-68-08 atomic order: clear apiUrl FIRST so cron does not re-fetch ' +
      'mid-delete, then wait `RaceSyncCron.isCurrentlySync()` poll (200ms × 5s ' +
      'timeout — log warn + continue), then deleteResultsByCourse, then audit. ' +
      'BR-68-13 live confirm + Danny chốt H lock apply.',
  })
  @ApiParam({ name: 'raceId', type: 'string' })
  @ApiParam({ name: 'courseId', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'apiUrl cleared + rows deleted',
    type: DisableAndResetResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Race or course not found' })
  @ApiResponse({
    status: 409,
    description: 'Race is live without confirmedLive OR concurrent reset',
  })
  async disableAndResetCourse(
    @Param('raceId') raceId: string,
    @Param('courseId') courseId: string,
    @Body() dto: DisableAndResetDto = {},
  ): Promise<DisableAndResetResponseDto> {
    return this.courseDataOps.disableAndReset(raceId, courseId, dto);
  }

  @Get('claims')
  @ApiOperation({ summary: 'List all claims (paginated, optional status filter)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'approved', 'rejected'] })
  @ApiResponse({ status: 200, description: 'Returns paginated claims' })
  async getClaims(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('status') status?: string,
  ) {
    return this.adminService.getClaims(
      Number(page) || 1,
      Number(pageSize) || 20,
      status,
    );
  }

  @Patch('claims/:id/resolve')
  @ApiOperation({ summary: 'Resolve or reject a claim (BR-04)' })
  @ApiParam({ name: 'id', type: 'string', description: 'Claim ID' })
  @ApiResponse({ status: 200, description: 'Claim resolved' })
  @ApiResponse({ status: 404, description: 'Claim not found' })
  @ApiResponse({ status: 409, description: 'Claim already resolved/rejected' })
  async resolveClaimV2(
    @Param('id') id: string,
    @Body() dto: ResolveClaimV2Dto,
    @Request() req: { user?: { userId?: string; sub?: string } },
  ) {
    const adminId = req.user?.userId ?? req.user?.sub;
    if (!adminId) throw new UnauthorizedException('Cannot identify admin user');
    return this.adminService.resolveClaim(id, dto.action, dto.resolutionNote, adminId);
  }

  @Patch('claims/:id')
  @ApiOperation({ summary: 'Resolve or reject a claim (legacy endpoint)' })
  @ApiParam({ name: 'id', type: 'string', description: 'Claim ID' })
  @ApiResponse({ status: 200, description: 'Claim updated' })
  @ApiResponse({ status: 404, description: 'Claim not found' })
  async resolveClaim(
    @Param('id') id: string,
    @Body() dto: ResolveClaimDto,
  ) {
    const action = dto.status === 'resolved' ? 'approved' : (dto.status as 'approved' | 'rejected');
    return this.adminService.resolveClaim(id, action, dto.adminNote ?? '', 'admin');
  }

  @Patch('race-results/:resultId')
  @ApiOperation({ summary: 'Manually edit a race result with audit trail (BR-03)' })
  @ApiParam({ name: 'resultId', type: 'string', description: 'Result document _id' })
  @ApiResponse({ status: 200, description: 'Result updated with audit log' })
  @ApiResponse({ status: 400, description: 'Validation error (missing reason etc.)' })
  @ApiResponse({ status: 404, description: 'Result not found' })
  async editResult(
    @Param('resultId') resultId: string,
    @Body() dto: EditResultDto,
    @Request() req: { user?: { userId?: string; sub?: string } },
  ) {
    const adminId = req.user?.userId ?? req.user?.sub;
    if (!adminId) throw new UnauthorizedException('Cannot identify admin user');
    const { reason, ...fields } = dto;
    return this.adminService.editResult(resultId, fields, reason, adminId);
  }

  @Post('cache/purge/:raceId/:courseId')
  @ApiOperation({
    summary: 'Purge Redis cache for a course (F-068: raceId-namespaced)',
    description:
      'F-068 BR-68-11: endpoint path changed from `/cache/purge/:courseId` ' +
      'to `/cache/purge/:raceId/:courseId` because cache keys are raceId-namespaced. ' +
      'Old endpoint pattern matched 0 keys (Manager catch 2026-05-31).',
  })
  @ApiParam({ name: 'raceId', type: 'string' })
  @ApiParam({ name: 'courseId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Cache purged' })
  async purgeCache(
    @Param('raceId') raceId: string,
    @Param('courseId') courseId: string,
  ) {
    return this.adminService.purgeCache(raceId, courseId);
  }

  @Get('race-results/athlete/:raceId/:bib')
  @ApiOperation({ summary: 'Get full athlete detail including _id and editHistory (admin only)' })
  @ApiParam({ name: 'raceId', type: 'string', description: 'Race ID' })
  @ApiParam({ name: 'bib', type: 'string', description: 'Bib number' })
  @ApiResponse({ status: 200, description: 'Returns full athlete result detail with _id, editHistory, isManuallyEdited' })
  @ApiResponse({ status: 404, description: 'Athlete not found' })
  async getAthleteDetail(
    @Param('raceId') raceId: string,
    @Param('bib') bib: string,
  ) {
    const result = await this.raceResultService.getAthleteDetail(raceId, bib);
    if (!result) {
      return { data: null, success: false, message: 'Athlete not found' };
    }
    return { data: result, success: true };
  }

  @Post('test-otp-email')
  @ApiOperation({ summary: 'Send a test OTP email (dev/staging only)' })
  @ApiResponse({ status: 201, description: 'Test email sent' })
  async testOtpEmail(@Body('email') email: string) {
    return this.adminService.sendTestOtpEmail(email);
  }
}
