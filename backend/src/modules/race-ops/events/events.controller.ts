import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { env } from 'src/config';
import { OpsJwtAuthGuard } from '../common/guards/ops-jwt-auth.guard';
import { OpsRoleGuard } from '../common/guards/ops-role.guard';
import { OpsRoles } from '../common/decorators/ops-roles.decorator';
import { OpsUserCtx } from '../common/decorators/ops-user.decorator';
import { OpsUserContext } from '../common/types/ops-jwt-payload.type';
import { EventsService } from './events.service';
import {
  CreateEventDto,
  EventKpiDto,
  EventListQueryDto,
  EventListResponseDto,
  EventResponseDto,
  UpdateEventDto,
} from './dto/event.dto';

/**
 * Events controller — admin CRUD + public :slug.
 *
 * Admin endpoints:
 *  - Mount dưới `/race-ops/admin/events` — yêu cầu `ops_admin`.
 *  - `tenant_id` scope lấy từ JWT context.
 *
 * Public:
 *  - `GET /race-ops/public/events/:slug` — không auth, chặn DRAFT.
 *  - `tenant_id` scope lấy từ `env.ops.defaultTenantId` (single-tenant MVP).
 */
@ApiTags('race-ops/events')
@Controller('race-ops')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  // ─────────── ADMIN ───────────

  @Post('admin/events')
  @UseGuards(OpsJwtAuthGuard, OpsRoleGuard)
  @OpsRoles('ops_admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo event mới (DRAFT)' })
  @ApiCreatedResponse({ type: EventResponseDto })
  create(
    @OpsUserCtx() user: OpsUserContext,
    @Body() dto: CreateEventDto,
    @Req() req: Request,
  ): Promise<EventResponseDto> {
    return this.eventsService.create(user.tenant_id, user.userId, dto, req);
  }

  @Get('admin/events')
  @UseGuards(OpsJwtAuthGuard, OpsRoleGuard)
  @OpsRoles('ops_admin', 'ops_leader')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Danh sách events của tenant' })
  @ApiOkResponse({ type: EventListResponseDto })
  list(
    @OpsUserCtx() user: OpsUserContext,
    @Query() query: EventListQueryDto,
  ): Promise<EventListResponseDto> {
    return this.eventsService.list(user.tenant_id, query);
  }

  @Get('admin/events/:id')
  @UseGuards(OpsJwtAuthGuard, OpsRoleGuard)
  @OpsRoles('ops_admin', 'ops_leader')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chi tiết event' })
  @ApiOkResponse({ type: EventResponseDto })
  getOne(
    @OpsUserCtx() user: OpsUserContext,
    @Param('id') id: string,
  ): Promise<EventResponseDto> {
    return this.eventsService.findOneForTenant(user.tenant_id, id);
  }

  @Get('admin/events/:id/kpi')
  @UseGuards(OpsJwtAuthGuard, OpsRoleGuard)
  @OpsRoles('ops_admin', 'ops_leader')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'KPI overview card cho dashboard' })
  @ApiOkResponse({ type: EventKpiDto })
  kpi(
    @OpsUserCtx() user: OpsUserContext,
    @Param('id') id: string,
  ): Promise<EventKpiDto> {
    return this.eventsService.kpi(user.tenant_id, id);
  }

  @Patch('admin/events/:id')
  @UseGuards(OpsJwtAuthGuard, OpsRoleGuard)
  @OpsRoles('ops_admin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update event (bao gồm status transition DRAFT→LIVE→ENDED)',
  })
  @ApiOkResponse({ type: EventResponseDto })
  update(
    @OpsUserCtx() user: OpsUserContext,
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
    @Req() req: Request,
  ): Promise<EventResponseDto> {
    return this.eventsService.update(user.tenant_id, id, user.userId, dto, req);
  }

  @Delete('admin/events/:id')
  @UseGuards(OpsJwtAuthGuard, OpsRoleGuard)
  @OpsRoles('ops_admin')
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Archive (soft-delete) event' })
  @ApiNoContentResponse()
  async archive(
    @OpsUserCtx() user: OpsUserContext,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.eventsService.archive(user.tenant_id, id, user.userId, req);
  }

  // ─────────── PUBLIC ───────────

  @Get('public/events/:slug')
  @ApiOperation({
    summary: 'Public event info theo slug (không trả DRAFT)',
    description:
      'Dùng cho public volunteer form / QR landing. Single-tenant MVP — tenant lấy từ env.OPS_DEFAULT_TENANT_ID.',
  })
  @ApiOkResponse({ type: EventResponseDto })
  getPublic(@Param('slug') slug: string): Promise<EventResponseDto> {
    return this.eventsService.getPublicBySlug(env.ops.defaultTenantId, slug);
  }
}
