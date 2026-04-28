import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { BugReportsService } from './bug-reports.service';
import { ListBugReportsQueryDto } from './dto/list-bug-reports.dto';
import {
  UpdateBugStatusDto,
  UpdateBugAssigneeDto,
  UpdateBugTriageDto,
} from './dto/update-bug-report.dto';
import {
  BugReportAdminDto,
  PaginatedBugReportsAdminDto,
  BugReportStatsDto,
} from './dto/bug-report-response.dto';
import { CurrentUser, LogtoAdminGuard } from '../logto-auth';
import type { LogtoUser } from '../logto-auth/types';

@ApiTags('Bug Reports · Admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(LogtoAdminGuard)
@Controller('admin/bug-reports')
export class BugReportsAdminController {
  constructor(private readonly service: BugReportsService) {}

  @Get()
  @ApiOperation({ summary: 'List bug reports (admin) with filters and pagination' })
  @ApiResponse({ status: 200, type: PaginatedBugReportsAdminDto })
  async list(
    @Query() query: ListBugReportsQueryDto,
  ): Promise<PaginatedBugReportsAdminDto> {
    return this.service.listAdmin(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Stats for admin dashboard cards' })
  @ApiResponse({ status: 200, type: BugReportStatsDto })
  async stats(): Promise<BugReportStatsDto> {
    return this.service.stats();
  }

  @Get(':publicId')
  @ApiOperation({ summary: 'Get single bug report by publicId' })
  @ApiResponse({ status: 200, type: BugReportAdminDto })
  async detail(@Param('publicId') publicId: string): Promise<BugReportAdminDto> {
    return this.service.findByPublicId(publicId);
  }

  @Patch(':publicId/status')
  @ApiOperation({
    summary: 'Update status (state-machine validated)',
    description:
      'Allowed transitions: new→triaged|duplicate|wont_fix; triaged→in_progress|duplicate|wont_fix; in_progress→resolved|wont_fix|duplicate; resolved→reopened; reopened→in_progress|wont_fix; wont_fix→reopened. duplicate is terminal.',
  })
  @ApiResponse({ status: 200, type: BugReportAdminDto })
  async updateStatus(
    @Param('publicId') publicId: string,
    @Body() dto: UpdateBugStatusDto,
    @CurrentUser() user: LogtoUser,
  ): Promise<BugReportAdminDto> {
    return this.service.updateStatus(publicId, dto, {
      id: user.userId,
      name: user.name ?? user.username ?? user.email,
    });
  }

  @Patch(':publicId/assignee')
  @ApiOperation({ summary: 'Assign or unassign a bug to an admin' })
  @ApiResponse({ status: 200, type: BugReportAdminDto })
  async updateAssignee(
    @Param('publicId') publicId: string,
    @Body() dto: UpdateBugAssigneeDto,
    @CurrentUser() user: LogtoUser,
  ): Promise<BugReportAdminDto> {
    return this.service.updateAssignee(publicId, dto, {
      id: user.userId,
      name: user.name ?? user.username ?? user.email,
    });
  }

  @Patch(':publicId/triage')
  @ApiOperation({ summary: 'Override severity and/or category' })
  @ApiResponse({ status: 200, type: BugReportAdminDto })
  async updateTriage(
    @Param('publicId') publicId: string,
    @Body() dto: UpdateBugTriageDto,
  ): Promise<BugReportAdminDto> {
    return this.service.updateTriage(publicId, dto);
  }

  @Delete(':publicId')
  @ApiOperation({ summary: 'Soft delete bug report' })
  @ApiResponse({ status: 200, schema: { example: { success: true } } })
  async softDelete(
    @Param('publicId') publicId: string,
  ): Promise<{ success: true }> {
    return this.service.softDelete(publicId);
  }
}
