import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import { Request } from 'express';
import {
  OpsSupplyItem,
  OpsSupplyItemDocument,
} from '../schemas/ops-supply-item.schema';
import {
  OpsSupplyOrder,
  OpsSupplyOrderDocument,
} from '../schemas/ops-supply-order.schema';
import { OpsTeam, OpsTeamDocument } from '../schemas/ops-team.schema';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../common/constants';
import { genOrderCode } from '../common/utils/order-code.util';
import { EventsService } from '../events/events.service';
import {
  CreateSupplyItemDto,
  CreateSupplyOrderDto,
  RejectSupplyOrderDto,
  SupplyAggregateLineDto,
  SupplyAggregateResponseDto,
  SupplyItemListResponseDto,
  SupplyItemResponseDto,
  SupplyOrderListResponseDto,
  SupplyOrderQueryDto,
  SupplyOrderResponseDto,
  UpdateSupplyItemDto,
  UpdateSupplyOrderItemsDto,
} from './dto/supply.dto';

@Injectable()
export class SupplyService {
  constructor(
    @InjectModel(OpsSupplyItem.name)
    private readonly itemModel: Model<OpsSupplyItemDocument>,
    @InjectModel(OpsSupplyOrder.name)
    private readonly orderModel: Model<OpsSupplyOrderDocument>,
    @InjectModel(OpsTeam.name)
    private readonly teamModel: Model<OpsTeamDocument>,
    private readonly eventsService: EventsService,
    private readonly auditService: AuditService,
  ) {}

  /* ═══════════ MASTER SKU ═══════════ */

  async createItem(
    tenantId: string,
    eventId: string,
    dto: CreateSupplyItemDto,
  ): Promise<SupplyItemResponseDto> {
    const event = await this.eventsService.findEntity(tenantId, eventId);
    const existing = await this.itemModel
      .findOne({
        event_id: event._id,
        sku: dto.sku,
        deleted_at: null,
      })
      .lean();
    if (existing) {
      throw new ConflictException(`SKU "${dto.sku}" already exists`);
    }
    const doc = await this.itemModel.create({
      event_id: event._id,
      ...dto,
    });
    return this.toItemResponse(doc);
  }

  async listItems(
    tenantId: string,
    eventId: string,
    category?: string,
  ): Promise<SupplyItemListResponseDto> {
    const event = await this.eventsService.findEntity(tenantId, eventId);
    const filter: Record<string, unknown> = {
      event_id: event._id,
      deleted_at: null,
    };
    if (category) filter.category = category;

    const items = await this.itemModel
      .find(filter)
      .sort({ category: 1, sku: 1 })
      .lean();
    return {
      items: items.map((i) => this.toItemResponse(i)),
      total: items.length,
    };
  }

  async updateItem(
    tenantId: string,
    eventId: string,
    itemId: string,
    dto: UpdateSupplyItemDto,
  ): Promise<SupplyItemResponseDto> {
    const event = await this.eventsService.findEntity(tenantId, eventId);
    if (!Types.ObjectId.isValid(itemId))
      throw new NotFoundException('Item not found');
    const doc = await this.itemModel.findOne({
      _id: new Types.ObjectId(itemId),
      event_id: event._id,
      deleted_at: null,
    });
    if (!doc) throw new NotFoundException('Item not found');

    if (dto.sku && dto.sku !== doc.sku) {
      const conflict = await this.itemModel
        .findOne({
          event_id: event._id,
          sku: dto.sku,
          _id: { $ne: doc._id },
          deleted_at: null,
        })
        .lean();
      if (conflict) throw new ConflictException(`SKU "${dto.sku}" in use`);
    }

    const patch: Record<string, unknown> = {};
    for (const key of [
      'sku',
      'name',
      'description',
      'unit',
      'category',
      'default_price',
    ] as const) {
      if ((dto as Record<string, unknown>)[key] !== undefined)
        patch[key] = (dto as Record<string, unknown>)[key];
    }
    await this.itemModel.updateOne({ _id: doc._id }, { $set: patch });
    const fresh = await this.itemModel.findById(doc._id).lean();
    if (!fresh) throw new NotFoundException('Item disappeared');
    return this.toItemResponse(fresh);
  }

