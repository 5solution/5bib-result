import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Request } from 'express';
import {
  OpsCheckIn,
  OpsCheckInDocument,
} from '../schemas/ops-check-in.schema';
import { OpsUser, OpsUserDocument } from '../schemas/ops-user.schema';
import { OpsTeam, OpsTeamDocument } from '../schemas/ops-team.schema';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../common/constants';
import { EventsService } from '../events/events.service';
import {
  CheckInListQueryDto,
  CheckInListResponseDto,
  CheckInResponseDto,
  CheckInSummaryResponseDto,
  CreateCheckInDto,
} from './dto/check-in.dto';

/**
 * CheckInsService — ghi nhận check-in của TNV/crew tại event.
 *
 * Flow phổ biến:
 *  - Crew scan QR của TNV trên mobile → POST với method='QR' (future: crew app).
 *  - Admin tạo manual khi TNV không có QR → method='MANUAL'.
 *
 * Rules:
 *  - Target user phải thuộc event, status ∈ {APPROVED, ACTIVE}, có team_id.
 *  - scopeTeamId (leader) → chỉ check-in user trong team mình + chỉ xem list team mình.
 *  - Duplicate-check: 1 user không được check-in 2 lần trong cùng 60s để tránh double-tap.
 */
@Injectable()
export class CheckInsService {
  constructor(
    @InjectModel(OpsCheckIn.name)
    private readonly checkInModel: Model<OpsCheckInDocument>,
    @InjectModel(OpsUser.name)
    private readonly userModel: Model<OpsUserDocument>,
    @InjectModel(OpsTeam.name)
    private readonly teamModel: Model<OpsTeamDocument>,
    private readonly eventsService: EventsService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    tenantId: string,
    eventId: string,
    performedBy: string,
    dto: CreateCheckInDto,
    scopeTeamId?: string,
    request?: Request,
  ): Promise<CheckInResponseDto> {
    const event = await this.eventsService.findEntity(tenantId, eventId);

    if (!Types.ObjectId.isValid(dto.user_id)) {
      throw new NotFoundException('User not found');
    }
    const user = await this.userModel.findOne({
      _id: new Types.ObjectId(dto.user_id),
      event_id: event._id,
      deleted_at: null,
    });
    if (!user) throw new NotFoundException('User not found');

    if (!['APPROVED', 'ACTIVE'].includes(user.status)) {
      throw new BadRequestException(
        `User status is ${user.status} — must be APPROVED/ACTIVE to check-in`,
      );
    }
    if (!user.team_id) {
      throw new BadRequestException(
        'User chưa được gán team — không thể check-in',
      );
    }

    // Leader scope: chỉ check-in user trong team mình
    if (scopeTeamId && String(user.team_id) !== scopeTeamId) {
      throw new NotFoundException('User not found');
    }

    const checkedAt = dto.checked_in_at
      ? new Date(dto.checked_in_at)
      : new Date();

    // Duplicate guard (60s window)
    const dupeWindowStart = new Date(checkedAt.getTime() - 60_000);
    const dupeWindowEnd = new Date(checkedAt.getTime() + 60_000);
    const dupe = await this.checkInModel
      .findOne({
        event_id: event._id,
        user_id: user._id,
        checked_in_at: { $gte: dupeWindowStart, $lte: dupeWindowEnd },
      })
      .lean();
    if (dupe) {
      throw new ConflictException(
        'User đã được check-in trong 60 giây trước — bỏ qua duplicate',
      );
    }

    const created = await this.checkInModel.create({
      event_id: event._id,
      user_id: user._id,
      team_id: user.team_id,
      shift_id: dto.shift_id ? new Types.ObjectId(dto.shift_id) : null,
      checked_in_at: checkedAt,
      checked_in_by: new Types.ObjectId(performedBy),
      method: dto.method ?? 'MANUAL',
      geo: dto.geo,
    });

    // ACTIVE transition: user đầu tiên check-in → bump status APPROVED → ACTIVE
    if (user.status === 'APPROVED') {
      await this.userModel.updateOne(
        { _id: user._id },
        { $set: { status: 'ACTIVE' } },
      );
    }

    await this.auditService.log({
      event_id: event._id,
      user_id: performedBy,
      action: AUDIT_ACTIONS.CREATE_CHECK_IN,
      entity_type: 'ops_check_ins',
      entity_id: created._id,
      payload: {
        user_id: String(user._id),
        team_id: String(user.team_id),
        method: created.method,
      },
      request,
    });

    return this.toResponse(created, user);
  }

