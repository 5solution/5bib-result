import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, LogtoAdminGuard, LogtoUser } from '../logto-auth';
import { CrewCertificatesService } from './crew-certificates.service';
import { CreateBatchDto, CrewTemplateDto, UpdateBatchDto } from './dto/crew-batch.dto';
import {
  BatchListResponseDto,
  BatchResponseDto,
  CrewSearchResultDto,
  RosterConfirmDto,
  RosterPreviewDto,
} from './dto/crew-response.dto';
import { parseRoster } from './roster-parser';

@ApiTags('Crew Certificates')
@Controller('crew-certificates')
export class CrewCertificatesController {
  constructor(private readonly service: CrewCertificatesService) {}

  // ─── Public (no auth) — MUST declare before `:id` ──────────────

  @Get('public/:slug/search')
  @ApiOperation({ summary: 'Public — tìm crew theo tên trong đợt GCN' })
  @ApiParam({ name: 'slug', type: String })
  @ApiQuery({ name: 'name', required: true, type: String })
  @ApiResponse({ status: 200, type: [CrewSearchResultDto] })
  async search(
    @Param('slug') slug: string,
    @Query('name') name: string,
  ): Promise<CrewSearchResultDto[]> {
    return this.service.searchPublic(slug, name ?? '');
  }

  @Get('public/render/:recipientId')
  @Header('Content-Type', 'image/png')
  @ApiOperation({ summary: 'Public — render GCN PNG cho 1 crew' })
  @ApiParam({ name: 'recipientId', type: String })
  @ApiResponse({ status: 200, description: 'PNG' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy / đợt đã tắt' })
  async renderPublic(
    @Param('recipientId') recipientId: string,
  ): Promise<StreamableFile> {
    return new StreamableFile(await this.service.renderPublic(recipientId));
  }

  // ─── Admin (LogtoAdminGuard) ───────────────────────────────────

  @Post()
  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin — tạo đợt GCN' })
  @ApiResponse({ status: 201, type: BatchResponseDto })
  @ApiResponse({ status: 409, description: 'Slug đã tồn tại' })
  async create(
    @Body() dto: CreateBatchDto,
    @CurrentUser() user: LogtoUser,
  ): Promise<BatchResponseDto> {
    return this.service.createBatch(dto, user.sub);
  }

  @Get()
  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin — danh sách đợt GCN' })
  @ApiResponse({ status: 200, type: BatchListResponseDto })
  async list(): Promise<BatchListResponseDto> {
    return this.service.listBatches();
  }

  @Get(':id')
  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin — chi tiết đợt GCN' })
  @ApiResponse({ status: 200, type: BatchResponseDto })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  async getOne(@Param('id') id: string): Promise<BatchResponseDto> {
    return this.service.getBatch(id);
  }

  @Patch(':id')
  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin — sửa đợt GCN (thông tin / phôi)' })
  @ApiResponse({ status: 200, type: BatchResponseDto })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  @ApiResponse({ status: 409, description: 'Slug đã tồn tại' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBatchDto,
  ): Promise<BatchResponseDto> {
    return this.service.updateBatch(id, dto);
  }

  @Delete(':id')
  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Admin — xóa đợt GCN + recipients' })
  @ApiResponse({ status: 204 })
  async remove(@Param('id') id: string): Promise<void> {
    await this.service.removeBatch(id);
  }

  @Post(':id/roster/preview')
  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Admin — upload roster Excel/CSV → preview' })
  @ApiResponse({ status: 200, type: RosterPreviewDto })
  async rosterPreview(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<RosterPreviewDto> {
    if (!file) throw new BadRequestException('Thiếu file');
    await this.service.getBatch(id); // 404 nếu batch không tồn tại
    return parseRoster(file.buffer, file.originalname);
  }

  @Post(':id/roster/confirm')
  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin — xác nhận nhập roster (thay toàn bộ)' })
  @ApiResponse({ status: 201, description: '{ inserted }' })
  async rosterConfirm(
    @Param('id') id: string,
    @Body() dto: RosterConfirmDto,
  ): Promise<{ inserted: number }> {
    return this.service.confirmRoster(id, dto.rows);
  }

  @Get(':id/recipients')
  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin — danh sách crew của đợt' })
  @ApiResponse({ status: 200, type: [CrewSearchResultDto] })
  async recipients(@Param('id') id: string): Promise<CrewSearchResultDto[]> {
    return this.service.listRecipients(id);
  }

  @Get(':id/positions')
  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin — distinct vị trí (position) của đợt để gán phôi' })
  @ApiResponse({ status: 200, description: '{ positions: string[] }' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  async positions(@Param('id') id: string): Promise<{ positions: string[] }> {
    return { positions: await this.service.getPositions(id) };
  }

  @Get(':id/preview')
  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth()
  @Header('Content-Type', 'image/png')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Admin — preview render phôi đã lưu với dữ liệu mẫu' })
  @ApiResponse({ status: 200, description: 'PNG' })
  async preview(@Param('id') id: string): Promise<StreamableFile> {
    return new StreamableFile(await this.service.renderPreview(id));
  }

  @Post(':id/preview')
  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth()
  @Header('Content-Type', 'image/png')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Admin — LIVE preview render phôi CHƯA lưu (draft)' })
  @ApiResponse({ status: 200, description: 'PNG' })
  async previewDraft(
    @Param('id') id: string,
    @Body() template: CrewTemplateDto,
  ): Promise<StreamableFile> {
    return new StreamableFile(await this.service.renderPreview(id, template));
  }
}
