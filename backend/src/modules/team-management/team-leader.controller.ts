import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TeamLeaderService } from './services/team-leader.service';
import type {
  LeaderCheckinBulkSummary,
  LeaderMemberView,
  LeaderPortalResponse,
} from './services/team-leader.service';
import { TeamStationService } from './services/team-station.service';
import {
  AssignableMemberDto,
  AssignmentMemberBriefDto,
  CreateAssignmentDto,
  CreateStationDto,
  StationWithAssignmentSummaryDto,
  UpdateStationDto,
  UpdateStationStatusDto,
} from './dto/station.dto';

const CHECKIN_METHODS = ['qr_scan', 'manual'] as const;

class LeaderCheckinDto {
  @ApiProperty({ type: Number })
  @IsInt()
  member_registration_id!: number;

  @ApiProperty({ enum: CHECKIN_METHODS })
  @IsEnum(CHECKIN_METHODS)
  method!: (typeof CHECKIN_METHODS)[number];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  qr_code?: string;
}

class LeaderConfirmCompletionDto {
  @ApiProperty({ type: Number })
  @IsInt()
  member_registration_id!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class LeaderConfirmCompletionBulkDto {
  @ApiProperty({ type: [Number], maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  member_registration_ids!: number[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/**
 * Public (no JWT) leader portal — authorized by the registration magic
 * token. Every endpoint re-validates the token through
 * TeamLeaderService.validateLeaderToken which enforces four gates:
 *   1. magic_token must exist
 *   2. the owning role.is_leader_role === true
 *   3. event_end_date + 7d hasn't passed
 *   4. per-endpoint cross-event checks for target member_ids
 * Throttler is tighter than admin endpoints because these are unauthenticated.
 */
@ApiTags('Team Management (leader portal)')
@Controller('public/team-leader')
export class TeamLeaderController {
  constructor(
    private readonly leader: TeamLeaderService,
    private readonly stations: TeamStationService,
  ) {}

  @Get(':token/team')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Return the leader portal data: leader info + all members of the same event. CCCD photo URLs are presigned for 1h and access is audit-logged.',
  })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: {
        leader: {
          type: 'object',
          additionalProperties: true,
        },
        members: {
          type: 'array',
          items: { type: 'object', additionalProperties: true },
        },
      },
    },
  })
  async getTeam(@Param('token') token: string): Promise<LeaderPortalResponse> {
    const { registration } = await this.leader.validateLeaderToken(token);
    return this.leader.getTeamMembers(registration);
  }