  async deleteItem(
    tenantId: string,
    eventId: string,
    itemId: string,
  ): Promise<void> {
    const event = await this.eventsService.findEntity(tenantId, eventId);
    if (!Types.ObjectId.isValid(itemId))
      throw new NotFoundException('Item not found');
    const result = await this.itemModel.updateOne(
      {
        _id: new Types.ObjectId(itemId),
        event_id: event._id,
        deleted_at: null,
      },
      { $set: { deleted_at: new Date() } },
    );
    if (result.modifiedCount === 0)
      throw new NotFoundException('Item not found');
  }

  /* ═══════════ SUPPLY ORDERS ═══════════ */

  async createOrder(
    tenantId: string,
    eventId: string,
    createdBy: string,
    dto: CreateSupplyOrderDto,
    request?: Request,
  ): Promise<SupplyOrderResponseDto> {
    const event = await this.eventsService.findEntity(tenantId, eventId);
    const team = await this.teamModel
      .findOne({
        _id: new Types.ObjectId(dto.team_id),
        event_id: event._id,
        deleted_at: null,
      })
      .lean();
    if (!team) throw new NotFoundException('Team not found');

    // Resolve SKU snapshots
    const skus = dto.items.map((i) => i.sku);
    const masterItems = await this.itemModel
      .find({
        event_id: event._id,
        sku: { $in: skus },
        deleted_at: null,
      })
      .lean();
    const skuMap = new Map(masterItems.map((m) => [m.sku, m]));

    const orderItems = dto.items.map((line) => {
      const master = skuMap.get(line.sku);
      if (!master) {
        throw new BadRequestException(`SKU "${line.sku}" not found`);
      }
      return {
        sku: master.sku,
        name: master.name, // snapshot
        unit: master.unit, // snapshot
        quantity: line.quantity,
        note: line.note,
      };
    });

    // R5: retry-on-E11000 vì order_code là random 4-digit seq có thể trùng khi
    // 2 leader cùng team submit concurrent. Thử tối đa 5 lần rồi bail out.
    const MAX_ATTEMPTS = 5;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const orderCode = genOrderCode(team.code);
      try {
        const created = await this.orderModel.create({
          event_id: event._id,
          team_id: team._id,
          order_code: orderCode,
          created_by: new Types.ObjectId(createdBy),
          items: orderItems,
          status: 'DRAFT',
        });
        return this.toOrderResponse(created);
      } catch (err) {
        const mongoErr = err as {
          code?: number;
          keyPattern?: Record<string, unknown>;
        };
        const isDup =
          mongoErr?.code === 11000 &&
          (mongoErr.keyPattern?.order_code !== undefined ||
            // legacy global index path — also retry
            Object.keys(mongoErr.keyPattern ?? {}).includes('order_code'));
        if (!isDup) throw err;
        // loop: regenerate code and retry
      }
    }
    throw new ConflictException(
      'Unable to generate unique order code after retries — please retry',
    );
  }

  async listOrders(
    tenantId: string,
    eventId: string,
    query: SupplyOrderQueryDto,
    /** Nếu có team scope (BR-02): chỉ thấy order của team mình */
    scopeTeamId?: string,
  ): Promise<SupplyOrderListResponseDto> {
    const event = await this.eventsService.findEntity(tenantId, eventId);
    const filter: Record<string, unknown> = {
      event_id: event._id,
      deleted_at: null,
    };
    if (query.status) filter.status = query.status;
    if (scopeTeamId) {
      filter.team_id = new Types.ObjectId(scopeTeamId);
    } else if (query.team_id) {
      filter.team_id = new Types.ObjectId(query.team_id);
    }

    const [items, total] = await Promise.all([
      this.orderModel.find(filter).sort({ created_at: -1 }).lean(),
      this.orderModel.countDocuments(filter),
    ]);
    return {
      items: items.map((o) => this.toOrderResponse(o)),
      total,
    };
  }

  async findOrder(
    tenantId: string,
    eventId: string,
    orderId: string,
    scopeTeamId?: string,
  ): Promise<SupplyOrderResponseDto> {
    const doc = await this.findOrderEntity(
      tenantId,
      eventId,
      orderId,
      scopeTeamId,
    );
    return this.toOrderResponse(doc);
  }

  /** DRAFT → SUBMITTED */
  async submitOrder(
    tenantId: string,
    eventId: string,
    orderId: string,
    userId: string,
    request?: Request,
    scopeTeamId?: string,
  ): Promise<SupplyOrderResponseDto> {
    const doc = await this.findOrderEntity(
      tenantId,
      eventId,
      orderId,
      scopeTeamId,
    );
    this.assertOrderTransition(doc.status, 'SUBMITTED');

    await this.orderModel.updateOne(
      { _id: doc._id },
      { $set: { status: 'SUBMITTED', submitted_at: new Date() } },
    );

    await this.auditService.log({
      event_id: doc.event_id,
      user_id: userId,
      action: AUDIT_ACTIONS.SUBMIT_SUPPLY_ORDER,
      entity_type: 'ops_supply_orders',
      entity_id: doc._id,
      from_state: doc.status,
      to_state: 'SUBMITTED',
      payload: { order_code: doc.order_code },
      request,
    });

    const fresh = await this.orderModel.findById(doc._id).lean();
    if (!fresh) throw new NotFoundException('Order disappeared');
    return this.toOrderResponse(fresh);
  }

  /** SUBMITTED → APPROVED (admin only) */
  async approveOrder(
    tenantId: string,
    eventId: string,
    orderId: string,
    userId: string,
    request?: Request,
  ): Promise<SupplyOrderResponseDto> {
    const doc = await this.findOrderEntity(tenantId, eventId, orderId);
    this.assertOrderTransition(doc.status, 'APPROVED');

    await this.orderModel.updateOne(
      { _id: doc._id },
      {
        $set: {
          status: 'APPROVED',
          approved_at: new Date(),
          approved_by: new Types.ObjectId(userId),
        },
      },
    );

    await this.auditService.log({
      event_id: doc.event_id,
      user_id: userId,
      action: AUDIT_ACTIONS.APPROVE_SUPPLY_ORDER,
      entity_type: 'ops_supply_orders',
      entity_id: doc._id,
      from_state: doc.status,
      to_state: 'APPROVED',
      payload: { order_code: doc.order_code },
      request,
    });

    const fresh = await this.orderModel.findById(doc._id).lean();
    if (!fresh) throw new NotFoundException('Order disappeared');
    return this.toOrderResponse(fresh);
  }

  /** SUBMITTED → REJECTED (admin only) */
  async rejectOrder(
    tenantId: string,
    eventId: string,
    orderId: string,
    userId: string,
    dto: RejectSupplyOrderDto,
    request?: Request,
  ): Promise<SupplyOrderResponseDto> {
    const doc = await this.findOrderEntity(tenantId, eventId, orderId);
    this.assertOrderTransition(doc.status, 'REJECTED');

    await this.orderModel.updateOne(
      { _id: doc._id },
      {
        $set: {
          status: 'REJECTED',
          rejected_reason: dto.reason,
        },
      },
    );

    await this.auditService.log({
      event_id: doc.event_id,
      user_id: userId,
      action: AUDIT_ACTIONS.REJECT_SUPPLY_ORDER,
      entity_type: 'ops_supply_orders',
      entity_id: doc._id,
      from_state: doc.status,
      to_state: 'REJECTED',
      payload: { order_code: doc.order_code, reason: dto.reason },
      request,
    });

    const fresh = await this.orderModel.findById(doc._id).lean();
    if (!fresh) throw new NotFoundException('Order disappeared');
    return this.toOrderResponse(fresh);
  }

  /** APPROVED → DISPATCHED */
  async dispatchOrder(
    tenantId: string,
    eventId: string,
    orderId: string,
    userId: string,
    request?: Request,
  ): Promise<SupplyOrderResponseDto> {
    const doc = await this.findOrderEntity(tenantId, eventId, orderId);
    this.assertOrderTransition(doc.status, 'DISPATCHED');

    await this.orderModel.updateOne(
      { _id: doc._id },
      {
        $set: {
          status: 'DISPATCHED',
          dispatched_at: new Date(),
          dispatched_by: new Types.ObjectId(userId),
        },
      },
    );

    await this.auditService.log({
      event_id: doc.event_id,
      user_id: userId,
      action: AUDIT_ACTIONS.DISPATCH_SUPPLY_ORDER,
      entity_type: 'ops_supply_orders',
      entity_id: doc._id,
      from_state: doc.status,
      to_state: 'DISPATCHED',
      payload: { order_code: doc.order_code },
      request,
    });

    const fresh = await this.orderModel.findById(doc._id).lean();
    if (!fresh) throw new NotFoundException('Order disappeared');
    return this.toOrderResponse(fresh);
  }

  /** DISPATCHED → RECEIVED */
  async receiveOrder(
    tenantId: string,
    eventId: string,
    orderId: string,
    userId: string,
    request?: Request,
    scopeTeamId?: string,
  ): Promise<SupplyOrderResponseDto> {
    const doc = await this.findOrderEntity(
      tenantId,
      eventId,
      orderId,
      scopeTeamId,
    );
    this.assertOrderTransition(doc.status, 'RECEIVED');

    await this.orderModel.updateOne(
      { _id: doc._id },
      {
        $set: {
          status: 'RECEIVED',
          received_at: new Date(),
          received_by: new Types.ObjectId(userId),
        },
      },
    );

    await this.auditService.log({
      event_id: doc.event_id,
      user_id: userId,
      action: AUDIT_ACTIONS.RECEIVE_SUPPLY_ORDER,
      entity_type: 'ops_supply_orders',
      entity_id: doc._id,
      from_state: doc.status,
      to_state: 'RECEIVED',
      payload: { order_code: doc.order_code },
      request,
    });

    const fresh = await this.orderModel.findById(doc._id).lean();
    if (!fresh) throw new NotFoundException('Order disappeared');
    return this.toOrderResponse(fresh);
  }

  /** Edit items khi order vẫn DRAFT */
  async updateOrderItems(
    tenantId: string,
    eventId: string,
    orderId: string,
    dto: UpdateSupplyOrderItemsDto,
    scopeTeamId?: string,
  ): Promise<SupplyOrderResponseDto> {
    const event = await this.eventsService.findEntity(tenantId, eventId);
    const doc = await this.findOrderEntity(
      tenantId,
      eventId,
      orderId,
      scopeTeamId,
    );
    if (doc.status !== 'DRAFT') {
      throw new ForbiddenException('Can only edit items in DRAFT status');
    }

    const skus = dto.items.map((i) => i.sku);
    const masterItems = await this.itemModel
      .find({ event_id: event._id, sku: { $in: skus }, deleted_at: null })
      .lean();
    const skuMap = new Map(masterItems.map((m) => [m.sku, m]));

    const orderItems = dto.items.map((line) => {
      const master = skuMap.get(line.sku);
      if (!master) throw new BadRequestException(`SKU "${line.sku}" not found`);
      return {
        sku: master.sku,
        name: master.name,
        unit: master.unit,
        quantity: line.quantity,
        note: line.note,
      };
    });

    await this.orderModel.updateOne(
      { _id: doc._id },
      { $set: { items: orderItems } },
    );

    const fresh = await this.orderModel.findById(doc._id).lean();
    if (!fresh) throw new NotFoundException('Order disappeared');
    return this.toOrderResponse(fresh);
  }

  /* ═══════════ AGGREGATE ═══════════ */

  async aggregate(
    tenantId: string,
    eventId: string,
  ): Promise<SupplyAggregateResponseDto> {
    const event = await this.eventsService.findEntity(tenantId, eventId);

    // Pipeline: group by sku across all SUBMITTED + APPROVED+ orders
    const pipeline: PipelineStage[] = [
      {
        $match: {
          event_id: event._id,
          deleted_at: null,
          status: {
            $in: ['SUBMITTED', 'APPROVED', 'DISPATCHED', 'RECEIVED'],
          },
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.sku',
          name: { $first: '$items.name' },
          unit: { $first: '$items.unit' },
          total_approved: {
            $sum: {
              $cond: [
                {
                  $in: [
                    '$status',
                    ['APPROVED', 'DISPATCHED', 'RECEIVED'],
                  ],
                },
                '$items.quantity',
                0,
              ],
            },
          },
          total_pending: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'SUBMITTED'] },
                '$items.quantity',
                0,
              ],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const results = await this.orderModel.aggregate(pipeline);

    // Enrich with category from master
    const skus = results.map((r: { _id: string }) => r._id);
    const masterItems = await this.itemModel
      .find({
        event_id: event._id,
        sku: { $in: skus },
        deleted_at: null,
      })
      .lean();
    const catMap = new Map(masterItems.map((m) => [m.sku, m.category]));

    const lines: SupplyAggregateLineDto[] = results.map(
      (r: {
        _id: string;
        name: string;
        unit: string;
        total_approved: number;
        total_pending: number;
      }) => ({
        sku: r._id,
        name: r.name,
        unit: r.unit,
        category: catMap.get(r._id) ?? 'unknown',
        total_approved: r.total_approved,
        total_pending: r.total_pending,
      }),
    );

    return { event_id: String(event._id), lines };
  }

  /* ═══════════ HELPERS ═══════════ */

  /**
   * Load order with tenant + event scope. Khi `scopeTeamId` truthy → chỉ trả
   * về order thuộc team đó (BR-02: leader không thấy order team khác). Scope
   * mismatch = 404 (không leak existence cho user không có quyền).
   */
  private async findOrderEntity(
    tenantId: string,
    eventId: string,
    orderId: string,
    scopeTeamId?: string,
  ): Promise<OpsSupplyOrderDocument> {
    const event = await this.eventsService.findEntity(tenantId, eventId);
    if (!Types.ObjectId.isValid(orderId))
      throw new NotFoundException('Order not found');
    const filter: Record<string, unknown> = {
      _id: new Types.ObjectId(orderId),
      event_id: event._id,
      deleted_at: null,
    };
    if (scopeTeamId) {
      if (!Types.ObjectId.isValid(scopeTeamId))
        throw new NotFoundException('Order not found');
      filter.team_id = new Types.ObjectId(scopeTeamId);
    }
    const doc = await this.orderModel.findOne(filter);
    if (!doc) throw new NotFoundException('Order not found');
    return doc;
  }

  private assertOrderTransition(from: string, to: string): void {
    const allowed: Record<string, string[]> = {
      DRAFT: ['SUBMITTED'],
      SUBMITTED: ['APPROVED', 'REJECTED'],
      APPROVED: ['DISPATCHED'],
      DISPATCHED: ['RECEIVED'],
      REJECTED: [],
      RECEIVED: [],
    };
    if (!allowed[from]?.includes(to)) {
      throw new ForbiddenException(
        `Invalid order status transition: ${from} → ${to}`,
      );
    }
  }

  private toItemResponse(
    doc: OpsSupplyItemDocument | Record<string, unknown>,
  ): SupplyItemResponseDto {
    const d = doc as Record<string, unknown> & { _id: Types.ObjectId };
    return {
      id: String(d._id),
      event_id: String(d.event_id),
      sku: String(d.sku),
      name: String(d.name),
      description: d.description as string | undefined,
      unit: String(d.unit),
      category: String(d.category),
      default_price: d.default_price as number | undefined,
      created_at: new Date(d.created_at as string | Date),
      updated_at: new Date(d.updated_at as string | Date),
    };
  }

  private toOrderResponse(
    doc: OpsSupplyOrderDocument | Record<string, unknown>,
  ): SupplyOrderResponseDto {
    const d = doc as Record<string, unknown> & { _id: Types.ObjectId };
    return {
      id: String(d._id),
      event_id: String(d.event_id),
      team_id: String(d.team_id),
      order_code: String(d.order_code),
      created_by: String(d.created_by),
      items: ((d.items as Array<Record<string, unknown>>) ?? []).map((i) => ({
        sku: String(i.sku),
        name: String(i.name),
        unit: String(i.unit),
        quantity: Number(i.quantity),
        note: i.note as string | undefined,
      })),
      status: String(d.status),
      submitted_at: d.submitted_at
        ? new Date(d.submitted_at as string | Date)
        : undefined,
      approved_at: d.approved_at
        ? new Date(d.approved_at as string | Date)
        : undefined,
      approved_by: d.approved_by ? String(d.approved_by) : null,
      rejected_reason: d.rejected_reason as string | undefined,
      dispatched_at: d.dispatched_at
        ? new Date(d.dispatched_at as string | Date)
        : undefined,
      dispatched_by: d.dispatched_by ? String(d.dispatched_by) : null,
      received_at: d.received_at
        ? new Date(d.received_at as string | Date)
        : undefined,
      received_by: d.received_by ? String(d.received_by) : null,
      received_proof_urls: (d.received_proof_urls as string[]) ?? [],
      created_at: new Date(d.created_at as string | Date),
      updated_at: new Date(d.updated_at as string | Date),
    };
  }
}
