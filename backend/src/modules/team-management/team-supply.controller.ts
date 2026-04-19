import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
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
import {
  AllocationRowDto,
  CreateSupplementDto,
  CreateSupplyItemDto,
  EventSupplyOverviewDto,
  SupplementRowDto,
  SupplyItemDto,
  SupplyPlanRowDto,
  UnlockAllocationDto,
  UpdateSupplyItemDto,
  UpsertAllocationDto,
  UpsertSupplyPlanFulfillDto,
  UpsertSupplyPlanRequestDto,
} from './dto/supply.dto';
import { TeamSupplyItemService } from './services/team-supply-item.service';
import { TeamSupplyPlanService } from './services/team-supply-plan.service';
import { TeamSupplyAllocationService } from './services/team-supply-allocation.service';
import { TeamSupplySupplementService } from './services/team-supply-supplement.service';

interface JwtRequest extends Request {
  user?: { username?: string; email?: string; sub?: string };
}

function identifyAdmin(req: JwtRequest): string {
  return req.user?.username ?? req.user?.email ?? req.user?.sub ?? 'admin';
}

/**
 * v1.6 Supply admin endpoints — all guarded by JwtAuthGuard.
 * Admin calls pass `actorRoleId=null` into services so the leader-gate
 * checks are skipped.
 */
@ApiTags('Team Management (supply)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('team-management')
export class TeamSupplyController {
  constructor(
    private readonly items: TeamSupplyItemService,
    private readonly plans: TeamSupplyPlanService,
    private readonly allocations: TeamSupplyAllocationService,
    private readonly supplements: TeamSupplySupplementService,
  ) {}

  // ---- items ----

  @Get('events/:eventId/supply-items')
  @ApiOperation({ summary: 'List supply items for an event' })
  @ApiResponse({ status: 200, type: [SupplyItemDto] })
  listItems(
    @Param('eventId', ParseIntPipe) eventId: number,
  ): Promise<SupplyItemDto[]> {
    return this.items.listItems(eventId);
  }

  @Post('events/:eventId/supply-items')
  @ApiOperation({
    summary:
      'Create a supply item. Admin may set created_by_role_id=null (admin-owned) or assign to a leader role.',
  })
  @ApiResponse({ status: 201, type: SupplyItemDto })
  createItem(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() dto: CreateSupplyItemDto,
  ): Promise<SupplyItemDto> {
    // Admin path — actorRoleId=null. DTO's created_by_role_id is honored.
    return this.items.createItem(eventId, dto, null);
  }

  @Patch('supply-items/:id')
  @ApiOperation({ summary: 'Update a supply item (admin can edit any)' })
  @ApiResponse({ status: 200, type: SupplyItemDto })
  updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSupplyItemDto,
  ): Promise<SupplyItemDto> {
    return this.items.updateItem(id, dto, null);
  }

  @Delete('supply-items/:id')
  @ApiOperation({
    summary:
      'Delete a supply item. Rejects with 409 if any plan/allocation references it.',
  })
  @ApiResponse({ status: 204 })
  async deleteItem(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.items.deleteItem(id, null);
  }

  // ---- plan ----

  @Get('events/:eventId/team-categories/:categoryId/supply-plan')
  @ApiOperation({
    summary:
      'v1.8 — Get supply plan for a Team (category). Rows cover every item in the event.',
  })
  @ApiResponse({ status: 200, type: [SupplyPlanRowDto] })
  getPlan(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Param('categoryId', ParseIntPipe) categoryId: number,
  ): Promise<SupplyPlanRowDto[]> {
    return this.plans.getPlanForRole(eventId, categoryId);
  }

  @Put('events/:eventId/team-categories/:categoryId/supply-plan/request')
  @ApiOperation({
    summary:
      'v1.8 — Admin-on-behalf-of-leader upsert of request_qty for a Team. Bulk atomic by item_id (INSERT … ON DUPLICATE KEY UPDATE).',
  })
  @ApiResponse({ status: 200, type: [SupplyPlanRowDto] })
  upsertRequest(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Param('categoryId', ParseIntPipe) categoryId: number,
    @Body() dto: UpsertSupplyPlanRequestDto,
  ): Promise<SupplyPlanRowDto[]> {
    return this.plans.upsertRequest(eventId, categoryId, dto, null);
  }

  @Put('events/:eventId/team-categories/:categoryId/supply-plan/fulfill')
  @ApiOperation({
    summary:
      'v1.8 — Admin upsert of fulfilled_qty for a Team. Bulk atomic by item_id.',
  })
  @ApiResponse({ status: 200, type: [SupplyPlanRowDto] })
  upsertFulfill(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Param('categoryId', ParseIntPipe) categoryId: number,
    @Body() dto: UpsertSupplyPlanFulfillDto,
  ): Promise<SupplyPlanRowDto[]> {
    return this.plans.upsertFulfill(eventId, categoryId, dto);
  }

  @Get('events/:eventId/supply-overview')
  @ApiOperation({
    summary:
      'Matrix view (items × roles) with plan + SUM(allocated) + SUM(confirmed).',
  })
  @ApiResponse({ status: 200, type: EventSupplyOverviewDto })
  getOverview(
    @Param('eventId', ParseIntPipe) eventId: number,
  ): Promise<EventSupplyOverviewDto> {
    return this.plans.getEventOverview(eventId);
  }

  // ---- allocations ----

  @Get('stations/:stationId/allocations')
  @ApiOperation({ summary: 'List allocations for a station' })
  @ApiResponse({ status: 200, type: [AllocationRowDto] })
  getAllocations(
    @Param('stationId', ParseIntPipe) stationId: number,
  ): Promise<AllocationRowDto[]> {
    return this.allocations.getAllocationsForStation(stationId);
  }

  @Put('stations/:stationId/allocations')
  @ApiOperation({
    summary:
      'Bulk upsert allocations for a station. Rejects if SUM exceeds role.fulfilled_qty or any row is_locked.',
  })
  @ApiResponse({ status: 200, type: [AllocationRowDto] })
  upsertAllocations(
    @Param('stationId', ParseIntPipe) stationId: number,
    @Body() dto: UpsertAllocationDto,
  ): Promise<AllocationRowDto[]> {
    return this.allocations.upsertAllocationsForStation(stationId, dto, null);
  }

  @Patch('supply-allocations/:id/unlock')
  @ApiOperation({
    summary:
      'Unlock a crew-confirmed allocation so leader can edit. admin_note required.',
  })
  @ApiResponse({ status: 200, type: AllocationRowDto })
  unlockAllocation(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UnlockAllocationDto,
    @Req() req: JwtRequest,
  ): Promise<AllocationRowDto> {
    return this.allocations.unlockAllocation(id, identifyAdmin(req), dto);
  }

  // ---- supplements (admin-on-behalf) ----

  @Get('supply-allocations/:id/supplements')
  @ApiOperation({ summary: 'List supplement rounds for an allocation' })
  @ApiResponse({ status: 200, type: [SupplementRowDto] })
  listSupplements(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<SupplementRowDto[]> {
    return this.supplements.listSupplementsForAllocation(id);
  }

  @Post('supply-allocations/:id/supplements')
  @ApiOperation({
    summary:
      'Admin creates a supplement round on behalf of leader. Requires allocation to be is_locked=true.',
  })
  @ApiResponse({ status: 201, type: SupplementRowDto })
  createSupplement(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateSupplementDto,
  ): Promise<SupplementRowDto> {
    return this.supplements.createSupplement(id, dto.qty, dto.note ?? null, null);
  }
}