  async list(
    tenantId: string,
    eventId: string,
    query: CheckInListQueryDto,
    scopeTeamId?: string,
  ): Promise<CheckInListResponseDto> {
    const event = await this.eventsService.findEntity(tenantId, eventId);

    const filter: Record<string, unknown> = { event_id: event._id };

    if (scopeTeamId) {
      if (!Types.ObjectId.isValid(scopeTeamId)) {
        return { items: [], total: 0 };
      }
      filter.team_id = new Types.ObjectId(scopeTeamId);
    } else if (query.team_id) {
      filter.team_id = new Types.ObjectId(query.team_id);
    }
    if (query.user_id) filter.user_id = new Types.ObjectId(query.user_id);
    if (query.method) filter.method = query.method;
    if (query.since) {
      filter.checked_in_at = { $gte: new Date(query.since) };
    }

    const [items, total] = await Promise.all([
      this.checkInModel
        .find(filter)
        .sort({ checked_in_at: -1 })
        .limit(500)
        .lean(),
      this.checkInModel.countDocuments(filter),
    ]);

    // Denormalize user fields để admin UI render nhanh
    const userIds = Array.from(new Set(items.map((i) => String(i.user_id))));
    const users = await this.userModel
      .find({ _id: { $in: userIds.map((id) => new Types.ObjectId(id)) } })
      .select('_id full_name phone role')
      .lean();
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    return {
      items: items.map((i) => {
        const u = userMap.get(String(i.user_id));
        return this.toResponse(i, u ?? null);
      }),
      total,
    };
  }

  async summary(
    tenantId: string,
    eventId: string,
  ): Promise<CheckInSummaryResponseDto> {
    const event = await this.eventsService.findEntity(tenantId, eventId);

    const agg = (await this.checkInModel.aggregate([
      { $match: { event_id: event._id } },
      {
        $group: {
          _id: '$team_id',
          total: { $sum: 1 },
          uniqueUsers: { $addToSet: '$user_id' },
        },
      },
      {
        $project: {
          _id: 1,
          total: 1,
          unique: { $size: '$uniqueUsers' },
        },
      },
    ])) as Array<{ _id: Types.ObjectId; total: number; unique: number }>;

    const teams = await this.teamModel
      .find({ event_id: event._id, deleted_at: null })
      .select('_id name code')
      .lean();
    const teamMap = new Map(teams.map((t) => [String(t._id), t]));

    const teamRows = agg
      .map((row) => {
        const t = teamMap.get(String(row._id));
        return {
          team_id: String(row._id),
          team_name: t?.name ?? '(unknown)',
          team_code: t?.code ?? '',
          total_check_ins: row.total,
          unique_users: row.unique,
        };
      })
      // Add teams with 0 check-ins so UI biết team nào chưa active
      .concat(
        teams
          .filter((t) => !agg.some((r) => String(r._id) === String(t._id)))
          .map((t) => ({
            team_id: String(t._id),
            team_name: t.name,
            team_code: t.code,
            total_check_ins: 0,
            unique_users: 0,
          })),
      )
      .sort((a, b) => b.total_check_ins - a.total_check_ins);

    return {
      event_id: String(event._id),
      total_check_ins: agg.reduce((s, r) => s + r.total, 0),
      teams: teamRows,
    };
  }

  async delete(
    tenantId: string,
    eventId: string,
    checkInId: string,
    userId: string,
    request?: Request,
  ): Promise<void> {
    const event = await this.eventsService.findEntity(tenantId, eventId);

    if (!Types.ObjectId.isValid(checkInId)) {
      throw new NotFoundException('Check-in not found');
    }
    const doc = await this.checkInModel.findOne({
      _id: new Types.ObjectId(checkInId),
      event_id: event._id,
    });
    if (!doc) throw new NotFoundException('Check-in not found');

    await this.checkInModel.deleteOne({ _id: doc._id });

    await this.auditService.log({
      event_id: event._id,
      user_id: userId,
      action: 'DELETE_CHECK_IN',
      entity_type: 'ops_check_ins',
      entity_id: doc._id,
      payload: {
        user_id: String(doc.user_id),
        team_id: String(doc.team_id),
      },
      request,
    });
  }

  private toResponse(
    doc: OpsCheckInDocument | Record<string, unknown>,
    user: Record<string, unknown> | OpsUserDocument | null,
  ): CheckInResponseDto {
    const d = doc as Record<string, unknown> & { _id: Types.ObjectId };
    return {
      id: String(d._id),
      event_id: String(d.event_id),
      user_id: String(d.user_id),
      team_id: String(d.team_id),
      shift_id: d.shift_id ? String(d.shift_id) : null,
      checked_in_at: new Date(d.checked_in_at as string | Date),
      checked_in_by: String(d.checked_in_by),
      method: d.method as 'QR' | 'MANUAL',
      geo: d.geo as { lat: number; lng: number } | undefined,
      created_at: new Date(d.created_at as string | Date),
      updated_at: new Date(d.updated_at as string | Date),
      user_full_name: user ? String((user as { full_name: string }).full_name) : undefined,
      user_phone: user ? String((user as { phone: string }).phone) : undefined,
      user_role: user ? String((user as { role: string }).role) : undefined,
    };
  }
}
