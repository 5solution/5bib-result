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
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { LogtoAdminGuard } from '../logto-auth/logto-admin.guard';
import type { AuthenticatedRequest } from '../logto-auth/types';
import {
  AccessConfigListQueryDto,
  AccessConfigListResponseDto,
  AccessConfigResponseDto,
  CreateAccessConfigDto,
  DeleteAccessConfigResponseDto,
  UpdateAccessConfigDto,
} from './dto/access-config.dto';
import {
  AdminRaceSearchResponseDto,
  AdminSearchQueryDto,
  AdminTenantSearchResponseDto,
} from './dto/admin-search.dto';
import {
  LogtoLookupQueryDto,
  LogtoLookupResponseDto,
} from './dto/logto-lookup.dto';
import { MerchantPortalAccessService } from './services/merchant-portal-access.service';
import { MerchantPortalService } from './services/merchant-portal.service';

/**
 * F-069 M2a — Admin Merchant Portal endpoints.
 *
 * Route prefix: `/api/admin/merchant-portal/*` per BR-MP-26 R2.
 * Auth: `@UseGuards(LogtoAdminGuard)` class-level — all endpoints require admin.
 *
 * 7 endpoints:
 *   GET    /access                  — List access configs (paginated, filterable)
 *   GET    /access/:id              — Get config by Mongo _id
 *   POST   /access                  — Create new config
 *   PATCH  /access/:id              — Update config
 *   DELETE /access/:id              — Hard delete config
 *   GET    /audit-log               — TODO M2b — placeholder returns 200 empty for now
 *   GET    /logto-lookup            — REUSE M1 LogtoService for user lookup
 *
 * Actor attribution (resolves TD-CONTRACTS-ACTOR-001): extracted from
 * `req.user.userId` (Logto JWT subject) via @Req() instead of hardcoded 'admin'.
 */
@ApiTags('Admin — Merchant Portal')
@ApiBearerAuth('JWT-auth')
@UseGuards(LogtoAdminGuard)
@Controller('admin/merchant-portal')
export class MerchantPortalAdminController {
  constructor(
    private readonly accessService: MerchantPortalAccessService,
    private readonly portalService: MerchantPortalService,
  ) {}

  // ────────────────────────────────────────────────────────────────
  // GET /tenants/search — BTC tổ chức giải (dialog "Gán quyền BTC")
  // ────────────────────────────────────────────────────────────────

  @Get('tenants/search')
  @ApiOperation({
    summary: 'Search BTC (tenant) đang tổ chức giải (admin)',
    description:
      'Trả tenant có ≥1 giải chưa xóa, phục vụ dialog "Gán quyền BTC". ' +
      'q optional khớp name / mã số thuế / id. Bỏ trống → 50 tenant đầu theo tên.',
  })
  @ApiQuery({ name: 'q', description: 'Từ khóa (optional)', required: false })
  @ApiResponse({ status: 200, type: AdminTenantSearchResponseDto })
  @ApiResponse({ status: 400, description: 'Query không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Not admin role' })
  async searchTenants(
    @Query() query: AdminSearchQueryDto,
  ): Promise<AdminTenantSearchResponseDto> {
    return this.portalService.searchTenants(query.q);
  }

  // ────────────────────────────────────────────────────────────────
  // GET /races/search — giải cho per-race access grant picker
  // ────────────────────────────────────────────────────────────────

  @Get('races/search')
  @ApiOperation({
    summary: 'Search giải (non-draft) cho per-race access grant (admin)',
    description:
      'Trả giải chưa xóa + khác DRAFT, kèm tên BTC làm context. ' +
      'q optional khớp title / race_id. Bỏ trống → 50 giải mới nhất.',
  })
  @ApiQuery({ name: 'q', description: 'Từ khóa (optional)', required: false })
  @ApiResponse({ status: 200, type: AdminRaceSearchResponseDto })
  @ApiResponse({ status: 400, description: 'Query không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Not admin role' })
  async searchRaces(
    @Query() query: AdminSearchQueryDto,
  ): Promise<AdminRaceSearchResponseDto> {
    return this.portalService.searchRaces(query.q);
  }

  // ────────────────────────────────────────────────────────────────
  // GET /access — List
  // ────────────────────────────────────────────────────────────────