  @Post(':token/checkin')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Leader checks in a member. Member must be in the same event, status=qr_sent. For qr_scan method, qr_code must match.',
  })
  @ApiResponse({ status: 201 })
  async checkin(
    @Param('token') token: string,
    @Body() dto: LeaderCheckinDto,
  ): Promise<{ success: true; member: LeaderMemberView }> {
    const { registration } = await this.leader.validateLeaderToken(token);
    const updated = await this.leader.leaderCheckin(
      registration,
      dto.member_registration_id,
      dto.method,
      dto.qr_code,
    );
    return {
      success: true,
      member: {
        id: updated.id,
        full_name: updated.full_name,
        phone: updated.phone,
        role_name: updated.role?.role_name ?? '',
        status: updated.status,
        checked_in_at: updated.checked_in_at
          ? updated.checked_in_at.toISOString()
          : null,
        avatar_url: updated.avatar_photo_url,
        id_card_url: null,
        suspicious_checkin: updated.suspicious_checkin === true,
      },
    };
  }

  @Post(':token/confirm-completion')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Leader confirms completion for one member (checked_in → completed). Flags suspicious if worked time < event.min_work_hours_for_completion.',
  })
  @ApiResponse({ status: 201 })
  async confirm(
    @Param('token') token: string,
    @Body() dto: LeaderConfirmCompletionDto,
  ): Promise<{ success: true; suspicious: boolean; member_id: number }> {
    const { registration } = await this.leader.validateLeaderToken(token);
    const { suspicious, member } = await this.leader.confirmCompletion(
      registration,
      dto.member_registration_id,
      dto.note,
    );
    return { success: true, suspicious, member_id: member.id };
  }

  @Post(':token/confirm-completion-bulk')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Bulk confirm — skips (no error) members not in checked_in or wrong event. Returns counts + suspicious tally.',
  })
  @ApiResponse({ status: 201 })
  async confirmBulk(
    @Param('token') token: string,
    @Body() dto: LeaderConfirmCompletionBulkDto,
  ): Promise<LeaderCheckinBulkSummary> {
    const { registration } = await this.leader.validateLeaderToken(token);
    return this.leader.confirmCompletionBulk(
      registration,
      dto.member_registration_ids,
      dto.note,
    );
  }

  // ─────────────────────────────────────────────────────────────
  //  Station management — leader can fully manage stations that
  //  belong to their team(s). All endpoints re-validate the token
  //  and verify the target category/station is within the leader's
  //  managed set (via resolveManagedCategoryIds).
  // ─────────────────────────────────────────────────────────────

  @Get(':token/stations')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'List all stations across all teams managed by this leader. Flat list with assignment summaries.',
  })
  @ApiResponse({ status: 200, type: [StationWithAssignmentSummaryDto] })
  async leaderListStations(
    @Param('token') token: string,
  ): Promise<StationWithAssignmentSummaryDto[]> {
    const { registration } = await this.leader.validateLeaderToken(token);
    const categoryIds = await this.leader.getManagedCategoryIds(registration);
    const all = await Promise.all(
      Array.from(categoryIds).map((cid) =>
        this.stations.listStationsWithSummary(cid),
      ),
    );
    return all.flat();
  }

  @Post(':token/categories/:categoryId/stations')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Create a station under a category that belongs to this leader\'s team.',
  })
  @ApiResponse({ status: 201, type: StationWithAssignmentSummaryDto })
  async leaderCreateStation(
    @Param('token') token: string,
    @Param('categoryId', ParseIntPipe) categoryId: number,
    @Body() dto: CreateStationDto,
  ): Promise<StationWithAssignmentSummaryDto> {
    const { registration } = await this.leader.validateLeaderToken(token);
    await this.leader.assertManagesCategory(registration, categoryId);
    return this.stations.createStation(categoryId, dto);
  }

  @Patch(':token/stations/:stationId')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Update a station owned by this leader\'s team.' })
  @ApiResponse({ status: 200, type: StationWithAssignmentSummaryDto })
  async leaderUpdateStation(
    @Param('token') token: string,
    @Param('stationId', ParseIntPipe) stationId: number,
    @Body() dto: UpdateStationDto,
  ): Promise<StationWithAssignmentSummaryDto> {
    const { registration } = await this.leader.validateLeaderToken(token);
    await this.leader.assertManagesStation(registration, stationId);
    return this.stations.updateStation(stationId, dto);
  }

  @Patch(':token/stations/:stationId/status')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Change station lifecycle status (setup/active/closed).',
  })
  @ApiResponse({ status: 200, type: StationWithAssignmentSummaryDto })
  async leaderUpdateStationStatus(
    @Param('token') token: string,
    @Param('stationId', ParseIntPipe) stationId: number,
    @Body() dto: UpdateStationStatusDto,
  ): Promise<StationWithAssignmentSummaryDto> {
    const { registration } = await this.leader.validateLeaderToken(token);
    await this.leader.assertManagesStation(registration, stationId);
    return this.stations.updateStatus(stationId, dto.status);
  }

  @Delete(':token/stations/:stationId')
  @HttpCode(204)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Delete a station. 409 if any assignments still attached. Station must belong to leader\'s team.',
  })
  @ApiResponse({ status: 204 })
  async leaderDeleteStation(
    @Param('token') token: string,
    @Param('stationId', ParseIntPipe) stationId: number,
  ): Promise<void> {
    const { registration } = await this.leader.validateLeaderToken(token);
    await this.leader.assertManagesStation(registration, stationId);
    await this.stations.deleteStation(stationId);
  }

  @Get(':token/stations/:stationId/assignable-members')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'List members eligible for assignment at this station (same team, approved+, not yet assigned here).',
  })
  @ApiResponse({ status: 200, type: [AssignableMemberDto] })
  async leaderListAssignableMembers(
    @Param('token') token: string,
    @Param('stationId', ParseIntPipe) stationId: number,
  ): Promise<AssignableMemberDto[]> {
    const { registration } = await this.leader.validateLeaderToken(token);
    await this.leader.assertManagesStation(registration, stationId);
    return this.stations.listAssignableMembers(stationId);
  }

  @Post(':token/stations/:stationId/assignments')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Assign a member to a station.' })
  @ApiResponse({ status: 201, type: AssignmentMemberBriefDto })
  async leaderCreateAssignment(
    @Param('token') token: string,
    @Param('stationId', ParseIntPipe) stationId: number,
    @Body() dto: CreateAssignmentDto,
  ): Promise<AssignmentMemberBriefDto> {
    const { registration } = await this.leader.validateLeaderToken(token);
    await this.leader.assertManagesStation(registration, stationId);
    return this.stations.createAssignment(stationId, dto);
  }

  @Delete(':token/station-assignments/:assignmentId')
  @HttpCode(204)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Remove an assignment from a station.' })
  @ApiResponse({ status: 204 })
  async leaderRemoveAssignment(
    @Param('token') token: string,
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
  ): Promise<void> {
    const { registration } = await this.leader.validateLeaderToken(token);
    await this.leader.assertManagesAssignment(registration, assignmentId);
    await this.stations.removeAssignment(assignmentId);
  }
}
