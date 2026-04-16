import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Request } from 'express';
import { OpsTeam, OpsTeamDocument } from '../schemas/ops-team.schema';
import { OpsUser, OpsUserDocument } from '../schemas/ops-user.schema';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../common/constants';
import { EventsService } from '../events/events.service';
import {
  AssignLeaderDto,
  CreateTeamDto,
  TeamListResponseDto,
  TeamResponseDto,
  UpdateTeamDto,
} from './dto/team.dto';

/**
 * TeamsService — CRUD teams trong scope của 1 event.
 *
 * Rules:
 *  - `code` unique per event, immutable khi event đã LIVE.
 *  - `leader_user_id` phải trỏ tới ops_user role='ops_leader' cùng event.
 *  - Delete = soft-delete; nếu có user còn gắn team → 409 (phải gỡ trước).
 *  - Khi team.locked=true: cho phép edit target_*, station_ids, color, tags, order;
 *    KHÔNG cho rename code hoặc delete.
 */
@Injectable()
export class TeamsService {
  constructor(
    @InjectModel(OpsTeam.name)
    private readonly teamModel: Model<OpsTeamDocument>,
    @InjectModel(OpsUser.name)
    private readonly userModel: Model<OpsUserDocument>,
    private readonly eventsService: EventsService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    tenantId: string,
    eventId: string,
    createdBy: string,
    dto: CreateTeamDto,
    request?: Request,
  ): Promise<TeamResponseDto> {
    const event = await this.eventsService.findEntity(tenantId, eventId);

    const existing = await this.teamModel
      .findOne({
        event_id: event._id,
        code: dto.code,
        deleted_at: null,
      })
      .lean();
    if (existing) {
      throw new ConflictException(
        `Team code "${dto.code}" already exists in this event`,
      );
    }

    const created = await this.teamModel.create({
      event_id: event._id,
      name: dto.name,
      code: dto.code,
      target_crew: dto.target_crew ?? 0,
      target_tnv: dto.target_tnv ?? 0,
      station_ids: dto.station_ids ?? [],
      order: dto.order ?? 0,
      color: dto.color,
      tags: dto.tags ?? [],
      // Auto-lock nếu event đã LIVE
      locked: event.status === 'LIVE',
    });

    await this.auditService.log({
      event_id: event._id,
      user_id: createdBy,
      action: AUDIT_ACTIONS.CREATE_TEAM,
      entity_type: 'ops_teams',
      entity_id: created._id,
      payload: { name: created.name, code: created.code },
      request,
    });

    return this.toResponse(created);
  }

  async list(
    tenantId: string,
    eventId: string,
  ): Promise<TeamListResponseDto> {
    const event = await this.eventsService.findEntity(tenantId, eventId);
    const items = await this.teamModel
      .find({ event_id: event._id, deleted_at: null })
      .sort({ order: 1, created_at: 1 })
      .lean();
    return {
      items: items.map((t) => this.toResponse(t)),
      total: items.length,
    };
  }

  async findOne(
    tenantId: string,
    eventId: string,
    teamId: string,
  ): Promise<TeamResponseDto> {
    const doc = await this.findEntity(tenantId, eventId, teamId);
    return this.toResponse(doc);
  }

  async update(
    tenantId: string,
    eventId: string,
    teamId: string,
    updatedBy: string,
    dto: UpdateTeamDto,
    request?: Request,
  ): Promise<TeamResponseDto> {
    const doc = await this.findEntity(tenantId, eventId, teamId);

    const patch: Record<string, unknown> = {};

    if (dto.name !== undefined) patch.name = dto.name;

    if (dto.code !== undefined && dto.code !== doc.code) {
      if (doc.locked) {
        throw new ForbiddenException(
          'Cannot rename code on locked team (event is LIVE)',
        );
      }
      const conflict = await this.teamModel
        .findOne({
          event_id: doc.event_id,
          code: dto.code,
          _id: { $ne: doc._id },
          deleted_at: null,
        })
        .lean();
      if (conflict)
        throw new ConflictException(
          `Team code "${dto.code}" already exists in this event`,
        );
      patch.code = dto.code;
    }

    if (dto.target_crew !== undefined) patch.target_crew = dto.target_crew;
    if (dto.target_tnv !== undefined) patch.target_tnv = dto.target_tnv;
    if (dto.station_ids !== undefined) patch.station_ids = dto.station_ids;
    if (dto.order !== undefined) patch.order = dto.order;
    if (dto.color !== undefined) patch.color = dto.color;
    if (dto.tags !== undefined) patch.tags = dto.tags;
    if (dto.locked !== undefined) patch.locked = dto.locked;

    await this.teamModel.updateOne({ _id: doc._id }, { $set: patch });

    await this.auditService.log({
      event_id: doc.event_id,
      user_id: updatedBy,
      action: AUDIT_ACTIONS.UPDATE_TEAM,
      entity_type: 'ops_teams',
      entity_id: doc._id,
      payload: patch,
      request,
    });

    const fresh = await this.teamModel.findById(doc._id).lean();
    if (!fresh) throw new NotFoundException('Team disappeared after update');
    return this.toResponse(fresh);
  }