  @Get('access')
  @ApiOperation({
    summary: 'List merchant portal access configs (admin)',
    description: 'BR-MP-16 list view. Paginated, filter by q/tenant/permission/status.',
  })
  @ApiResponse({ status: 200, type: AccessConfigListResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Not admin role' })
  async list(
    @Query() query: AccessConfigListQueryDto,
  ): Promise<AccessConfigListResponseDto> {
    return this.accessService.findAll(query);
  }

  // ────────────────────────────────────────────────────────────────
  // GET /access/:id — Detail
  // ────────────────────────────────────────────────────────────────

  @Get('access/:id')
  @ApiOperation({ summary: 'Get access config by id' })
  @ApiParam({ name: 'id', type: 'string', description: 'MongoDB _id' })
  @ApiResponse({ status: 200, type: AccessConfigResponseDto })
  @ApiResponse({ status: 404, description: 'Config not found' })
  async detail(@Param('id') id: string): Promise<AccessConfigResponseDto> {
    return this.accessService.findOne(id);
  }

  // ────────────────────────────────────────────────────────────────
  // POST /access — Create
  // ────────────────────────────────────────────────────────────────

  @Post('access')
  @ApiOperation({
    summary: 'Create new access config (BR-MP-16, BR-MP-33, BR-MP-37)',
    description:
      'Creates access config for Logto user. SETNX lock 10s prevents concurrent same-userId. ' +
      'Validates tenantIds against MySQL platform tenant table. Emits audit log.',
  })
  @ApiResponse({ status: 201, type: AccessConfigResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Validation fail (invalid tenant / empty scope / bad permissions)',
  })
  @ApiResponse({ status: 409, description: 'Duplicate userId OR concurrent edit' })
  async create(
    @Body() dto: CreateAccessConfigDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<AccessConfigResponseDto> {
    const actorUserId = req.user?.userId ?? 'admin';
    return this.accessService.create(dto, actorUserId);
  }

  // ────────────────────────────────────────────────────────────────
  // PATCH /access/:id — Update
  // ────────────────────────────────────────────────────────────────

  @Patch('access/:id')
  @ApiOperation({
    summary: 'Update access config (BR-MP-16)',
    description:
      'Partial update. SETNX lock prevents concurrent same-record save. ' +
      'Audit log records before/after diff. Cache invalidate per BR-MP-13.',
  })
  @ApiResponse({ status: 200, type: AccessConfigResponseDto })
  @ApiResponse({ status: 400, description: 'Validation fail' })
  @ApiResponse({ status: 404, description: 'Config not found' })
  @ApiResponse({ status: 409, description: 'Concurrent edit lock held' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAccessConfigDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<AccessConfigResponseDto> {
    const actorUserId = req.user?.userId ?? 'admin';
    return this.accessService.update(id, dto, actorUserId);
  }

  // ────────────────────────────────────────────────────────────────
  // DELETE /access/:id — Hard delete
  // ────────────────────────────────────────────────────────────────

  @Delete('access/:id')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Hard delete access config (BR-MP-16)',
    description:
      'Permanent removal. Audit log emit BEFORE delete with full snapshot ' +
      'for compliance trail. Cache flush per BR-MP-13.',
  })
  @ApiResponse({ status: 200, type: DeleteAccessConfigResponseDto })
  @ApiResponse({ status: 404, description: 'Config not found' })
  @ApiResponse({ status: 409, description: 'Concurrent edit lock held' })
  async remove(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<DeleteAccessConfigResponseDto> {
    const actorUserId = req.user?.userId ?? 'admin';
    return this.accessService.delete(id, actorUserId);
  }

  // ────────────────────────────────────────────────────────────────
  // GET /logto-lookup — Lookup Logto user (REUSE M1 LogtoService)
  // ────────────────────────────────────────────────────────────────

  @Get('logto-lookup')
  @ApiOperation({
    summary: 'Lookup Logto user by ID or email (BR-MP-36)',
    description:
      'Auto-detects format: `@` in q → email lookup, otherwise → userId. ' +
      'Uses M1 LogtoService Redis cache 300s. Returns null gracefully if ' +
      'Logto Management API unreachable (admin can enter manually).',
  })
  @ApiQuery({ name: 'q', description: 'Logto userId or email', required: true })
  @ApiResponse({ status: 200, type: LogtoLookupResponseDto })
  @ApiResponse({ status: 400, description: 'Query too short (<3 chars)' })
  async lookupLogto(
    @Query() query: LogtoLookupQueryDto,
  ): Promise<LogtoLookupResponseDto> {
    return this.accessService.lookupLogto(query.q);
  }

  // ────────────────────────────────────────────────────────────────
  // GET /audit-log — M2b placeholder
  // ────────────────────────────────────────────────────────────────

  @Get('audit-log')
  @ApiOperation({
    summary: 'List merchant_access.* audit log entries (M2b — placeholder M2a)',
    description:
      'M2a returns empty array stub. M2b implements query against AuditLog ' +
      'collection filtered by action `merchant_access.*` with pagination.',
  })
  @ApiResponse({ status: 200 })
  async auditLog(): Promise<{
    items: unknown[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    // M2a stub — M2b implements full audit log query
    return { items: [], total: 0, page: 1, pageSize: 20 };
  }
}
