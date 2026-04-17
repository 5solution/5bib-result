import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { VolEvent } from './entities/vol-event.entity';
import { VolRole } from './entities/vol-role.entity';
import { VolRegistration } from './entities/vol-registration.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateRegistrationDto } from './dto/update-registration.dto';
import {
  ListRegistrationsQueryDto,
  PaginationQueryDto,
} from './dto/pagination-query.dto';
import { ListRegistrationsResponseDto } from './dto/registration-row.dto';
import {
  SendContractsDto,
  SendContractsResponseDto,
} from './dto/sign-contract.dto';
import {
  BulkUpdateRegistrationsDto,
  BulkUpdateResponseDto,
  ExportResponseDto,
} from './dto/bulk-update.dto';
import { RegistrationDetailDto } from './dto/registration-detail.dto';
import {
  DashboardQueryDto,
  DashboardResponseDto,
} from './dto/dashboard.dto';
import {
  ShirtAggregateDto,
  UpsertShirtStockDto,
} from './dto/shirt-stock.dto';
import { VolShirtStock } from './entities/vol-shirt-stock.entity';
import { TeamEventService } from './services/team-event.service';
import { TeamRegistrationService } from './services/team-registration.service';
import { TeamContractService } from './services/team-contract.service';
import { TeamDashboardService } from './services/team-dashboard.service';
import { TeamShirtService } from './services/team-shirt.service';
import { TeamExportService } from './services/team-export.service';

interface JwtRequest extends Request {
  user?: { username?: string; email?: string; sub?: string };
}

function identifyAdmin(req: JwtRequest): string {
  return req.user?.username ?? req.user?.email ?? req.user?.sub ?? 'admin';
}