  async assignLeader(
    tenantId: string,
    eventId: string,
    teamId: string,
    updatedBy: string,
    dto: AssignLeaderDto,
    request?: Request,
  ): Promise<TeamResponseDto> {
    const doc = await this.findEntity(tenantId, eventId, teamId);

    let leaderObjId: Types.ObjectId | null = null;
    if (dto.leader_user_id) {
      const leader = await this.userModel
        .findOne({
          _id: new Types.ObjectId(dto.leader_user_id),
          event_id: doc.event_id,
          deleted_at: null,
        })
        .lean();
      if (!leader) {
        throw new NotFoundException('Leader user not found in this event');
      }
      if (leader.role !== 'ops_leader') {
        throw new BadRequestException(
          `User role is "${leader.role}" — must be ops_leader`,
        );
      }
      leaderObjId = leader._id;
    }

    await this.teamModel.updateOne(
      { _id: doc._id },
      { $set: { leader_user_id: leaderObjId } },
    );

    // Sync: user.team_id trỏ ngược lại team (nếu có gán)
    if (leaderObjId) {
      await this.userModel.updateOne(
        { _id: leaderObjId },
        { $set: { team_id: doc._id } },
      );
    }

    await this.auditService.log({
      event_id: doc.event_id,
      user_id: updatedBy,
      action: AUDIT_ACTIONS.ASSIGN_LEADER,
      entity_type: 'ops_teams',
      entity_id: doc._id,
      payload: {
        leader_user_id: leaderObjId ? String(leaderObjId) : null,
        previous: doc.leader_user_id ? String(doc.leader_user_id) : null,
      },
      request,
    });

    const fresh = await this.teamModel.findById(doc._id).lean();
    if (!fresh) throw new NotFoundException('Team disappeared after update');
    return this.toResponse(fresh);
  }

  async archive(
    tenantId: string,
    eventId: string,
    teamId: string,
    userId: string,
    request?: Request,
  ): Promise<void> {
    const doc = await this.findEntity(tenantId, eventId, teamId);

    if (doc.locked) {
      throw new ForbiddenException(
        'Cannot delete locked team (event is LIVE)',
      );
    }

    const hasUsers = await this.userModel.exists({
      team_id: doc._id,
      deleted_at: null,
    });
    if (hasUsers) {
      throw new ConflictException(
        'Team still has users assigned — remove members first',
      );
    }

    await this.teamModel.updateOne(
      { _id: doc._id },
      { $set: { deleted_at: new Date() } },
    );

    await this.auditService.log({
      event_id: doc.event_id,
      user_id: userId,
      action: 'ARCHIVE_TEAM',
      entity_type: 'ops_teams',
      entity_id: doc._id,
      payload: { code: doc.code },
      request,
    });
  }

  /** Helper dùng chung cho các service khác. */
  async findEntity(
    tenantId: string,
    eventId: string,
    teamId: string,
  ): Promise<OpsTeamDocument> {
    const event = await this.eventsService.findEntity(tenantId, eventId);
    if (!Types.ObjectId.isValid(teamId)) {
      throw new NotFoundException('Team not found');
    }
    const doc = await this.teamModel.findOne({
      _id: new Types.ObjectId(teamId),
      event_id: event._id,
      deleted_at: null,
    });
    if (!doc) throw new NotFoundException('Team not found');
    return doc;
  }

  private toResponse(
    doc: OpsTeamDocument | Record<string, unknown>,
  ): TeamResponseDto {
    const d = doc as Record<string, unknown> & { _id: Types.ObjectId };
    return {
      id: String(d._id),
      event_id: String(d.event_id),
      name: String(d.name),
      code: String(d.code),
      leader_user_id: d.leader_user_id ? String(d.leader_user_id) : null,
      target_crew: Number(d.target_crew ?? 0),
      target_tnv: Number(d.target_tnv ?? 0),
      station_ids: (d.station_ids as string[]) ?? [],
      order: Number(d.order ?? 0),
      color: d.color as string | undefined,
      tags: (d.tags as string[]) ?? [],
      locked: Boolean(d.locked),
      created_at: new Date(d.created_at as string | Date),
      updated_at: new Date(d.updated_at as string | Date),
    };
  }
}
