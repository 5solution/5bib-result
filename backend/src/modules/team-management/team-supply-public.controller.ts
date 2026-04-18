import { Body, Controller, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  AllocationRowDto,
  ConfirmSupplementDto,
  ConfirmSupplyDto,
  CreateSupplementDto,
  LeaderSupplyViewDto,
  SupplementRowDto,
  SupplyPlanRowDto,
  UpsertAllocationDto,
  UpsertSupplyPlanRequestDto,
} from './dto/supply.dto';
import { TeamSupplyAllocationService } from './services/team-supply-allocation.service';
import { TeamSupplyPlanService } from './services/team-supply-plan.service';
import { TeamSupplySupplementService } from './services/team-supply-supplement.service';
import { TeamSupplyLeaderService } from './services/team-supply-leader.service';

/**
 * v1.6 Supply public endpoints — no JWT, authorized by the registration
 * magic token in the URL path. Each endpoint re-validates the token at
 * the service layer and enforces role-based gates:
 *
 *  - confirm-supply / confirm-supplement: crew gate
 *    (`assignment_role === 'crew'`)
 *  - supply-plan / upsertRequest / allocations / supplements: leader gate
 *    (`role.is_leader_role === true` AND resource role_id matches)
 */
@ApiTags('Team Management (supply — public)')
@Controller('public/team-registration')
export class TeamSupplyPublicController {
  constructor(
    private readonly allocations: TeamSupplyAllocationService,
    private readonly plans: TeamSupplyPlanService,
    private readonly supplements: TeamSupplySupplementService,
    private readonly leaderSupply: TeamSupplyLeaderService,
  ) {}

  // ---- crew endpoints ----

  @Post(':token/station/confirm-supply')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Crew confirms receipt of allocated supply at their station. Sets confirmed_qty + is_locked=TRUE.',
  })
  @ApiResponse({ status: 201, type: [AllocationRowDto] })
  confirmSupply(
    @Param('token') token: string,
    @Body() dto: ConfirmSupplyDto,
  ): Promise<AllocationRowDto[]> {
    return this.allocations.confirmSupply(token, dto);
  }

  @Post(':token/station/confirm-supplement')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Crew confirms a supplement round at their station.',
  })
  @ApiResponse({ status: 201, type: SupplementRowDto })
  confirmSupplement(
    @Param('token') token: string,
    @Body() dto: ConfirmSupplementDto,
  ): Promise<SupplementRowDto> {
    return this.supplements.confirmSupplement(
      token,
      dto.supplement_id,
      dto.confirmed_qty,
      dto.note ?? null,
    );
  }

  // ---- leader endpoints ----

  @Get(':token/supply-plan')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Leader supply view — plan + per-station allocations + supplements for the leader\'s role.',
  })
  @ApiResponse({ status: 200, type: LeaderSupplyViewDto })
  getLeaderSupplyView(
    @Param('token') token: string,
  ): Promise<LeaderSupplyViewDto> {
    return this.leaderSupply.getLeaderSupplyView(token);
  }

  @Put(':token/supply-plan/request')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Leader upserts requested_qty + request_note for a specific managed role (v1.6 Option B2 — nested).',
  })
  @ApiResponse({ status: 200, type: [SupplyPlanRowDto] })
  async upsertRequest(
    @Param('token') token: string,
    @Body() dto: UpsertSupplyPlanRequestDto & { target_role_id?: number },
  ): Promise<SupplyPlanRowDto[]> {
    const leader = await this.leaderSupply.validateLeaderToken(token);
    // v1.6 Option B2: nested — leader may manage multiple roles. Client
    // MUST specify which one this plan-write targets (`target_role_id`).
    // Fallback: if caller omits it (legacy v1.6-Option-A client), pick the
    // first role in the BFS set — keeps backward compat for single-managed
    // leaders. Service re-validates membership before writing.
    const managed = await this.leaderSupply.resolveManagedRoleIds(leader);
    const targetRoleId =
      dto.target_role_id && managed.has(dto.target_role_id)
        ? dto.target_role_id
        : Array.from(managed)[0];
    return this.plans.upsertRequest(
      leader.event_id,
      targetRoleId,
      dto,
      leader.role_id,
    );
  }

  @Put(':token/stations/:stationId/allocations')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Leader bulk upsert allocations for a station of the MANAGED role (v1.6). Service enforces cross-station sum ≤ fulfilled_qty.',
  })
  @ApiResponse({ status: 200, type: [AllocationRowDto] })
  async upsertAllocations(
    @Param('token') token: string,
    @Param('stationId', ParseIntPipe) stationId: number,
    @Body() dto: UpsertAllocationDto,
  ): Promise<AllocationRowDto[]> {
    const leader = await this.leaderSupply.validateLeaderToken(token);
    // Pass the leader's OWN role_id as actor; service BFS-resolves the
    // managed hierarchy and checks station.role_id ∈ managed set.
    return this.allocations.upsertAllocationsForStation(
      stationId,
      dto,
      leader.role_id,
    );
  }

  @Post(':token/supply-allocations/:allocationId/supplements')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Leader creates a supplement round on an allocation. Allocation must already be is_locked=TRUE.',
  })
  @ApiResponse({ status: 201, type: SupplementRowDto })
  async createSupplement(
    @Param('token') token: string,
    @Param('allocationId', ParseIntPipe) allocationId: number,
    @Body() dto: CreateSupplementDto,
  ): Promise<SupplementRowDto> {
    const leader = await this.leaderSupply.validateLeaderToken(token);
    return this.supplements.createSupplement(
      allocationId,
      dto.qty,
      dto.note ?? null,
      leader.role_id,
    );
  }
}
