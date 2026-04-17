import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Request } from 'express';
import {
  OpsIncident,
  OpsIncidentDocument,
} from '../schemas/ops-incident.schema';
import { OpsTeam, OpsTeamDocument } from '../schemas/ops-team.schema';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../common/constants';
import { EventsService } from '../events/events.service';
import {
  AcknowledgeIncidentDto,
  CreateIncidentDto,
  IncidentListQueryDto,
  IncidentListResponseDto,
  IncidentResponseDto,
  ResolveIncidentDto,
} from './dto/incident.dto';

/**
 * IncidentsService — sự cố trong event (OPEN → ACKNOWLEDGED → RESOLVED).
 *
 * Luồng:
 *  - Leader/Crew báo sự cố (priority + description + photos)
 *  - Admin acknowledge → resolve với note
 *
 * Rules:
 *  - reported_by luôn là userId người gọi API
 *  - ACKNOWLEDGED / RESOLVED chỉ admin hoặc leader cùng team
 *  - Soft-delete via deleted_at
 */
@Injectable()
export class IncidentsService {
  constructor(
    @InjectModel(OpsIncident.name)
    private readonly incidentModel: Model<OpsIncidentDocument>,
    @InjectModel(OpsTeam.name)
    private readonly teamModel: Model<OpsTeamDocument>,
    private readonly eventsService: EventsService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    tenantId: string,
    eventId: string,
    reportedBy: string,
    dto: CreateIncidentDto,
    scopeTeamId?: string,
    request?: Request,
  ): Promise<IncidentResponseDto> {
    const event = await this.eventsService.findEntity(tenantId, eventId);

    let teamObjId: Types.ObjectId | null = null;
    if (dto.team_id) {
      // Leader chỉ được báo sự cố cho team mình
      if (scopeTeamId && dto.team_id !== scopeTeamId) {
        throw new ForbiddenException(
          'Leader chỉ được báo sự cố cho team của mình',
        );
      }
      const team = await this.teamModel
        .findOne({
          _id: new Types.ObjectId(dto.team_id),
          event_id: event._id,
          deleted_at: null,
        })
        .lean();
      if (!team) throw new NotFoundException('Team not found');
      teamObjId = team._id;
    } else if (scopeTeamId) {
      // Leader không truyền team_id → default team của leader
      if (Types.ObjectId.isValid(scopeTeamId)) {
        teamObjId = new Types.ObjectId(scopeTeamId);
      }
    }

    const created = await this.incidentModel.create({
      event_id: event._id,
      reported_by: new Types.ObjectId(reportedBy),
      team_id: teamObjId,
      station_id: dto.station_id,
      priority: dto.priority,
      description: dto.description,
      photo_urls: dto.photo_urls ?? [],
      status: 'OPEN',
    });

    await this.auditService.log({
      event_id: event._id,
      user_id: reportedBy,
      action: AUDIT_ACTIONS.CREATE_INCIDENT,
      entity_type: 'ops_incidents',
      entity_id: created._id,
      to_state: 'OPEN',
      payload: {
        priority: created.priority,
        team_id: teamObjId ? String(teamObjId) : null,
        station_id: created.station_id,
      },
      request,
    });

    return this.toResponse(created);
  }

  async list(
    tenantId: string,
    eventId: string,
    query: IncidentListQueryDto,
    scopeTeamId?: string,
  ): Promise<IncidentListResponseDto> {
    const event = await this.eventsService.findEntity(tenantId, eventId);

    const filter: Record<string, unknown> = {
      event_id: event._id,
      deleted_at: null,
    };

    if (scopeTeamId) {
      if (!Types.ObjectId.isValid(scopeTeamId)) {
        return { items: [], total: 0 };
      }
      // Leader xem incident team mình + event-wide (team_id=null)
      filter.$or = [
        { team_id: new Types.ObjectId(scopeTeamId) },
        { team_id: null },
      ];
    } else if (query.team_id) {
      filter.team_id = new Types.ObjectId(query.team_id);
    }
    if (query.status) filter.status = query.status;
    if (query.priority) filter.priority = query.priority;

    const [items, total] = await Promise.all([
      this.incidentModel
        .find(filter)
        .sort({ created_at: -1 })
        .lean(),
      this.incidentModel.countDocuments(filter),
    ]);

    return {
      items: items.map((i) => this.toResponse(i)),
      total,
    };
  }

