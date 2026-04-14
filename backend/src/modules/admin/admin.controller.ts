import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { ResolveClaimDto } from './dto/resolve-claim.dto';
import { EditResultDto, ResolveClaimV2Dto } from './dto/edit-result.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('sync-logs')
  @ApiOperation({ summary: 'Get paginated sync logs' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default 1)' })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, description: 'Page size (default 20)' })
  @ApiResponse({ status: 200, description: 'Returns paginated sync logs' })
  async getSyncLogs(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.adminService.getSyncLogs(
      Number(page) || 1,
      Number(pageSize) || 20,
    );
  }

  @Post('races/:raceId/courses/:courseId/force-sync')
  @ApiOperation({ summary: 'Force-sync results for a specific course' })
  @ApiParam({ name: 'raceId', type: 'string' })
  @ApiParam({ name: 'courseId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Sync completed' })
  @ApiResponse({ status: 404, description: 'Race or course not found' })
  async forceSync(
    @Param('raceId') raceId: string,
    @Param('courseId') courseId: string,
  ) {
    return this.adminService.forceSync(raceId, courseId);
  }

  @Post('races/:raceId/courses/:courseId/reset-data')
  @ApiOperation({ summary: 'Delete all results for a course' })
  @ApiParam({ name: 'raceId', type: 'string' })
  @ApiParam({ name: 'courseId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Data reset completed' })
  async resetData(
    @Param('raceId') raceId: string,
    @Param('courseId') courseId: string,
  ) {
    return this.adminService.resetData(raceId, courseId);
  }

  @Get('claims')
  @ApiOperation({ summary: 'List all claims (paginated, optional status filter)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'approved', 'rejected'] })
  @ApiResponse({ status: 200, description: 'Returns paginated claims' })
  async getClaims(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('status') status?: string,
  ) {
    return this.adminService.getClaims(
      Number(page) || 1,
      Number(pageSize) || 20,
      status,
    );
  }

  @Patch('claims/:id/resolve')
  @ApiOperation({ summary: 'Resolve or reject a claim (BR-04)' })
  @ApiParam({ name: 'id', type: 'string', description: 'Claim ID' })
  @ApiResponse({ status: 200, description: 'Claim resolved' })
  @ApiResponse({ status: 404, description: 'Claim not found' })
  @ApiResponse({ status: 409, description: 'Claim already resolved/rejected' })
  async resolveClaimV2(
    @Param('id') id: string,
    @Body() dto: ResolveClaimV2Dto,
    @Request() req: { user?: { userId?: string; sub?: string } },
  ) {
    const adminId = req.user?.userId ?? req.user?.sub ?? 'unknown';
    return this.adminService.resolveClaim(id, dto.action, dto.resolutionNote, adminId);
  }

  @Patch('claims/:id')
  @ApiOperation({ summary: 'Resolve or reject a claim (legacy endpoint)' })
  @ApiParam({ name: 'id', type: 'string', description: 'Claim ID' })
  @ApiResponse({ status: 200, description: 'Claim updated' })
  @ApiResponse({ status: 404, description: 'Claim not found' })
  async resolveClaim(
    @Param('id') id: string,
    @Body() dto: ResolveClaimDto,
  ) {
    const action = dto.status === 'resolved' ? 'approved' : (dto.status as 'approved' | 'rejected');
    return this.adminService.resolveClaim(id, action, dto.adminNote ?? '', 'admin');
  }

  @Patch('race-results/:resultId')
  @ApiOperation({ summary: 'Manually edit a race result with audit trail (BR-03)' })
  @ApiParam({ name: 'resultId', type: 'string', description: 'Result document _id' })
  @ApiResponse({ status: 200, description: 'Result updated with audit log' })
  @ApiResponse({ status: 400, description: 'Validation error (missing reason etc.)' })
  @ApiResponse({ status: 404, description: 'Result not found' })
  async editResult(
    @Param('resultId') resultId: string,
    @Body() dto: EditResultDto,
    @Request() req: { user?: { userId?: string; sub?: string } },
  ) {
    const adminId = req.user?.userId ?? req.user?.sub ?? 'unknown';
    const { reason, ...fields } = dto;
    return this.adminService.editResult(resultId, fields, reason, adminId);
  }

  @Post('cache/purge/:courseId')
  @ApiOperation({ summary: 'Purge Redis cache for a course' })
  @ApiParam({ name: 'courseId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Cache purged' })
  async purgeCache(@Param('courseId') courseId: string) {
    return this.adminService.purgeCache(courseId);
  }
}