@ApiTags('Team Management (admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('team-management')
export class TeamManagementController {
  constructor(
    private readonly events: TeamEventService,
    private readonly registrations: TeamRegistrationService,
    private readonly contracts: TeamContractService,
    private readonly dashboard: TeamDashboardService,
    private readonly shirts: TeamShirtService,
    private readonly exports: TeamExportService,
  ) {}

  // -------- Events --------

  @Post('events')
  @ApiOperation({ summary: 'Create a team-management event' })
  @ApiResponse({ status: 201, type: VolEvent })
  createEvent(@Body() dto: CreateEventDto): Promise<VolEvent> {
    return this.events.createEvent(dto);
  }

  @Get('events')
  @ApiOperation({ summary: 'List events' })
  listEvents(
    @Query() query: PaginationQueryDto,
  ): Promise<{ data: VolEvent[]; total: number; page: number }> {
    return this.events.listEvents({
      status: query.status,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @Get('events/:id')
  @ApiOperation({ summary: 'Get event detail with roles' })
  getEvent(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<VolEvent & { roles: VolRole[] }> {
    return this.events.getEvent(id);
  }

  @Put('events/:id')
  @ApiOperation({ summary: 'Update event' })
  @ApiResponse({ status: 200, type: VolEvent })
  updateEvent(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEventDto,
  ): Promise<VolEvent> {
    return this.events.updateEvent(id, dto);
  }

  @Delete('events/:id')
  @ApiOperation({ summary: 'Delete event (draft only)' })
  async deleteEvent(@Param('id', ParseIntPipe) id: number): Promise<{ success: true }> {
    await this.events.deleteEvent(id);
    return { success: true };
  }

  // -------- Roles --------

  @Post('events/:id/roles')
  @ApiOperation({ summary: 'Add role to event' })
  @ApiResponse({ status: 201, type: VolRole })
  createRole(
    @Param('id', ParseIntPipe) eventId: number,
    @Body() dto: CreateRoleDto,
  ): Promise<VolRole> {
    return this.events.createRole(eventId, dto);
  }

  @Get('events/:id/roles')
  @ApiOperation({ summary: 'List roles for event' })
  listRoles(@Param('id', ParseIntPipe) eventId: number): Promise<VolRole[]> {
    return this.events.listRoles(eventId);
  }

  @Put('roles/:id')
  @ApiOperation({ summary: 'Update role' })
  @ApiResponse({ status: 200, type: VolRole })
  updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoleDto,
  ): Promise<VolRole> {
    return this.events.updateRole(id, dto);
  }

  @Delete('roles/:id')
  @ApiOperation({ summary: 'Delete role (must have 0 filled_slots)' })
  async deleteRole(@Param('id', ParseIntPipe) id: number): Promise<{ success: true }> {
    await this.events.deleteRole(id);
    return { success: true };
  }

  @Post('roles/:id/send-contracts')
  @ApiOperation({
    summary:
      'Batch-send contract magic links to all approved registrants of a role',
  })
  @ApiResponse({ status: 201, type: SendContractsResponseDto })
  sendContracts(
    @Param('id', ParseIntPipe) roleId: number,
    @Body() dto: SendContractsDto,
  ): Promise<SendContractsResponseDto> {
    return this.contracts.sendContractsForRole(roleId, dto.dry_run ?? false);
  }

  // -------- Registrations (admin view) --------

  @Get('events/:id/registrations')
  @ApiOperation({ summary: 'List registrations for event' })
  @ApiResponse({ status: 200, type: ListRegistrationsResponseDto })
  listRegistrations(
    @Param('id', ParseIntPipe) eventId: number,
    @Query() query: ListRegistrationsQueryDto,
  ): Promise<ListRegistrationsResponseDto> {
    return this.registrations.listForEvent({
      eventId,
      status: query.status,
      roleId: query.role_id,
      search: query.search,
      page: query.page ?? 1,
      limit: query.limit ?? 50,
    });
  }

  @Patch('registrations/:id')
  @ApiOperation({ summary: 'Update registration (approve/reject/cancel/pay)' })
  @ApiResponse({ status: 200, type: VolRegistration })
  updateRegistration(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRegistrationDto,
  ): Promise<VolRegistration> {
    return this.registrations.updateRegistration(id, dto);
  }

  @Get('registrations/:id/detail')
  @ApiOperation({
    summary:
      'Full personnel detail with presigned CCCD photo URL (1h). Unmasked form data. Access is audit-logged.',
  })
  @ApiResponse({ status: 200, type: RegistrationDetailDto })
  getDetail(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: JwtRequest,
  ): Promise<RegistrationDetailDto> {
    return this.registrations.getDetail(id, identifyAdmin(req));
  }

  @Post('registrations/bulk-update')
  @ApiOperation({ summary: 'Apply approve/reject/cancel to many registrations' })
  @ApiResponse({ status: 201, type: BulkUpdateResponseDto })
  bulkUpdate(
    @Body() dto: BulkUpdateRegistrationsDto,
  ): Promise<BulkUpdateResponseDto> {
    return this.registrations.bulkUpdate(dto);
  }

  // -------- Dashboard --------

  @Get('events/:id/dashboard')
  @ApiOperation({
    summary: '1-call dashboard aggregate (KPI + headcount + shirt + people)',
  })
  @ApiResponse({ status: 200, type: DashboardResponseDto })
  getDashboard(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: DashboardQueryDto,
  ): Promise<DashboardResponseDto> {
    return this.dashboard.getDashboard(id, query);
  }

  // -------- Shirt stock --------

  @Get('events/:id/shirt-stock')
  @ApiOperation({ summary: 'List shirt stock rows for event' })
  @ApiResponse({ status: 200, type: [VolShirtStock] })
  listShirtStock(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<VolShirtStock[]> {
    return this.shirts.listStock(id);
  }

  @Put('events/:id/shirt-stock')
  @ApiOperation({ summary: 'Upsert shirt stock rows (by size)' })
  upsertShirtStock(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpsertShirtStockDto,
  ): Promise<{ updated: number }> {
    return this.shirts.upsertStock(id, dto);
  }

  @Get('events/:id/shirt-aggregate')
  @ApiOperation({
    summary: 'Registered-vs-stock aggregate per shirt size',
  })
  @ApiResponse({ status: 200, type: ShirtAggregateDto })
  shirtAggregate(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ShirtAggregateDto> {
    return this.shirts.aggregate(id);
  }

  // -------- Export --------

  @Get('events/:id/export')
  @ApiOperation({
    summary: 'Generate payment-report .xlsx and return 10-min presigned URL',
  })
  @ApiResponse({ status: 200, type: ExportResponseDto })
  exportReport(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ExportResponseDto> {
    return this.exports.exportPaymentReport(id);
  }
}
