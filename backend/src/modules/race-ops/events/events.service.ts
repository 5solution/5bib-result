import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Request } from 'express';
import { OpsEvent, OpsEventDocument } from '../schemas/ops-event.schema';
import { OpsTeam, OpsTeamDocument } from '../schemas/ops-team.schema';
import { OpsUser, OpsUserDocument } from '../schemas/ops-user.schema';
import { OpsTask, OpsTaskDocument } from '../schemas/ops-task.schema';
import {
  OpsSupplyOrder,
  OpsSupplyOrderDocument,
} from '../schemas/ops-supply-order.schema';
import {
  OpsIncident,
  OpsIncidentDocument,
} from '../schemas/ops-incident.schema';
import {
  OpsCheckIn,
  OpsCheckInDocument,
} from '../schemas/ops-check-in.schema';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../common/constants';
import {
  CreateEventDto,
  EventKpiDto,
  EventListQueryDto,
  EventListResponseDto,
  EventResponseDto,
  UpdateEventDto,
} from './dto/event.dto';

@Injectable()
export class EventsService {
  constructor(
    @InjectModel(OpsEvent.name)
    private readonly eventModel: Model<OpsEventDocument>,
    @InjectModel(OpsTeam.name)
    private readonly teamModel: Model<OpsTeamDocument>,
    @InjectModel(OpsUser.name)
    private readonly userModel: Model<OpsUserDocument>,
    @InjectModel(OpsTask.name)
    private readonly taskModel: Model<OpsTaskDocument>,
    @InjectModel(OpsSupplyOrder.name)
    private readonly supplyOrderModel: Model<OpsSupplyOrderDocument>,
    @InjectModel(OpsIncident.name)
    private readonly incidentModel: Model<OpsIncidentDocument>,
    @InjectModel(OpsCheckIn.name)
    private readonly checkInModel: Model<OpsCheckInDocument>,
    private readonly auditService: AuditService,
  ) {}

  /** ADMIN: create event (DRAFT by default). */
  async create(
    tenantId: string,
    createdBy: string,
    dto: CreateEventDto,
    request?: Request,
  ): Promise<EventResponseDto> {
    const existing = await this.eventModel
      .findOne({ tenant_id: tenantId, slug: dto.slug, deleted_at: null })
      .lean();
    if (existing) {
      throw new ConflictException(`Event slug "${dto.slug}" already exists`);
    }

    const created = await this.eventModel.create({
      tenant_id: tenantId,
      name: dto.name,
      slug: dto.slug,
      date: new Date(dto.date),
      location: dto.location,
      courses: (dto.courses ?? []).map((c) => ({
        ...c,
        start_time: new Date(c.start_time),
      })),
      stations: dto.stations ?? [],
      status: 'DRAFT',
      created_by: new Types.ObjectId(createdBy),
    });

    await this.auditService.log({
      event_id: created._id,
      user_id: createdBy,
      action: AUDIT_ACTIONS.CREATE_EVENT,
      entity_type: 'ops_events',
      entity_id: created._id,
      to_state: 'DRAFT',
      payload: { name: created.name, slug: created.slug },
      request,
    });

    return this.toResponse(created);
  }

  /** ADMIN: list events của tenant. */
  async list(
    tenantId: string,
    query: EventListQueryDto,
  ): Promise<EventListResponseDto> {
    const filter: Record<string, unknown> = {
      tenant_id: tenantId,
      deleted_at: null,
    };
    if (query.status) filter.status = query.status;

    const [items, total] = await Promise.all([
      this.eventModel.find(filter).sort({ date: -1 }).lean(),
      this.eventModel.countDocuments(filter),
    ]);

    return {
      items: items.map((e) => this.toResponse(e)),
      total,
    };
  }

  async findOneForTenant(
    tenantId: string,
    eventId: string,
  ): Promise<EventResponseDto> {
    const doc = await this.findEntity(tenantId, eventId);
    return this.toResponse(doc);
  }

  async update(
    tenantId: string,
    eventId: string,
    updatedBy: string,
    dto: UpdateEventDto,
    request?: Request,
  ): Promise<EventResponseDto> {
    const doc = await this.findEntity(tenantId, eventId);

    const patch: Record<string, unknown> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.date !== undefined) patch.date = new Date(dto.date);
    if (dto.location !== undefined) patch.location = dto.location;
    if (dto.courses !== undefined) {
      patch.courses = dto.courses.map((c) => ({
        ...c,
        start_time: new Date(c.start_time),
      }));
    }
    if (dto.stations !== undefined) patch.stations = dto.stations;

    let fromState: string | undefined;
    let toState: string | undefined;
    if (dto.status !== undefined && dto.status !== doc.status) {
      this.assertValidStatusTransition(doc.status, dto.status);
      fromState = doc.status;
      toState = dto.status;
      patch.status = dto.status;
    }

    // Slug change: chặn nếu đã có teams/users active (chưa bị soft-delete) để
    // tránh leak path cũ. R9 fix: filter deleted_at:null, nếu không user cũ đã
    // archive vẫn block slug edit.
    if (dto.slug !== undefined && dto.slug !== doc.slug) {
      const hasDependents = await this.userModel.exists({
        event_id: doc._id,
        deleted_at: null,
      });
      if (hasDependents) {
        throw new ForbiddenException(
          'Cannot change slug after users exist — creates broken public links',
        );
      }
      const conflict = await this.eventModel.findOne({
        tenant_id: tenantId,
        slug: dto.slug,
        _id: { $ne: doc._id },
        deleted_at: null,
      });
      if (conflict) throw new ConflictException(`Slug "${dto.slug}" in use`);
      patch.slug = dto.slug;
    }

