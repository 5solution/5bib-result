import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
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
import {
  CreateTimingAlertConfigDto,
  TimingAlertConfigResponseDto,
} from '../dto/create-config.dto';

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
  constructor(private readonly configService: TimingAlertConfigService) {}

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
    @Param('raceId', ParseIntPipe) raceId: number,
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
    @Param('raceId', ParseIntPipe) raceId: number,
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
    @Param('raceId', ParseIntPipe) raceId: number,
  ): Promise<TimingAlertConfigResponseDto> {
    const config = await this.configService.getByRaceId(raceId);
    if (!config) {
      throw new NotFoundException(
        `Timing alert config not found for race=${raceId}`,
      );
    }
    return config;
  }
}