  async acknowledge(
    tenantId: string,
    eventId: string,
    incidentId: string,
    acknowledgedBy: string,
    dto: AcknowledgeIncidentDto,
    scopeTeamId?: string,
    request?: Request,
  ): Promise<IncidentResponseDto> {
    const doc = await this.findEntity(tenantId, eventId, incidentId);

    if (scopeTeamId) {
      const tid = doc.team_id ? String(doc.team_id) : null;
      if (tid !== null && tid !== scopeTeamId) {
        throw new NotFoundException('Incident not found');
      }
    }

    if (doc.status !== 'OPEN') {
      throw new BadRequestException(
        `Chỉ acknowledge được incident OPEN (hiện: ${doc.status})`,
      );
    }

    await this.incidentModel.updateOne(
      { _id: doc._id },
      {
        $set: {
          status: 'ACKNOWLEDGED',
          acknowledged_by: new Types.ObjectId(acknowledgedBy),
          acknowledged_at: new Date(),
        },
      },
    );

    await this.auditService.log({
      event_id: doc.event_id,
      user_id: acknowledgedBy,
      action: AUDIT_ACTIONS.ACKNOWLEDGE_INCIDENT,
      entity_type: 'ops_incidents',
      entity_id: doc._id,
      from_state: 'OPEN',
      to_state: 'ACKNOWLEDGED',
      payload: { note: dto.note },
      request,
    });

    const fresh = await this.incidentModel.findById(doc._id).lean();
    if (!fresh) throw new NotFoundException('Incident disappeared');
    return this.toResponse(fresh);
  }

  async resolve(
    tenantId: string,
    eventId: string,
    incidentId: string,
    resolvedBy: string,
    dto: ResolveIncidentDto,
    scopeTeamId?: string,
    request?: Request,
  ): Promise<IncidentResponseDto> {
    const doc = await this.findEntity(tenantId, eventId, incidentId);

    if (scopeTeamId) {
      const tid = doc.team_id ? String(doc.team_id) : null;
      if (tid !== null && tid !== scopeTeamId) {
        throw new NotFoundException('Incident not found');
      }
    }

    if (doc.status === 'RESOLVED') {
      throw new BadRequestException('Incident đã RESOLVED từ trước');
    }

    await this.incidentModel.updateOne(
      { _id: doc._id },
      {
        $set: {
          status: 'RESOLVED',
          resolved_by: new Types.ObjectId(resolvedBy),
          resolved_at: new Date(),
          resolution_note: dto.resolution_note,
        },
      },
    );

    await this.auditService.log({
      event_id: doc.event_id,
      user_id: resolvedBy,
      action: AUDIT_ACTIONS.RESOLVE_INCIDENT,
      entity_type: 'ops_incidents',
      entity_id: doc._id,
      from_state: doc.status,
      to_state: 'RESOLVED',
      payload: { resolution_note: dto.resolution_note },
      request,
    });

    const fresh = await this.incidentModel.findById(doc._id).lean();
    if (!fresh) throw new NotFoundException('Incident disappeared');
    return this.toResponse(fresh);
  }

  async archive(
    tenantId: string,
    eventId: string,
    incidentId: string,
    userId: string,
    request?: Request,
  ): Promise<void> {
    const doc = await this.findEntity(tenantId, eventId, incidentId);
    await this.incidentModel.updateOne(
      { _id: doc._id },
      { $set: { deleted_at: new Date() } },
    );
    await this.auditService.log({
      event_id: doc.event_id,
      user_id: userId,
      action: 'ARCHIVE_INCIDENT',
      entity_type: 'ops_incidents',
      entity_id: doc._id,
      payload: { priority: doc.priority },
      request,
    });
  }

  private async findEntity(
    tenantId: string,
    eventId: string,
    incidentId: string,
  ): Promise<OpsIncidentDocument> {
    const event = await this.eventsService.findEntity(tenantId, eventId);
    if (!Types.ObjectId.isValid(incidentId)) {
      throw new NotFoundException('Incident not found');
    }
    const doc = await this.incidentModel.findOne({
      _id: new Types.ObjectId(incidentId),
      event_id: event._id,
      deleted_at: null,
    });
    if (!doc) throw new NotFoundException('Incident not found');
    return doc;
  }

  private toResponse(
    doc: OpsIncidentDocument | Record<string, unknown>,
  ): IncidentResponseDto {
    const d = doc as Record<string, unknown> & { _id: Types.ObjectId };
    return {
      id: String(d._id),
      event_id: String(d.event_id),
      reported_by: String(d.reported_by),
      team_id: d.team_id ? String(d.team_id) : null,
      station_id: d.station_id as string | undefined,
      priority: d.priority as IncidentResponseDto['priority'],
      description: String(d.description),
      photo_urls: Array.isArray(d.photo_urls) ? (d.photo_urls as string[]) : [],
      status: d.status as IncidentResponseDto['status'],
      acknowledged_by: d.acknowledged_by ? String(d.acknowledged_by) : null,
      acknowledged_at: d.acknowledged_at
        ? new Date(d.acknowledged_at as string | Date)
        : undefined,
      resolved_by: d.resolved_by ? String(d.resolved_by) : null,
      resolved_at: d.resolved_at
        ? new Date(d.resolved_at as string | Date)
        : undefined,
      resolution_note: d.resolution_note as string | undefined,
      created_at: new Date(d.created_at as string | Date),
      updated_at: new Date(d.updated_at as string | Date),
    };
  }
}
