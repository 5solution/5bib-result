import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, LogtoAdminGuard, LogtoUser } from '../logto-auth';
import { FONT_OPTIONS } from '../certificates/services/certificate-render.service';
import { BibPassConfigService } from './bib-pass-config.service';
import { BibPassSenderService } from './bib-pass-sender.service';
import {
  BibPassPreviewDto,
  TestSendDto,
  UpsertBibPassConfigDto,
} from './dto/bib-pass.dto';
import {
  BibPassConfigListResponseDto,
  BibPassConfigResponseDto,
  BibPassRaceOptionsResponseDto,
  BibPassStatsDto,
  ConfirmedAthletesResponseDto,
  FontOptionDto,
  SendBatchResultDto,
  TestSendResultDto,
} from './dto/bib-pass-response.dto';

/**
 * FEATURE-091 — Border Pass email admin API. TẤT CẢ endpoint admin-guarded
 * (LogtoAdminGuard) — KHÔNG có public endpoint (pass gửi qua email, không có
 * trang public). KHÔNG ghi legacy DB (chỉ SELECT read-only athletes).
 */
@ApiTags('Bib Pass Email')
@Controller('bib-pass')
@UseGuards(LogtoAdminGuard)
@ApiBearerAuth()
export class BibPassEmailController {
  constructor(
    private readonly configService: BibPassConfigService,
    private readonly senderService: BibPassSenderService,
  ) {}

  @Get('fonts')
  @ApiOperation({ summary: 'Admin — danh sách phông chọn được (đã verify VN)' })
  @ApiResponse({ status: 200, type: [FontOptionDto] })
  fonts(): FontOptionDto[] {
    return FONT_OPTIONS.map((f) => ({
      family: f.family,
      label: f.label,
      category: f.category,
    }));
  }

  @Get('races')
  @ApiOperation({ summary: 'Admin — giải có VĐV đã xác nhận BIB (dropdown)' })
  @ApiResponse({ status: 200, type: BibPassRaceOptionsResponseDto })
  async races(): Promise<BibPassRaceOptionsResponseDto> {
    return { items: await this.configService.listRaceOptions() };
  }

  @Get('configs')
  @ApiOperation({ summary: 'Admin — danh sách config Border Pass' })
  @ApiResponse({ status: 200, type: BibPassConfigListResponseDto })
  async list(): Promise<BibPassConfigListResponseDto> {
    return this.configService.listConfigs();
  }

  @Get('configs/:raceId')
  @ApiOperation({ summary: 'Admin — chi tiết config 1 giải' })
  @ApiParam({ name: 'raceId', type: Number })
  @ApiResponse({ status: 200, type: BibPassConfigResponseDto })
  @ApiResponse({ status: 404, description: 'Chưa cấu hình' })
  async getOne(
    @Param('raceId', ParseIntPipe) raceId: number,
  ): Promise<BibPassConfigResponseDto> {
    return this.configService.getConfig(raceId);
  }

  @Put('configs/:raceId')
  @ApiOperation({ summary: 'Admin — tạo/cập nhật config (upsert)' })
  @ApiParam({ name: 'raceId', type: Number })
  @ApiResponse({ status: 200, type: BibPassConfigResponseDto })
  @ApiResponse({ status: 400, description: 'Bật gửi nhưng thiếu phôi/tiêu đề' })
  async upsert(
    @Param('raceId', ParseIntPipe) raceId: number,
    @Body() dto: UpsertBibPassConfigDto,
    @CurrentUser() user: LogtoUser,
  ): Promise<BibPassConfigResponseDto> {
    return this.configService.upsertConfig(raceId, dto, user.sub);
  }

  @Delete('configs/:raceId')
  @ApiOperation({ summary: 'Admin — xóa config (giữ ledger lịch sử gửi)' })
  @ApiParam({ name: 'raceId', type: Number })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 404, description: 'Chưa cấu hình' })
  async remove(@Param('raceId', ParseIntPipe) raceId: number): Promise<{ ok: boolean }> {
    await this.configService.deleteConfig(raceId);
    return { ok: true };
  }

  @Get('configs/:raceId/preview')
  @Header('Content-Type', 'image/png')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Admin — preview phôi đã lưu (dữ liệu mẫu)' })
  @ApiParam({ name: 'raceId', type: Number })
  @ApiResponse({ status: 200, description: 'PNG' })
  async preview(
    @Param('raceId', ParseIntPipe) raceId: number,
  ): Promise<StreamableFile> {
    return new StreamableFile(await this.configService.renderPreview(raceId));
  }

  @Post('configs/:raceId/preview')
  @Header('Content-Type', 'image/png')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Admin — LIVE preview phôi CHƯA lưu (draft)' })
  @ApiParam({ name: 'raceId', type: Number })
  @ApiResponse({ status: 200, description: 'PNG' })
  async previewDraft(
    @Param('raceId', ParseIntPipe) raceId: number,
    @Body() dto: BibPassPreviewDto,
  ): Promise<StreamableFile> {
    return new StreamableFile(
      await this.configService.renderPreview(raceId, {
        template: dto.template,
        raceName: dto.raceName,
        staticFields: dto.staticFields,
      }),
    );
  }

  @Get('configs/:raceId/confirmed')
  @ApiOperation({ summary: 'Admin — VĐV đã xác nhận BIB + trạng thái gửi' })
  @ApiParam({ name: 'raceId', type: Number })
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiResponse({ status: 200, type: ConfirmedAthletesResponseDto })
  async confirmed(
    @Param('raceId', ParseIntPipe) raceId: number,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<ConfirmedAthletesResponseDto> {
    const p = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const ps = Math.min(100, Math.max(1, parseInt(pageSize ?? '20', 10) || 20));
    return this.configService.listConfirmedAthletes(raceId, { q, page: p, pageSize: ps });
  }

  @Get('configs/:raceId/stats')
  @ApiOperation({ summary: 'Admin — thống kê (đã xác nhận / đã gửi / còn lại)' })
  @ApiParam({ name: 'raceId', type: Number })
  @ApiResponse({ status: 200, type: BibPassStatsDto })
  async stats(
    @Param('raceId', ParseIntPipe) raceId: number,
  ): Promise<BibPassStatsDto> {
    return this.configService.getStats(raceId);
  }

  @Post('configs/:raceId/test-send')
  @ApiOperation({ summary: 'Admin — gửi thử 1 email tới địa chỉ chỉ định' })
  @ApiParam({ name: 'raceId', type: Number })
  @ApiResponse({ status: 201, type: TestSendResultDto })
  @ApiResponse({ status: 400, description: 'Chưa cấu hình phôi / VĐV chưa xác nhận' })
  async testSend(
    @Param('raceId', ParseIntPipe) raceId: number,
    @Body() dto: TestSendDto,
  ): Promise<TestSendResultDto> {
    return this.senderService.testSend(raceId, dto);
  }

  @Post('configs/:raceId/send-batch')
  @ApiOperation({ summary: 'Admin — gửi pass cho VĐV đã xác nhận CHƯA gửi (1 batch)' })
  @ApiParam({ name: 'raceId', type: Number })
  @ApiResponse({ status: 201, type: SendBatchResultDto })
  @ApiResponse({ status: 400, description: 'Cấu hình đang tắt / chưa cấu hình' })
  async sendBatch(
    @Param('raceId', ParseIntPipe) raceId: number,
  ): Promise<SendBatchResultDto> {
    return this.senderService.sendBatch(raceId);
  }
}
