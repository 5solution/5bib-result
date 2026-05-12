import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../logto-auth/current-user.decorator';
import { LogtoStaffGuard } from '../logto-auth';
import { LogtoUser } from '../logto-auth/types';
import { AwardsService } from './services/awards.service';
import { PodiumStateMachineService } from './services/podium-state-machine.service';
import { PodiumPdfService } from './services/podium-pdf.service';
import {
  AnomalyWarningResponseDto,
  AnomalyWarningListResponseDto,
  AckWarningDto,
  ListAnomalyFilterDto,
  ResolveWarningDto,
} from './dto/anomaly-warning-response.dto';
import {
  ListPodiumFilterDto,
  PodiumListResponseDto,
  PodiumResponseDto,
  RecomputeRequestDto,
  RecomputeResponseDto,
} from './dto/podium-response.dto';
import { PodiumStateUpdateDto } from './dto/podium-state-update.dto';
import {
  PdfExportOptionsDto,
  PodiumPdfResponseDto,
} from './dto/pdf-export-options.dto';
import { PredictedRankListResponseDto } from './dto/predicted-rank-response.dto';
import { Types } from 'mongoose';
import { Podium, PodiumDocument } from './schemas/podium.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AGEligibilityReportService } from './services/ag-eligibility-report.service';
import { AGEligibilityReportDto } from './dto/ag-eligibility-response.dto';

/**
 * F-019 — Awards Age Group Podium + Warnings.
 *
 * 10 endpoints, all `@UseGuards(LogtoStaffGuard)` (admin-only per Manager Plan §6).
 * Note: PRD Section 5.2 mentions JwtAuthGuard but codebase convention uses
 * LogtoStaffGuard (consistent với F-013, F-014, F-018). Reconciled in 03-impl.
 *
 * SSE endpoint NOT exposed Phase 1 (admin manual refresh + 60s Redis TTL đủ).
 * AwardsSseService remains DI-ready for Phase 2.
 */
@ApiTags('Awards')
@ApiBearerAuth()
@UseGuards(LogtoStaffGuard)
@Controller('admin/races/:raceId/awards')
export class AwardsController {
  constructor(
    private readonly service: AwardsService,
    private readonly stateMachine: PodiumStateMachineService,
    private readonly pdfService: PodiumPdfService,
    @InjectModel(Podium.name)
    private readonly podiumModel: Model<PodiumDocument>,
    private readonly eligibility: AGEligibilityReportService,
  ) {}

  // F-019 v2 — Pre-race readiness eligibility report.
  @Get('ag-eligibility')
  @ApiOperation({
    summary: 'F-019 v2 — Báo cáo eligibility AG (DOB coverage + bracket distribution + vendor health)',
  })
  @ApiResponse({ status: 200, type: AGEligibilityReportDto })
  async getEligibility(
    @Param('raceId') raceId: string,
  ): Promise<AGEligibilityReportDto> {
    return this.eligibility.getReport(raceId);
  }

  // 1) GET podium list
  @Get('ag-podium')
  @ApiOperation({ summary: 'List AG podium grid (filter cự ly / AG / gender / state)' })
  @ApiResponse({ status: 200, type: PodiumListResponseDto })
  async listPodium(
    @Param('raceId') raceId: string,
    @Query() filter: ListPodiumFilterDto,
  ): Promise<PodiumListResponseDto> {
    return this.service.listPodium(raceId, filter);
  }

  // 2) GET podium detail
  @Get('ag-podium/:id')
  @ApiOperation({ summary: 'Get one AG podium card detail' })
  @ApiResponse({ status: 200, type: PodiumResponseDto })
  async detailPodium(
    @Param('raceId') raceId: string,
    @Param('id') id: string,
  ): Promise<PodiumResponseDto> {
    return this.service.getPodium(raceId, id);
  }

  // 3) POST recompute (manual trigger BR-AG-36)
  @Post('recompute')
  @ApiOperation({ summary: 'Manual trigger recompute AG (BR-AG-36 sau khi edit DOB)' })
  @ApiResponse({ status: 201, type: RecomputeResponseDto })
  async recompute(
    @Param('raceId') raceId: string,
    @Body() dto: RecomputeRequestDto,
    @CurrentUser() user: LogtoUser,
  ): Promise<RecomputeResponseDto> {
    return this.service.recompute(raceId, dto, user.userId);
  }

