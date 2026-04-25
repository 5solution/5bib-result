import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { UploadedFile } from '@nestjs/common';
import type { Response } from 'express';
import { LogtoAdminGuard, type AuthenticatedRequest } from 'src/modules/logto-auth';
import {
  AssignableMemberDto,
  AssignmentMemberBriefDto,
  CreateAssignmentDto,
  CreateStationDto,
  StationWithAssignmentSummaryDto,
  UpdateStationDto,
  UpdateStationStatusDto,
} from './dto/station.dto';
import { ImportStationsResponseDto } from './dto/import-stations.dto';
import { TeamStationService } from './services/team-station.service';
import { TeamStationImportService } from './services/team-station-import.service';

function identifyAdmin(req: AuthenticatedRequest): string {
  return req.user?.email ?? req.user?.userId ?? req.user?.sub ?? 'admin';
}

// v1.8: stations pivoted from role → category. Routes now group under
// /team-categories/:categoryId/stations. Old role-scoped routes removed.
@ApiTags('Team Management (stations)')
@ApiBearerAuth()
@UseGuards(LogtoAdminGuard)
@Controller('team-management')
export class TeamStationController {
  constructor(
    private readonly stations: TeamStationService,
    private readonly stationsImport: TeamStationImportService,
  ) {}

  @Get('events/:eventId/stations')
  @ApiOperation({
    summary:
      'v1.6: flat event-wide station list. Each row carries category_id + category_name + category_color for client-side filtering/grouping.',
  })
  @ApiResponse({ status: 200, type: [StationWithAssignmentSummaryDto] })
  listAllStationsInEvent(
    @Param('eventId', ParseIntPipe) eventId: number,
  ): Promise<StationWithAssignmentSummaryDto[]> {
    return this.stations.listAllStationsInEvent(eventId);
  }

  @Get('team-categories/:categoryId/stations')
  @ApiOperation({
    summary:
      'List all stations under a Team (category) with member summary. v1.8 replacement for events/:eventId/roles/:roleId/stations.',
  })
  @ApiResponse({ status: 200, type: [StationWithAssignmentSummaryDto] })
  listStations(
    @Param('categoryId', ParseIntPipe) categoryId: number,
  ): Promise<StationWithAssignmentSummaryDto[]> {
    return this.stations.listStationsWithSummary(categoryId);
  }

  @Post('team-categories/:categoryId/stations')
  @ApiOperation({ summary: 'Create a station under a Team (category)' })
  @ApiResponse({ status: 201, type: StationWithAssignmentSummaryDto })
  createStation(
    @Param('categoryId', ParseIntPipe) categoryId: number,
    @Body() dto: CreateStationDto,
  ): Promise<StationWithAssignmentSummaryDto> {
    return this.stations.createStation(categoryId, dto);
  }

  @Patch('stations/:id')
  @ApiOperation({ summary: 'Partial update of a station' })
  @ApiResponse({ status: 200, type: StationWithAssignmentSummaryDto })
  updateStation(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStationDto,
  ): Promise<StationWithAssignmentSummaryDto> {
    return this.stations.updateStation(id, dto);
  }

  @Patch('stations/:id/status')
  @ApiOperation({
    summary:
      'Change station lifecycle status (setup/active/closed — any transition allowed)',
  })
  @ApiResponse({ status: 200, type: StationWithAssignmentSummaryDto })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStationStatusDto,
  ): Promise<StationWithAssignmentSummaryDto> {
    return this.stations.updateStatus(id, dto.status);
  }

  @Delete('stations/:id')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Delete a station (409 if any assignments still attached)',
  })
  @ApiResponse({ status: 204 })
  async deleteStation(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.stations.deleteStation(id);
  }

  @Get('stations/:id/assignable-members')
  @ApiOperation({
    summary:
      'List members eligible for assignment: same-team roles (any rank), approved+, not already assigned. v1.8: leaders allowed (BR-STN-03 relaxed to warning).',
  })
  @ApiResponse({ status: 200, type: [AssignableMemberDto] })
  listAssignableMembers(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<AssignableMemberDto[]> {
    return this.stations.listAssignableMembers(id);
  }

  @Post('stations/:id/assignments')
  @ApiOperation({
    summary:
      'Assign a member to a station. Supervisor-vs-worker derived from role.is_leader_role.',
  })
  @ApiResponse({ status: 201, type: AssignmentMemberBriefDto })
  createAssignment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateAssignmentDto,
  ): Promise<AssignmentMemberBriefDto> {
    return this.stations.createAssignment(id, dto);
  }

  @Delete('station-assignments/:assignmentId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove an assignment' })
  @ApiResponse({ status: 204 })
  async removeAssignment(
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
  ): Promise<void> {
    await this.stations.removeAssignment(assignmentId);
  }

  // ─── Station bulk import (v1.9) ────────────────────────────────────────

  @Get('team-categories/:categoryId/stations/import/template')
  @ApiOperation({
    summary:
      'Download XLSX template for bulk station import under a team (category). Columns: station_name *, location_description, gps_lat, gps_lng, sort_order.',
  })
  @ApiResponse({
    status: 200,
    description: 'Binary XLSX file.',
  })
  async downloadStationsTemplate(
    @Param('categoryId', ParseIntPipe) categoryId: number,
    @Res() res: Response,
  ): Promise<void> {
    const buf = await this.stationsImport.generateTemplateXlsx(categoryId);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="stations-import-template-team${categoryId}.xlsx"`,
      'Content-Length': String(buf.length),
    });
    res.send(buf);
  }

  @Post('team-categories/:categoryId/stations/import')
  @ApiOperation({
    summary:
      'Single-step bulk import of stations for a team (category) from XLSX/CSV. Inserts valid rows immediately; duplicate names skipped, rows with validation errors reported.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, type: ImportStationsResponseDto })
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const name = (file.originalname ?? '').toLowerCase();
        const extOk = name.endsWith('.csv') || name.endsWith('.xlsx');
        const allowed = new Set([
          'text/csv',
          'application/csv',
          'text/plain',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/octet-stream',
        ]);
        if (!extOk || !allowed.has(file.mimetype ?? '')) {
          return cb(new BadRequestException('Chỉ hỗ trợ .csv và .xlsx'), false);
        }
        cb(null, true);
      },
    }),
  )
  importStations(
    @Param('categoryId', ParseIntPipe) categoryId: number,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthenticatedRequest,
  ): Promise<ImportStationsResponseDto> {
    return this.stationsImport.importStations(categoryId, file, identifyAdmin(req));
  }
}
