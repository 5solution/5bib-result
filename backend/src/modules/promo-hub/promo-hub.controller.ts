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
import {
  CurrentUser,
  LogtoAdminGuard,
  LogtoUser,
} from '../logto-auth';
import { CreatePromoHubDto } from './dto/create-promo-hub.dto';
import {
  PromoHubListResponseDto,
  PromoHubResponseDto,
} from './dto/promo-hub-response.dto';
import { ReorderSectionsDto } from './dto/reorder-sections.dto';
import { UpdatePromoHubDto } from './dto/update-promo-hub.dto';
import { PromoHubService } from './promo-hub.service';
import { PROMO_HUB_STATUSES, PromoHubStatus } from './schemas/promo-hub.schema';
import {
  RacesOnSaleListResponseDto,
  RacesOnSaleQueryDto,
} from './dto/race-on-sale-response.dto';

/**
 * FEATURE-027 — Promo Hub controller.
 *
 * Admin endpoints (`LogtoAdminGuard`):
 *   - POST   /api/promo-hubs               — create
 *   - GET    /api/promo-hubs               — list (paginated, filter status)
 *   - GET    /api/promo-hubs/:id           — admin lookup
 *   - PATCH  /api/promo-hubs/:id           — update
 *   - DELETE /api/promo-hubs/:id           — soft delete (status='archived')
 *   - PATCH  /api/promo-hubs/:id/sections/reorder — reorder sections
 *
 * Public endpoint (no auth, ThrottlerGuard module-level):
 *   - GET    /api/promo-hubs/slug/:slug    — public read by slug
 *
 * ⚠️ Route ordering (BR-PH-PLAN convention F-003):
 *   `GET /slug/:slug` declared BEFORE `GET /:id` so literal-prefix matches
 *   first. NestJS matches in declaration order — generic `:id` would
 *   shadow `slug/` segment otherwise.
 */
@ApiTags('Promo Hub')
@Controller('promo-hubs')
export class PromoHubController {
  constructor(private readonly promoHubService: PromoHubService) {}

  // ─── Public endpoint (slug-based) — MUST declare before `:id` ───

  /**
   * FEATURE-033 — Public endpoint cho race calendar phase BÁN VÉ.
   *
   * Route MUST declare BEFORE `Get(':id')` để literal `races-on-sale` không
   * bị shadow bởi generic `:id` route.
   */
  @Get('races-on-sale')
  @ApiOperation({
    summary: 'Public — list races đang phase BÁN VÉ (MySQL platform)',
    description:
      'FEATURE-033. Source: MySQL `5bib_platform_live.races` filter status="GENERATED_CODE" + is_delete=0 + is_show=1 + url_name NOT NULL. ' +
      'Multi-tenant: show ALL (BR-PH33-06). Sort: registration_start_time ASC default. Cache Redis 60s TTL.',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: ['registration_start_time', 'event_date'],
  })
  @ApiResponse({ status: 200, type: RacesOnSaleListResponseDto })
  async findRacesOnSale(
    @Query() query: RacesOnSaleQueryDto,
  ): Promise<RacesOnSaleListResponseDto> {
    const data = await this.promoHubService.findRacesOnSale(query);
    return { data };
  }

  @Get('slug/:slug')
  @ApiOperation({
    summary: 'Public — get published promo hub by slug',
    description:
      'Public endpoint, no auth. Returns ONLY status="published" hubs. Section list filtered by visibility + schedule window server-side. Redis cache 60s with SETNX anti-stampede lock.',
  })
  @ApiParam({ name: 'slug', type: String })
  @ApiResponse({ status: 200, type: PromoHubResponseDto })
  @ApiResponse({
    status: 404,
    description: 'Hub does not exist OR status != "published"',
  })
  async findBySlug(@Param('slug') slug: string): Promise<PromoHubResponseDto> {
    return this.promoHubService.findBySlugPublic(slug);
  }

  // ─── Admin endpoints (LogtoAdminGuard) ─────────────────────────

  @Post()
  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin — create promo hub' })
  @ApiResponse({ status: 201, type: PromoHubResponseDto })
  @ApiResponse({ status: 409, description: 'Slug already exists' })
  async create(
    @Body() dto: CreatePromoHubDto,
    @CurrentUser() user: LogtoUser,
  ): Promise<PromoHubResponseDto> {
    return this.promoHubService.create(dto, user.sub);
  }

  @Get()
  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin — list promo hubs (paginated)' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: [...PROMO_HUB_STATUSES, 'all'],
  })
  @ApiQuery({ name: 'pageNo', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiResponse({ status: 200, type: PromoHubListResponseDto })
  async list(
    @Query('status') status?: PromoHubStatus | 'all',
    @Query('pageNo') pageNo?: string,
    @Query('pageSize') pageSize?: string,
    @Query('q') q?: string,
  ): Promise<PromoHubListResponseDto> {
    return this.promoHubService.list({
      status,
      pageNo: pageNo ? Number(pageNo) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      q,
    });
  }

  @Get(':id')
  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin — get promo hub by id' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, type: PromoHubResponseDto })
  @ApiResponse({ status: 404, description: 'Hub not found' })
  async findById(@Param('id') id: string): Promise<PromoHubResponseDto> {
    return this.promoHubService.findById(id);
  }

  @Patch(':id')
  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin — update promo hub' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, type: PromoHubResponseDto })
  @ApiResponse({ status: 404, description: 'Hub not found' })
  @ApiResponse({ status: 409, description: 'Slug conflict on update' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePromoHubDto,
    @CurrentUser() user: LogtoUser,
  ): Promise<PromoHubResponseDto> {
    return this.promoHubService.update(id, dto, user.sub);
  }

  @Patch(':id/sections/reorder')
  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Admin — reorder sections within a hub (drag-and-drop save)',
  })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, type: PromoHubResponseDto })
  @ApiResponse({
    status: 400,
    description: 'sectionIds set does not match current sections',
  })
  async reorderSections(
    @Param('id') id: string,
    @Body() dto: ReorderSectionsDto,
    @CurrentUser() user: LogtoUser,
  ): Promise<PromoHubResponseDto> {
    return this.promoHubService.reorderSections(id, dto.sectionIds, user.sub);
  }

  @Delete(':id')
  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin — soft delete (set status=archived). Idempotent.',
  })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, schema: { example: { success: true } } })
  @ApiResponse({ status: 404, description: 'Hub not found' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: LogtoUser,
  ): Promise<{ success: boolean }> {
    return this.promoHubService.softDelete(id, user.sub);
  }
}