    await this.eventModel.updateOne({ _id: doc._id }, { $set: patch });

    await this.auditService.log({
      event_id: doc._id,
      user_id: updatedBy,
      action: AUDIT_ACTIONS.UPDATE_EVENT,
      entity_type: 'ops_events',
      entity_id: doc._id,
      from_state: fromState,
      to_state: toState,
      payload: patch,
      request,
    });

    const fresh = await this.eventModel.findById(doc._id).lean();
    if (!fresh) throw new NotFoundException('Event disappeared after update');
    return this.toResponse(fresh);
  }

  /** ADMIN: soft-delete (archive). */
  async archive(
    tenantId: string,
    eventId: string,
    userId: string,
    request?: Request,
  ): Promise<void> {
    const doc = await this.findEntity(tenantId, eventId);
    await this.eventModel.updateOne(
      { _id: doc._id },
      { $set: { deleted_at: new Date() } },
    );
    await this.auditService.log({
      event_id: doc._id,
      user_id: userId,
      action: 'ARCHIVE_EVENT',
      entity_type: 'ops_events',
      entity_id: doc._id,
      payload: { slug: doc.slug },
      request,
    });
  }

  /** PUBLIC: get event basic info by slug (no auth). */
  async getPublicBySlug(
    tenantId: string,
    slug: string,
  ): Promise<EventResponseDto> {
    const doc = await this.eventModel
      .findOne({ tenant_id: tenantId, slug, deleted_at: null })
      .lean();
    if (!doc) throw new NotFoundException('Event not found');
    if (doc.status === 'DRAFT') {
      // Không expose draft ra public (align BR-09 isolation)
      throw new NotFoundException('Event not found');
    }
    return this.toResponse(doc);
  }

  /** ADMIN: KPI overview card. Dùng aggregation thay vì count nhiều lần. */
  async kpi(tenantId: string, eventId: string): Promise<EventKpiDto> {
    const doc = await this.findEntity(tenantId, eventId);
    const eventObjId = doc._id;

    const baseFilter = { event_id: eventObjId, deleted_at: null };

    const [
      total_teams,
      total_volunteers,
      total_volunteers_approved,
      total_crew,
      total_checked_in,
      total_tasks_pending,
      total_tasks_done,
      total_incidents_open,
      total_supply_orders_submitted,
      total_supply_orders_approved,
    ] = await Promise.all([
      this.teamModel.countDocuments(baseFilter),
      this.userModel.countDocuments({ ...baseFilter, role: 'ops_tnv' }),
      this.userModel.countDocuments({
        ...baseFilter,
        role: 'ops_tnv',
        status: 'APPROVED',
      }),
      this.userModel.countDocuments({ ...baseFilter, role: 'ops_crew' }),
      this.checkInModel.countDocuments({ event_id: eventObjId }),
      this.taskModel.countDocuments({ ...baseFilter, status: 'PENDING' }),
      this.taskModel.countDocuments({ ...baseFilter, status: 'DONE' }),
      this.incidentModel.countDocuments({
        ...baseFilter,
        status: { $in: ['OPEN', 'ACKNOWLEDGED'] },
      }),
      this.supplyOrderModel.countDocuments({
        ...baseFilter,
        status: 'SUBMITTED',
      }),
      this.supplyOrderModel.countDocuments({
        ...baseFilter,
        status: { $in: ['APPROVED', 'DISPATCHED', 'RECEIVED'] },
      }),
    ]);

    return {
      event_id: String(eventObjId),
      total_teams,
      total_volunteers,
      total_volunteers_approved,
      total_crew,
      total_checked_in,
      total_tasks_pending,
      total_tasks_done,
      total_incidents_open,
      total_supply_orders_submitted,
      total_supply_orders_approved,
    };
  }

  /** Helper dùng chung cho các service khác. */
  async findEntity(
    tenantId: string,
    eventId: string,
  ): Promise<OpsEventDocument> {
    if (!Types.ObjectId.isValid(eventId)) {
      throw new NotFoundException('Event not found');
    }
    const doc = await this.eventModel.findOne({
      _id: new Types.ObjectId(eventId),
      tenant_id: tenantId,
      deleted_at: null,
    });
    if (!doc) throw new NotFoundException('Event not found');
    return doc;
  }

  private assertValidStatusTransition(from: string, to: string): void {
    const allowed: Record<string, string[]> = {
      DRAFT: ['LIVE', 'ENDED'],
      LIVE: ['ENDED'],
      ENDED: [],
    };
    if (!allowed[from]?.includes(to)) {
      throw new ForbiddenException(
        `Invalid status transition: ${from} → ${to}`,
      );
    }
  }

  private toResponse(
    doc: OpsEventDocument | Record<string, unknown>,
  ): EventResponseDto {
    // Accept lean() or hydrated doc
    const d = doc as Record<string, unknown> & { _id: Types.ObjectId };
    return {
      id: String(d._id),
      tenant_id: String(d.tenant_id),
      name: String(d.name),
      slug: String(d.slug),
      date: new Date(d.date as string | Date),
      location: d.location as EventResponseDto['location'],
      courses: (d.courses as EventResponseDto['courses']) ?? [],
      stations: (d.stations as EventResponseDto['stations']) ?? [],
      status: d.status as EventResponseDto['status'],
      created_at: new Date(d.created_at as string | Date),
      updated_at: new Date(d.updated_at as string | Date),
    };
  }
}
