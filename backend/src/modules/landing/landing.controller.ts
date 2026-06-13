import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
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
import { LandingService } from './landing.service';
import { CreateLandingDto } from './dto/create-landing.dto';
import { UpdateLandingDto } from './dto/update-landing.dto';
import { ReorderSectionsDto } from './dto/reorder-sections.dto';
import {
  LandingListResponseDto,
  LandingResponseDto,
  PublicLandingResponseDto,
  ResolveHostResponseDto,
} from './dto/landing-response.dto';
import { LANDING_STATUSES } from './landing.constants';

/**
 * FEATURE-083 — Race Landing controller.
 *
 * ⚠️ Route ordering (NestJS, conventions §1173): literal `slug/:slug` and
 * `resolve` declared BEFORE `:id` so the generic `:id` route does not shadow
 * them. (Same rule as F-027 PromoHubController.)
 *
 * Public (no auth, global ThrottlerGuard rate-limits by IP):
 *   - GET /api/landings/slug/:slug   — render published landing (liveSnapshot)
 *   - GET /api/landings/resolve?host= — middleware host→slug resolution
 * Admin (LogtoAdminGuard — Phase 1 Back-Office Admin builds):
 *   - POST/GET/PATCH/DELETE /api/landings ...
 */
@ApiTags('Race Landing')
@Controller('landings')
export class LandingController {
  constructor(private readonly landingService: LandingService) {}

  // ─── Public — MUST declare before `:id` ────────────────────────

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Public — get published landing by subdomain slug' })
  @ApiParam({ name: 'slug', type: String })
  @ApiResponse({ status: 200, type: PublicLandingResponseDto })
  @ApiResponse({ status: 404, description: 'Not found or not published' })
  async findBySlug(
    @Param('slug') slug: string,
  ): Promise<PublicLandingResponseDto> {
    return this.landingService.findBySlugPublic(slug);
  }

  @Get('resolve')
  @ApiOperation({ summary: 'Public — resolve host → landing slug (middleware)' })
  @ApiQuery({ name: 'host', required: true, type: String })
  @ApiResponse({ status: 200, type: ResolveHostResponseDto })
  @ApiResponse({ status: 404, description: 'No landing for host' })
  async resolve(@Query('host') host: string): Promise<ResolveHostResponseDto> {
    return this.landingService.resolveHost(host);
  }

  // ─── Admin (LogtoAdminGuard) ───────────────────────────────────

  @Post()
  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin — create landing from a race' })
  @ApiResponse({ status: 201, type: LandingResponseDto })
  @ApiResponse({ status: 404, description: 'Race not found' })
  @ApiResponse({ status: 409, description: 'Race already has a landing' })
  async create(
    @Body() dto: CreateLandingDto,
    @CurrentUser() user: LogtoUser,
  ): Promise<LandingResponseDto> {
    return this.landingService.create(dto, user.sub);
  }

  @Get()
  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin — list landings (paginated)' })
  @ApiQuery({ name: 'status', required: false, enum: [...LANDING_STATUSES, 'all'] })
  @ApiQuery({ name: 'pageNo', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiResponse({ status: 200, type: LandingListResponseDto })
  async list(
    @Query('status') status?: string,
    @Query('pageNo') pageNo?: string,
    @Query('pageSize') pageSize?: string,
    @Query('q') q?: string,
  ): Promise<LandingListResponseDto> {
    return this.landingService.list({
      status,
      pageNo: pageNo ? Number(pageNo) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      q,
    });
  }

  @Get(':id')
  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin — get landing (draft) by id' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, type: LandingResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findById(@Param('id') id: string): Promise<LandingResponseDto> {
    return this.landingService.findById(id);
  }

  @Patch(':id')
  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin — update meta/theme/domain/internalName' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, type: LandingResponseDto })
  @ApiResponse({ status: 400, description: 'Subdomain invalid/reserved' })
  @ApiResponse({ status: 409, description: 'Subdomain taken' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateLandingDto,
    @CurrentUser() user: LogtoUser,
  ): Promise<LandingResponseDto> {
    return this.landingService.update(id, dto, user.sub);
  }

  @Patch(':id/sections')
  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin — replace/reorder sections (template fill-in)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, type: LandingResponseDto })
  @ApiResponse({ status: 400, description: 'Variant invalid for section type' })
  async reorderSections(
    @Param('id') id: string,
    @Body() dto: ReorderSectionsDto,
    @CurrentUser() user: LogtoUser,
  ): Promise<LandingResponseDto> {
    return this.landingService.reorderSections(id, dto.sections, user.sub);
  }

  @Post(':id/publish')
  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin — publish (snapshot draft → live)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, type: LandingResponseDto })
  @ApiResponse({ status: 422, description: 'Subdomain required' })
  @ApiResponse({ status: 409, description: 'Concurrent publish conflict' })
  async publish(
    @Param('id') id: string,
    @CurrentUser() user: LogtoUser,
  ): Promise<LandingResponseDto> {
    return this.landingService.publish(id, user.sub);
  }

  @Post(':id/unpublish')
  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin — unpublish (public returns 404)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, type: LandingResponseDto })
  async unpublish(
    @Param('id') id: string,
    @CurrentUser() user: LogtoUser,
  ): Promise<LandingResponseDto> {
    return this.landingService.unpublish(id, user.sub);
  }

  @Delete(':id')
  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin — soft delete (status=archived)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, schema: { example: { success: true } } })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: LogtoUser,
  ): Promise<{ success: boolean }> {
    return this.landingService.softDelete(id, user.sub);
  }
}
