import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LogtoAdminGuard, type AuthenticatedRequest } from 'src/modules/logto-auth';
import { VolEvent } from './entities/vol-event.entity';
import { VolRole } from './entities/vol-role.entity';
import { VolRegistration } from './entities/vol-registration.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateRegistrationDto } from './dto/update-registration.dto';
import { RejectRegistrationDto } from './dto/reject-registration.dto';
import { RejectChangesDto } from './dto/reject-changes.dto';
import { CancelRegistrationDto } from './dto/cancel-registration.dto';
import { ConfirmCompletionDto } from './dto/confirm-completion.dto';
import { ClearSuspiciousDto } from './dto/clear-suspicious.dto';
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
  PersonnelExportResponseDto,
} from './dto/bulk-update.dto';
import { RegistrationDetailDto } from './dto/registration-detail.dto';
import { AdminManualRegisterDto } from './dto/manual-register.dto';
import { RegisterResponseDto } from './dto/response.dto';
import { DashboardQueryDto, DashboardResponseDto } from './dto/dashboard.dto';
import { ShirtAggregateDto, UpsertShirtStockDto } from './dto/shirt-stock.dto';
import {
  ConfirmNghiemThuDto,
  BatchConfirmNghiemThuDto,
  BatchConfirmNghiemThuResponseDto,
  EventFeaturesConfigDto,
  NghiemThuResponseDto,
  UpdateEventFeaturesDto,
} from './dto/event-features.dto';
import { VolShirtStock } from './entities/vol-shirt-stock.entity';
import {
  TeamEventService,
  type VolRoleWithManaged,
} from './services/team-event.service';
import { TeamRegistrationService } from './services/team-registration.service';
import { TeamContractService } from './services/team-contract.service';
import { TeamDashboardService } from './services/team-dashboard.service';
import { TeamShirtService } from './services/team-shirt.service';
import { TeamExportService } from './services/team-export.service';
import { TeamRoleImportService } from './services/team-role-import.service';
import {
  ConfirmRoleImportDto,
  ConfirmRoleImportResponseDto,
  PreviewRoleImportResponseDto,
} from './dto/role-import.dto';


function identifyAdmin(req: AuthenticatedRequest): string {
  return req.user?.username ?? req.user?.email ?? req.user?.sub ?? 'admin';
}

