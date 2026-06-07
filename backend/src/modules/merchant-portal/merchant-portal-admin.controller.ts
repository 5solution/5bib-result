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
  LogtoLookupQueryDto,
  LogtoLookupResponseDto,
} from './dto/logto-lookup.dto';
import { MerchantPortalAccessService } from './services/merchant-portal-access.service';

@ApiTags('Admin — Merchant Portal')
@ApiBearerAuth('JWT-auth')
@UseGuards(LogtoAdminGuard)
@Controller('admin/merchant-portal')
export class MerchantPortalAdminController {
  constructor(private readonly accessService: MerchantPortalAccessService) {}

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

  @Get('access/:id')
  @ApiOperation({ summary: 'Get access config by id' })
  @ApiParam({ name: 'id', type: 'string', description: 'MongoDB _id' })
  @ApiResponse({ status: 200, type: AccessConfigResponseDto })
  @ApiResponse({ status: 404, description: 'Config not found' })
  async detail(@Param('id') id: string): Promise<AccessConfigResponseDto> {
    return this.accessService.findOne(id);
  }

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
    return { items: [], total: 0, page: 1, pageSize: 20 };
  }
}
