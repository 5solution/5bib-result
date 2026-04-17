import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { resolveScopeTeamId } from '../common/utils/resolve-scope-team.util';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { OpsJwtAuthGuard } from '../common/guards/ops-jwt-auth.guard';
import { OpsRoleGuard } from '../common/guards/ops-role.guard';
import { OpsRoles } from '../common/decorators/ops-roles.decorator';
import { OpsUserCtx } from '../common/decorators/ops-user.decorator';
import { OpsUserContext } from '../common/types/ops-jwt-payload.type';
import { SupplyService } from './supply.service';
import {
  CreateSupplyItemDto,
  CreateSupplyOrderDto,
  RejectSupplyOrderDto,
  SupplyAggregateResponseDto,
  SupplyItemListResponseDto,
  SupplyItemResponseDto,
  SupplyOrderListResponseDto,
  SupplyOrderQueryDto,
  SupplyOrderResponseDto,
  UpdateSupplyItemDto,
  UpdateSupplyOrderItemsDto,
} from './dto/supply.dto';

/* ═══════════ MASTER SKU ═══════════ */

@ApiTags('race-ops/supply-items')
@Controller('race-ops/admin/events/:eventId/supply-items')
@UseGuards(OpsJwtAuthGuard, OpsRoleGuard)
@ApiBearerAuth()
export class SupplyItemsController {
  constructor(private readonly supplyService: SupplyService) {}

  @Post()
  @OpsRoles('ops_admin')
  @ApiOperation({ summary: 'Tạo master SKU cho event' })
  @ApiCreatedResponse({ type: SupplyItemResponseDto })
  create(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Body() dto: CreateSupplyItemDto,
  ): Promise<SupplyItemResponseDto> {
    return this.supplyService.createItem(user.tenant_id, eventId, dto);
  }

  @Get()
  @OpsRoles('ops_admin', 'ops_leader')
  @ApiOperation({ summary: 'Danh sách master SKU' })
  @ApiOkResponse({ type: SupplyItemListResponseDto })
  @ApiQuery({ name: 'category', required: false })
  list(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Query('category') category?: string,
  ): Promise<SupplyItemListResponseDto> {
    return this.supplyService.listItems(user.tenant_id, eventId, category);
  }

  @Patch(':itemId')
  @OpsRoles('ops_admin')
  @ApiOperation({ summary: 'Update master SKU' })
  @ApiOkResponse({ type: SupplyItemResponseDto })
  update(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateSupplyItemDto,
  ): Promise<SupplyItemResponseDto> {
    return this.supplyService.updateItem(
      user.tenant_id,
      eventId,
      itemId,
      dto,
    );
  }

  @Delete(':itemId')
  @OpsRoles('ops_admin')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft-delete master SKU' })
  @ApiNoContentResponse()
  async remove(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Param('itemId') itemId: string,
  ): Promise<void> {
    await this.supplyService.deleteItem(user.tenant_id, eventId, itemId);
  }
}

/* ═══════════ SUPPLY ORDERS ═══════════ */

/**
 * BR-02 enforcement moved to `common/utils/resolve-scope-team.util.ts` để
 * applications.controller.ts có thể reuse cùng logic (tránh lệch policy giữa
 * supply và applications modules).
 */

@ApiTags('race-ops/supply-orders')
@Controller('race-ops/admin/events/:eventId/supply-orders')
@UseGuards(OpsJwtAuthGuard, OpsRoleGuard)
@ApiBearerAuth()
export class SupplyOrdersController {
  constructor(private readonly supplyService: SupplyService) {}

  @Post()
  @OpsRoles('ops_admin', 'ops_leader')
  @ApiOperation({ summary: 'Tạo supply order (DRAFT)' })
  @ApiCreatedResponse({ type: SupplyOrderResponseDto })
  create(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Body() dto: CreateSupplyOrderDto,
    @Req() req: Request,
  ): Promise<SupplyOrderResponseDto> {
    // BR-02: Leader chỉ được tạo order cho team mình (không để leader gán team_id khác).
    if (user.role !== 'ops_admin') {
      const scopeTeamId = resolveScopeTeamId(user);
      if (scopeTeamId && dto.team_id !== scopeTeamId) {
        throw new ForbiddenException(
          'Leader can only create orders for their own team',
        );
      }
    }
    return this.supplyService.createOrder(
      user.tenant_id,
      eventId,
      user.userId,
      dto,
      req,
    );
  }

  @Get()
  @OpsRoles('ops_admin', 'ops_leader')
  @ApiOperation({
    summary:
      'Danh sách supply orders — leader chỉ thấy order team mình (BR-02)',
  })
  @ApiOkResponse({ type: SupplyOrderListResponseDto })
  list(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Query() query: SupplyOrderQueryDto,
  ): Promise<SupplyOrderListResponseDto> {
    // BR-02: leader scope to own team; leader without team_id → 403
    const scopeTeamId = resolveScopeTeamId(user);
    return this.supplyService.listOrders(
      user.tenant_id,
      eventId,
      query,
      scopeTeamId,
    );
  }

