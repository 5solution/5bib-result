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
import { ShortLinksService } from './short-links.service';
import { CreateShortLinkDto } from './dto/create-short-link.dto';
import { UpdateShortLinkDto } from './dto/update-short-link.dto';
import {
  ResolveShortLinkDto,
  ShortLinkListResponseDto,
  ShortLinkResponseDto,
} from './dto/short-link-response.dto';

/**
 * FEATURE-089 — Short link controller.
 *
 * ⚠️ Route ordering: literal `resolve/:code` declared BEFORE `:id` routes so the
 * generic param route does not shadow it (conventions §route-order).
 *
 * Public (no auth — gọi server-to-server bởi frontend redirect handler; cache
 * Redis bảo vệ tải; rate-limit per end-user ở nginx/frontend):
 *   - GET /api/short-links/resolve/:code
 * Admin (LogtoAdminGuard):
 *   - POST/GET/PATCH/DELETE /api/short-links ...
 *   - GET /api/short-links/:id/qr.png
 */
@ApiTags('Short Links')
@Controller('short-links')
export class ShortLinksController {
  constructor(private readonly service: ShortLinksService) {}

  // ─── Public — MUST declare before `:id` ────────────────────────

  @Get('resolve/:code')
  @ApiOperation({ summary: 'Public — resolve short code → target URL (redirect)' })
  @ApiParam({ name: 'code', type: String })
  @ApiResponse({ status: 200, type: ResolveShortLinkDto })
  @ApiResponse({ status: 404, description: 'Không tồn tại hoặc đã tắt' })
  async resolve(@Param('code') code: string): Promise<ResolveShortLinkDto> {
    return this.service.resolve(code);
  }

  // ─── Admin (LogtoAdminGuard) ───────────────────────────────────

  @Post()
  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin — tạo short link' })
  @ApiResponse({ status: 201, type: ShortLinkResponseDto })
  @ApiResponse({ status: 400, description: 'URL sai / alias reserved' })
  @ApiResponse({ status: 409, description: 'Alias đã tồn tại' })
  async create(
    @Body() dto: CreateShortLinkDto,
    @CurrentUser() user: LogtoUser,
  ): Promise<ShortLinkResponseDto> {
    return this.service.create(dto, user.sub);
  }

  @Get()
  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin — danh sách short link' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiResponse({ status: 200, type: ShortLinkListResponseDto })
  async list(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<ShortLinkListResponseDto> {
    return this.service.list({
      search,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Patch(':id')
  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin — sửa short link' })
  @ApiResponse({ status: 200, type: ShortLinkResponseDto })
  @ApiResponse({ status: 404, description: 'Không tìm thấy link' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateShortLinkDto,
  ): Promise<ShortLinkResponseDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Admin — xóa short link' })
  @ApiResponse({ status: 204, description: 'Đã xóa' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy link' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.service.remove(id);
  }

  @Get(':id/qr.png')
  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth()
  @Header('Content-Type', 'image/png')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Admin — QR PNG của short link' })
  @ApiResponse({ status: 200, description: 'PNG image' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy link' })
  async qr(@Param('id') id: string): Promise<StreamableFile> {
    const buf = await this.service.generateQrPng(id);
    return new StreamableFile(buf);
  }
}