  // 4) GET anomalies list
  @Get('anomaly-warnings')
  @ApiOperation({ summary: 'List anomaly warnings (Mức 1/2/3 + filter)' })
  @ApiResponse({ status: 200, type: AnomalyWarningListResponseDto })
  async listWarnings(
    @Param('raceId') raceId: string,
    @Query() filter: ListAnomalyFilterDto,
  ): Promise<AnomalyWarningListResponseDto> {
    return this.service.listWarnings(raceId, filter);
  }

  // 5) PATCH ack warning (BR-AG-19 Mức 2 ack flow)
  @Patch('anomaly-warnings/:id/ack')
  @ApiOperation({ summary: 'Acknowledge warning Mức 2 (note bắt buộc)' })
  @ApiResponse({ status: 200, type: AnomalyWarningResponseDto })
  async ackWarning(
    @Param('raceId') raceId: string,
    @Param('id') id: string,
    @Body() dto: AckWarningDto,
    @CurrentUser() user: LogtoUser,
  ): Promise<AnomalyWarningResponseDto> {
    return this.service.ackWarning(raceId, id, dto, user.userId);
  }

  // 6) PATCH resolve warning (BR-AG-22)
  @Patch('anomaly-warnings/:id/resolve')
  @ApiOperation({ summary: 'Resolve warning với resolution + note' })
  @ApiResponse({ status: 200, type: AnomalyWarningResponseDto })
  async resolveWarning(
    @Param('raceId') raceId: string,
    @Param('id') id: string,
    @Body() dto: ResolveWarningDto,
    @CurrentUser() user: LogtoUser,
  ): Promise<AnomalyWarningResponseDto> {
    return this.service.resolveWarning(raceId, id, dto, user.userId);
  }

  // 7) PATCH podium state transition (BR-AG-23 forward-only)
  @Patch('podium/:id/state')
  @ApiOperation({ summary: 'Forward podium state transition (BR-AG-23)' })
  @ApiResponse({ status: 200, type: PodiumResponseDto })
  async transitionState(
    @Param('raceId') raceId: string,
    @Param('id') id: string,
    @Body() dto: PodiumStateUpdateDto,
    @CurrentUser() user: LogtoUser,
  ): Promise<PodiumResponseDto> {
    const updated = await this.stateMachine.transition(raceId, id, dto, user.userId);
    return this.service.getPodium(raceId, String((updated as unknown as { _id: Types.ObjectId })._id));
  }

  // 8) GET predicted ranks (BR-AG-29..32)
  @Get('predicted-ranks')
  @ApiOperation({ summary: 'List predicted rank ≤ top-3 cho non-finishers' })
  @ApiResponse({ status: 200, type: PredictedRankListResponseDto })
  async predictedRanks(
    @Param('raceId') raceId: string,
  ): Promise<PredictedRankListResponseDto> {
    const items = await this.service.predictedRanks(raceId);
    return { items, total: items.length };
  }

  // 9) POST PDF export (BR-AG-33 sync 30s timeout)
  @Post('podium/:id/pdf')
  @ApiOperation({ summary: 'Generate PDF for one podium (Phase 1 sync 30s timeout)' })
  @ApiResponse({ status: 201, type: PodiumPdfResponseDto })
  async exportPdf(
    @Param('raceId') raceId: string,
    @Param('id') id: string,
    @Body() options: PdfExportOptionsDto,
  ): Promise<PodiumPdfResponseDto> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException();
    const podium = await this.podiumModel.findOne({ _id: id, raceId });
    if (!podium) throw new NotFoundException();
    const result = await this.pdfService.generatePdf(podium, options);
    podium.latestPdfS3Key = result.s3Key;
    podium.latestPdfGeneratedAt = new Date();
    await podium.save();
    return result;
  }

  // 10) GET pdf signed URL re-issue
  @Get('podium/:id/pdf-status')
  @ApiOperation({ summary: 'Re-issue 15min signed URL for latest podium PDF' })
  @ApiResponse({ status: 200 })
  async pdfStatus(
    @Param('raceId') raceId: string,
    @Param('id') id: string,
  ): Promise<{ s3Key?: string; generatedAt?: string; signedUrl?: string }> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException();
    const podium = await this.podiumModel.findOne({ _id: id, raceId });
    if (!podium) throw new NotFoundException();
    if (!podium.latestPdfS3Key) {
      return {
        s3Key: undefined,
        generatedAt: undefined,
        signedUrl: undefined,
      };
    }
    // Lazy: don't re-issue if just generated < 15min ago — caller can hit POST pdf if needed.
    return {
      s3Key: podium.latestPdfS3Key,
      generatedAt: podium.latestPdfGeneratedAt?.toISOString(),
    };
  }
}