  @Get('aggregate')
  @OpsRoles('ops_admin')
  @ApiOperation({
    summary: 'Aggregate tổng vật tư across all teams (admin dashboard)',
  })
  @ApiOkResponse({ type: SupplyAggregateResponseDto })
  aggregate(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
  ): Promise<SupplyAggregateResponseDto> {
    return this.supplyService.aggregate(user.tenant_id, eventId);
  }

  @Get(':orderId')
  @OpsRoles('ops_admin', 'ops_leader')
  @ApiOperation({ summary: 'Chi tiết supply order' })
  @ApiOkResponse({ type: SupplyOrderResponseDto })
  getOne(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Param('orderId') orderId: string,
  ): Promise<SupplyOrderResponseDto> {
    const scopeTeamId = resolveScopeTeamId(user);
    return this.supplyService.findOrder(
      user.tenant_id,
      eventId,
      orderId,
      scopeTeamId,
    );
  }

  @Patch(':orderId/items')
  @OpsRoles('ops_admin', 'ops_leader')
  @ApiOperation({ summary: 'Edit items (chỉ khi DRAFT)' })
  @ApiOkResponse({ type: SupplyOrderResponseDto })
  updateItems(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateSupplyOrderItemsDto,
  ): Promise<SupplyOrderResponseDto> {
    const scopeTeamId = resolveScopeTeamId(user);
    return this.supplyService.updateOrderItems(
      user.tenant_id,
      eventId,
      orderId,
      dto,
      scopeTeamId,
    );
  }

  @Patch(':orderId/submit')
  @OpsRoles('ops_admin', 'ops_leader')
  @ApiOperation({ summary: 'Submit order (DRAFT → SUBMITTED)' })
  @ApiOkResponse({ type: SupplyOrderResponseDto })
  submit(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Param('orderId') orderId: string,
    @Req() req: Request,
  ): Promise<SupplyOrderResponseDto> {
    const scopeTeamId = resolveScopeTeamId(user);
    return this.supplyService.submitOrder(
      user.tenant_id,
      eventId,
      orderId,
      user.userId,
      req,
      scopeTeamId,
    );
  }

  @Patch(':orderId/approve')
  @OpsRoles('ops_admin')
  @ApiOperation({ summary: 'Approve order (SUBMITTED → APPROVED)' })
  @ApiOkResponse({ type: SupplyOrderResponseDto })
  approve(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Param('orderId') orderId: string,
    @Req() req: Request,
  ): Promise<SupplyOrderResponseDto> {
    return this.supplyService.approveOrder(
      user.tenant_id,
      eventId,
      orderId,
      user.userId,
      req,
    );
  }

  @Patch(':orderId/reject')
  @OpsRoles('ops_admin')
  @ApiOperation({ summary: 'Reject order (SUBMITTED → REJECTED)' })
  @ApiOkResponse({ type: SupplyOrderResponseDto })
  reject(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Param('orderId') orderId: string,
    @Body() dto: RejectSupplyOrderDto,
    @Req() req: Request,
  ): Promise<SupplyOrderResponseDto> {
    return this.supplyService.rejectOrder(
      user.tenant_id,
      eventId,
      orderId,
      user.userId,
      dto,
      req,
    );
  }

  @Patch(':orderId/dispatch')
  @OpsRoles('ops_admin')
  @ApiOperation({ summary: 'Dispatch order (APPROVED → DISPATCHED)' })
  @ApiOkResponse({ type: SupplyOrderResponseDto })
  dispatch(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Param('orderId') orderId: string,
    @Req() req: Request,
  ): Promise<SupplyOrderResponseDto> {
    return this.supplyService.dispatchOrder(
      user.tenant_id,
      eventId,
      orderId,
      user.userId,
      req,
    );
  }

  @Patch(':orderId/receive')
  @OpsRoles('ops_admin', 'ops_leader')
  @ApiOperation({ summary: 'Receive order (DISPATCHED → RECEIVED)' })
  @ApiOkResponse({ type: SupplyOrderResponseDto })
  receive(
    @OpsUserCtx() user: OpsUserContext,
    @Param('eventId') eventId: string,
    @Param('orderId') orderId: string,
    @Req() req: Request,
  ): Promise<SupplyOrderResponseDto> {
    const scopeTeamId = resolveScopeTeamId(user);
    return this.supplyService.receiveOrder(
      user.tenant_id,
      eventId,
      orderId,
      user.userId,
      req,
      scopeTeamId,
    );
  }
}