@ApiTags('Team Management (admin)')
@ApiBearerAuth()
@UseGuards(LogtoAdminGuard)
@Controller('team-management')
export class TeamManagementController {
  constructor(
    private readonly events: TeamEventService,
    private readonly registrations: TeamRegistrationService,
    private readonly contracts: TeamContractService,
    private readonly dashboard: TeamDashboardService,
    private readonly shirts: TeamShirtService,
    private readonly exports: TeamExportService,
    private readonly roleImport: TeamRoleImportService,
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
  ): Promise<VolEvent & { roles: VolRoleWithManaged[] }> {
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
  async deleteEvent(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ success: true }> {
    await this.events.deleteEvent(id);
    return { success: true };
  }

  // ── v1.9 Feature mode config ──────────────────────────────────────────────

  @ApiOperation({ summary: 'Get event feature config (mode + nghiem_thu)' })
  @ApiResponse({ status: 200, type: EventFeaturesConfigDto })
  @Get('events/:id/config')
  getEventConfig(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<EventFeaturesConfigDto> {
    return this.registrations.getEventFeaturesConfig(id);
  }

  @ApiOperation({ summary: 'Update event feature mode + nghiem_thu toggle' })
  @ApiBody({ type: UpdateEventFeaturesDto })
  @ApiResponse({ status: 200, type: EventFeaturesConfigDto })
  @ApiResponse({ status: 409, description: 'Cannot switch to Lite — conflicting registrations' })
  @Patch('events/:id/features')
  updateEventFeatures(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) dto: UpdateEventFeaturesDto,
  ): Promise<EventFeaturesConfigDto> {
    return this.registrations.updateEventFeatures(id, dto);
  }

  @ApiOperation({ summary: 'Admin confirms nghiem thu (formal completion acceptance)' })
  @ApiBody({ type: ConfirmNghiemThuDto })
  @ApiResponse({ status: 200, type: NghiemThuResponseDto })
  @Patch('registrations/:id/nghiem-thu')
  confirmNghiemThu(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmNghiemThuDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<NghiemThuResponseDto> {
    return this.registrations.confirmNghiemThu(id, identifyAdmin(req), dto.note);
  }

  @ApiOperation({ summary: 'Batch confirm-completion for many registrations (best-effort)' })
  @ApiBody({ type: BatchConfirmNghiemThuDto })
  @ApiResponse({ status: 200, type: BatchConfirmNghiemThuResponseDto })
  @Post('registrations/nghiem-thu/batch')
  confirmNghiemThuBatch(
    @Body() dto: BatchConfirmNghiemThuDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<BatchConfirmNghiemThuResponseDto> {
    return this.registrations.confirmNghiemThuBatch(
      dto.registration_ids,
      identifyAdmin(req),
      dto.note,
    );
  }

  // -------- Roles --------

  @Get('roles/import-template')
  @ApiOperation({
    summary: 'Download a CSV template for bulk role import',
  })
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="roles_template.csv"')
  getImportTemplate(): string {
    return this.roleImport.generateTemplateCsv();
  }

  @Post('events/:id/roles/import/preview')
  @ApiOperation({
    summary:
      'Parse & validate a CSV/XLSX file of roles — returns preview, does not insert',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, type: PreviewRoleImportResponseDto })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 1 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = new Set([
          'text/csv',
          'application/csv',
          'text/plain',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
        const name = (file.originalname ?? '').toLowerCase();
        const extOk = name.endsWith('.csv') || name.endsWith('.xlsx');
        if (!extOk || !allowed.has(file.mimetype ?? '')) {
          return cb(new BadRequestException('Chỉ hỗ trợ .csv và .xlsx'), false);
        }
        cb(null, true);
      },
    }),
  )
  previewRoleImport(
    @Param('id', ParseIntPipe) eventId: number,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<PreviewRoleImportResponseDto> {
    return this.roleImport.preview(eventId, file);
  }

  @Post('events/:id/roles/import/confirm')
  @ApiOperation({
    summary:
      'Commit parsed role rows (re-validates server-side, batch inserts, returns full roles list)',
  })
  @ApiResponse({ status: 201, type: ConfirmRoleImportResponseDto })
  confirmRoleImport(
    @Param('id', ParseIntPipe) eventId: number,
    @Body() dto: ConfirmRoleImportDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ConfirmRoleImportResponseDto> {
    return this.roleImport.confirm(eventId, dto.rows, identifyAdmin(req));
  }

  @Post('events/:id/roles')
  @ApiOperation({ summary: 'Add role to event' })
  @ApiResponse({ status: 201, type: VolRole })
  createRole(
    @Param('id', ParseIntPipe) eventId: number,
    @Body() dto: CreateRoleDto,
  ): Promise<VolRoleWithManaged> {
    return this.events.createRole(eventId, dto);
  }

  @Get('events/:id/roles')
  @ApiOperation({ summary: 'List roles for event' })
  listRoles(
    @Param('id', ParseIntPipe) eventId: number,
  ): Promise<VolRoleWithManaged[]> {
    return this.events.listRoles(eventId);
  }

  @Put('roles/:id')
  @ApiOperation({ summary: 'Update role' })
  @ApiResponse({ status: 200, type: VolRole })
  updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoleDto,
  ): Promise<VolRoleWithManaged> {
    return this.events.updateRole(id, dto);
  }

  @Delete('roles/:id')
  @ApiOperation({ summary: 'Delete role (must have 0 filled_slots)' })
  async deleteRole(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ success: true }> {
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

  @Post('registrations/:id/send-contract')
  @ApiOperation({ summary: 'Send (or resend) contract magic link to a specific registration' })
  @ApiResponse({ status: 201, description: 'Contract sent successfully' })
  async sendContractForRegistration(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ success: boolean }> {
    await this.contracts.sendContractForRegistrationId(id);
    return { success: true };
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
  @ApiOperation({
    summary:
      'Update registration field-level edits (notes / payment / working_days). State transitions use dedicated endpoints.',
  })
  @ApiResponse({ status: 200, type: VolRegistration })
  updateRegistration(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRegistrationDto,
  ): Promise<VolRegistration> {
    return this.registrations.updateRegistration(id, dto);
  }

  // ---- v1.4 state-machine endpoints ----

  @Patch('registrations/:id/approve')
  @ApiOperation({
    summary:
      'Approve a pending_approval registration. Transitions → approved then auto-sends the contract email (→ contract_sent).',
  })
  @ApiResponse({ status: 200, type: VolRegistration })
  async approveRegistration(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<VolRegistration> {
    const approved = await this.registrations.approveRegistration(id);
    // Fire-and-forget contract email: failure leaves status at `approved`
    // and the admin can retry from the role bulk-send or via re-approve.
    void this.contracts.sendContractForRegistrationId(id).catch((err) =>
      // eslint-disable-next-line no-console
      console.warn(
        `contract email after approve failed reg=${id}: ${(err as Error).message}`,
      ),
    );
    return approved;
  }

  @Patch('registrations/:id/reject')
  @ApiOperation({
    summary:
      'Reject a pending_approval (or approved) registration with a required reason. Auto-promotes next waitlisted.',
  })
  @ApiResponse({ status: 200, type: VolRegistration })
  rejectRegistration(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectRegistrationDto,
  ): Promise<VolRegistration> {
    return this.registrations.rejectRegistration(id, dto.rejection_reason);
  }

  @Patch('registrations/:id/cancel')
  @ApiOperation({
    summary:
      'Cancel a registration (any non-terminal state). Auto-promotes next waitlisted if a slot opens.',
  })
  @ApiResponse({ status: 200, type: VolRegistration })
  cancelRegistration(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelRegistrationDto,
  ): Promise<VolRegistration> {
    return this.registrations.cancelRegistration(id, dto.reason);
  }

  @Patch('registrations/:id/confirm-completion')
  @ApiOperation({
    summary:
      'Admin-override completion (checked_in → completed). Snapshots daily_rate × working_days and clears the suspicious flag.',
  })
  @ApiResponse({ status: 200, type: VolRegistration })
  confirmCompletion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmCompletionDto,
  ): Promise<VolRegistration> {
    return this.registrations.confirmCompletionByAdmin(id, dto.note);
  }

  @Patch('registrations/:id/clear-suspicious')
  @ApiOperation({
    summary:
      'Clear the suspicious_checkin flag. Requires an admin note (audit trail).',
  })
  @ApiResponse({ status: 200, type: VolRegistration })
  clearSuspicious(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ClearSuspiciousDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<VolRegistration> {
    return this.registrations.clearSuspicious(
      id,
      dto.admin_note,
      identifyAdmin(req),
    );
  }

  @Patch('registrations/:id/approve-changes')
  @ApiOperation({
    summary:
      'v1.4.1 — Admin approves a queued profile edit. Applies pending_changes to the main row and clears the flag.',
  })
  @ApiResponse({ status: 200, type: VolRegistration })
  approveProfileChanges(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<VolRegistration> {
    return this.registrations.approveProfileChanges(id, identifyAdmin(req));
  }

  @Patch('registrations/:id/reject-changes')
  @ApiOperation({
    summary:
      'v1.4.1 — Admin rejects a queued profile edit with a required reason. Emails the TNV.',
  })
  @ApiResponse({ status: 200, type: VolRegistration })
  rejectProfileChanges(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectChangesDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<VolRegistration> {
    return this.registrations.rejectProfileChanges(
      id,
      dto.reason,
      identifyAdmin(req),
    );
  }

  @Get('registrations/:id/detail')
  @ApiOperation({
    summary:
      'Full personnel detail with presigned CCCD photo URL (1h). Unmasked form data. Access is audit-logged.',
  })
  @ApiResponse({ status: 200, type: RegistrationDetailDto })
  getDetail(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<RegistrationDetailDto> {
    return this.registrations.getDetail(id, identifyAdmin(req));
  }

  @Get('registrations/:id/signature-url')
  @ApiOperation({
    summary:
      'Return a 10-min presigned URL for the handwritten signature PNG. Audit-logged.',
  })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: { url: { type: 'string' }, expires_in: { type: 'number' } },
    },
  })
  async getSignatureUrl(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ url: string; expires_in: number }> {
    const url = await this.contracts.getSignatureUrlForRegistration(
      id,
      identifyAdmin(req),
      600,
    );
    return { url, expires_in: 600 };
  }

  @Get('registrations/:id/contract-pdf-url')
  @ApiOperation({
    summary:
      'Return a short-lived (10 min) presigned S3 URL for the signed contract PDF.',
  })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: { url: { type: 'string' }, expires_in: { type: 'number' } },
    },
  })
  async getContractPdfUrl(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ url: string; expires_in: number }> {
    const url = await this.contracts.getSignedContractUrlForRegistration(
      id,
      600,
    );
    return { url, expires_in: 600 };
  }

  @Post('events/:id/registrations/manual')
  @ApiOperation({
    summary:
      'Admin adds a registration directly (walk-in, phone referral). Bypasses public throttle + can auto-approve. When auto_approve=true and slot is available, fires the contract-send chain automatically.',
  })
  @ApiResponse({ status: 201, type: RegisterResponseDto })
  async manualRegister(
    @Param('id', ParseIntPipe) _eventId: number,
    @Body() dto: AdminManualRegisterDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<RegisterResponseDto> {
    const result = await this.registrations.adminManualRegister(
      dto,
      identifyAdmin(req),
    );
    // Per Danny Q3: with auto_approve=true we land in `approved`, then
    // the admin expects the auto-chain approve → contract → sign → qr.
    // Fire the contract email here (fire-and-forget; admin can retry if
    // Mailchimp is down).
    if (result.status === 'approved') {
      void this.contracts
        .sendContractForRegistrationId(result.id)
        .catch((err) =>
          // eslint-disable-next-line no-console
          console.warn(
            `contract email after manual-register failed reg=${result.id}: ${(err as Error).message}`,
          ),
        );
    }
    return result;
  }

  @Post('registrations/bulk-update')
  @ApiOperation({
    summary: 'Apply approve/reject/cancel to many registrations',
  })
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

  @Get('events/:id/export-personnel')
  @ApiOperation({
    summary:
      'Export full personnel list (admin) — all matching rows, unmasked CCCD, returns 10-min presigned .xlsx URL.',
  })
  @ApiResponse({ status: 200, type: PersonnelExportResponseDto })
  exportPersonnel(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: ListRegistrationsQueryDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<PersonnelExportResponseDto> {
    return this.exports.exportPersonnelReport(id, {
      status: query.status,
      role_id: query.role_id,
      search: query.search,
      adminIdentity: identifyAdmin(req),
    });
  }
}
