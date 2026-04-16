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
import { OpsUser, OpsUserDocument } from '../schemas/ops-user.schema';
import { OpsEvent, OpsEventDocument } from '../schemas/ops-event.schema';
import { OpsTeam, OpsTeamDocument } from '../schemas/ops-team.schema';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../common/constants';
import { genQrToken } from '../common/utils/qr-token.util';
import { OpsAuthService } from './ops-auth.service';
import {
  AdminCreateUserDto,
  ApplicationListQueryDto,
  PublicApplyDto,
  PublicApplyResponseDto,
  RejectApplicationDto,
  UserListResponseDto,
  UserResponseDto,
} from './dto/application.dto';

/**
 * ApplicationsService — public volunteer apply + admin user management.
 *
 * Public flow (TNV):
 *  POST /race-ops/public/events/:slug/apply
 *  → creates ops_user role=ops_tnv, status=PENDING
 *  → leader/admin approves → APPROVED + genQrToken
 *
 * Admin flow:
 *  - List/filter users per event
 *  - Create crew/leader directly (auto APPROVED)
 *  - Approve/reject pending applications
 */
@Injectable()
export class ApplicationsService {
  constructor(
    @InjectModel(OpsUser.name)
    private readonly userModel: Model<OpsUserDocument>,
    @InjectModel(OpsEvent.name)
    private readonly eventModel: Model<OpsEventDocument>,
    @InjectModel(OpsTeam.name)
    private readonly teamModel: Model<OpsTeamDocument>,
    private readonly auditService: AuditService,
  ) {}

  /* ─────────── PUBLIC ─────────── */

  async publicApply(
    tenantId: string,
    slug: string,
    dto: PublicApplyDto,
  ): Promise<PublicApplyResponseDto> {
    const event = await this.eventModel
      .findOne({ tenant_id: tenantId, slug, deleted_at: null })
      .lean();
    if (!event) throw new NotFoundException('Event not found');
    if (event.status === 'DRAFT') {
      throw new ForbiddenException('Event chưa mở đăng ký');
    }
    if (event.status === 'ENDED') {
      throw new ForbiddenException('Event đã kết thúc');
    }

    const normalizedPhone = dto.phone.trim();

    // Check duplicate phone per event
    const existing = await this.userModel
      .findOne({
        event_id: event._id,
        phone: normalizedPhone,
        deleted_at: null,
      })
      .lean();
    if (existing) {
      if (existing.status === 'REJECTED') {
        throw new ConflictException(
          'Đơn đăng ký trước đã bị từ chối. Vui lòng liên hệ BTC.',
        );
      }
      throw new ConflictException(
        'Số điện thoại đã đăng ký cho sự kiện này',
      );
    }

    // Validate preferred_team_id if provided
    let teamId: Types.ObjectId | null = null;
    if (dto.preferred_team_id) {
      const team = await this.teamModel
        .findOne({
          _id: new Types.ObjectId(dto.preferred_team_id),
          event_id: event._id,
          deleted_at: null,
        })
        .lean();
      if (team) {
        teamId = team._id;
      }
      // Nếu team không tồn tại → silently ignore (không block apply)
    }

    const created = await this.userModel.create({
      event_id: event._id,
      phone: normalizedPhone,
      full_name: dto.full_name.trim(),
      email: dto.email?.trim().toLowerCase(),
      dob: dto.dob ? new Date(dto.dob) : undefined,
      role: 'ops_tnv',
      team_id: teamId,
      emergency_contact: dto.emergency_contact,
      experience: dto.experience,
      shift_preferences: dto.shift_preferences,
      status: 'PENDING',
    });

    return {
      status: 'ok',
      user_id: String(created._id),
      application_status: 'PENDING',
    };
  }

  /* ─────────── ADMIN: create user directly ─────────── */

  async adminCreateUser(
    tenantId: string,
    eventId: string,
    createdBy: string,
    dto: AdminCreateUserDto,
    request?: Request,
  ): Promise<UserResponseDto> {
    const event = await this.findEvent(tenantId, eventId);

    // Leader phải có password
    if (dto.role === 'ops_leader' && !dto.password) {
      throw new BadRequestException(
        'Password bắt buộc cho role ops_leader',
      );
    }

    // Crew/TNV phải gán team
    if (
      (dto.role === 'ops_crew' || dto.role === 'ops_tnv') &&
      !dto.team_id
    ) {
      throw new BadRequestException(
        'team_id bắt buộc cho role crew/tnv',
      );
    }

    const normalizedPhone = dto.phone.trim();
    const normalizedEmail = dto.email?.trim().toLowerCase();

    // Check duplicate
    const existing = await this.userModel
      .findOne({
        event_id: event._id,
        phone: normalizedPhone,
        deleted_at: null,
      })
      .lean();
    if (existing) {
      throw new ConflictException(
        'Số điện thoại đã tồn tại trong event này',
      );
    }

    // Validate team exists
    let teamObjId: Types.ObjectId | null = null;
    if (dto.team_id) {
      const team = await this.teamModel
        .findOne({
          _id: new Types.ObjectId(dto.team_id),
          event_id: event._id,
          deleted_at: null,
        })
        .lean();
      if (!team) throw new NotFoundException('Team not found');
      teamObjId = team._id;
    }

    // Hash password if leader
    let passwordHash: string | undefined;
    if (dto.password) {
      passwordHash = await OpsAuthService.hashPassword(dto.password);
    }

    // Admin-created users are auto-APPROVED
    const qr = genQrToken();

    const created = await this.userModel.create({
      event_id: event._id,
      phone: normalizedPhone,
      full_name: dto.full_name.trim(),
      email: normalizedEmail,
      dob: dto.dob ? new Date(dto.dob) : undefined,
      role: dto.role,
      team_id: teamObjId,
      password_hash: passwordHash,
      qr_token_hash: qr.hash,
      emergency_contact: dto.emergency_contact,
      experience: dto.experience,
      shift_preferences: dto.shift_preferences,
      status: 'APPROVED',
      approved_by: new Types.ObjectId(createdBy),
      approved_at: new Date(),
    });

    await this.auditService.log({
      event_id: event._id,
      user_id: createdBy,
      action: 'CREATE_USER',
      entity_type: 'ops_users',
      entity_id: created._id,
      to_state: 'APPROVED',
      payload: {
        role: dto.role,
        phone: normalizedPhone,
        full_name: dto.full_name,
      },
      request,
    });

    return this.toResponse(created);
  }

  /* ─────────── ADMIN: list users ─────────── */

  async list(
    tenantId: string,
    eventId: string,
    query: ApplicationListQueryDto,
  ): Promise<UserListResponseDto> {
    const event = await this.findEvent(tenantId, eventId);

    const filter: Record<string, unknown> = {
      event_id: event._id,
      deleted_at: null,
    };
    if (query.status) filter.status = query.status;
    if (query.team_id)
      filter.team_id = new Types.ObjectId(query.team_id);
    if (query.role) filter.role = query.role;

    const [items, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select('-password_hash -qr_token_hash')
        .sort({ created_at: -1 })
        .lean(),
      this.userModel.countDocuments(filter),
    ]);

    return {
      items: items.map((u) => this.toResponse(u)),
      total,
    };
  }

  /* ─────────── ADMIN: approve ─────────── */

  async approve(
    tenantId: string,
    eventId: string,
    userId: string,
    approvedBy: string,
    teamId?: string,
    request?: Request,
  ): Promise<UserResponseDto> {
    const event = await this.findEvent(tenantId, eventId);
    const user = await this.findUser(event._id, userId);

    if (user.status !== 'PENDING') {
      throw new ForbiddenException(
        `Cannot approve — current status is ${user.status}`,
      );
    }

    // Gen QR token on approval
    const qr = genQrToken();

    const patch: Record<string, unknown> = {
      status: 'APPROVED',
      approved_by: new Types.ObjectId(approvedBy),
      approved_at: new Date(),
      qr_token_hash: qr.hash,
    };

    // Optionally assign team during approval
    if (teamId) {
      const team = await this.teamModel
        .findOne({
          _id: new Types.ObjectId(teamId),
          event_id: event._id,
          deleted_at: null,
        })
        .lean();
      if (!team) throw new NotFoundException('Team not found');
      patch.team_id = team._id;
    }

    await this.userModel.updateOne({ _id: user._id }, { $set: patch });

    await this.auditService.log({
      event_id: event._id,
      user_id: approvedBy,
      action: AUDIT_ACTIONS.APPROVE_APPLICATION,
      entity_type: 'ops_users',
      entity_id: user._id,
      from_state: 'PENDING',
      to_state: 'APPROVED',
      payload: { phone: user.phone, team_id: teamId },
      request,
    });

    const fresh = await this.userModel
      .findById(user._id)
      .select('-password_hash -qr_token_hash')
      .lean();
    if (!fresh) throw new NotFoundException('User disappeared');
    return this.toResponse(fresh);
  }

  /* ─────────── ADMIN: reject ─────────── */

  async reject(
    tenantId: string,
    eventId: string,
    userId: string,
    rejectedBy: string,
    dto: RejectApplicationDto,
    request?: Request,
  ): Promise<UserResponseDto> {
    const event = await this.findEvent(tenantId, eventId);
    const user = await this.findUser(event._id, userId);

    if (user.status !== 'PENDING') {
      throw new ForbiddenException(
        `Cannot reject — current status is ${user.status}`,
      );
    }

    await this.userModel.updateOne(
      { _id: user._id },
      {
        $set: {
          status: 'REJECTED',
          rejected_reason: dto.reason,
        },
      },
    );

    await this.auditService.log({
      event_id: event._id,
      user_id: rejectedBy,
      action: AUDIT_ACTIONS.REJECT_APPLICATION,
      entity_type: 'ops_users',
      entity_id: user._id,
      from_state: 'PENDING',
      to_state: 'REJECTED',
      payload: { reason: dto.reason, phone: user.phone },
      request,
    });

    const fresh = await this.userModel
      .findById(user._id)
      .select('-password_hash -qr_token_hash')
      .lean();
    if (!fresh) throw new NotFoundException('User disappeared');
    return this.toResponse(fresh);
  }

  /* ─────────── HELPERS ─────────── */

  private async findEvent(
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

  private async findUser(
    eventId: Types.ObjectId,
    userId: string,
  ): Promise<OpsUserDocument> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundException('User not found');
    }
    const doc = await this.userModel.findOne({
      _id: new Types.ObjectId(userId),
      event_id: eventId,
      deleted_at: null,
    });
    if (!doc) throw new NotFoundException('User not found');
    return doc;
  }

  private toResponse(
    doc: OpsUserDocument | Record<string, unknown>,
  ): UserResponseDto {
    const d = doc as Record<string, unknown> & { _id: Types.ObjectId };
    return {
      id: String(d._id),
      phone: String(d.phone),
      email: d.email as string | undefined,
      full_name: String(d.full_name),
      dob: d.dob ? new Date(d.dob as string | Date) : undefined,
      role: String(d.role),
      event_id: String(d.event_id),
      team_id: d.team_id ? String(d.team_id) : null,
      emergency_contact: d.emergency_contact as
        | { name: string; phone: string }
        | undefined,
      experience: d.experience as string | undefined,
      shift_preferences: d.shift_preferences as string | undefined,
      status: String(d.status),
      rejected_reason: d.rejected_reason as string | undefined,
      approved_by: d.approved_by ? String(d.approved_by) : null,
      approved_at: d.approved_at
        ? new Date(d.approved_at as string | Date)
        : undefined,
      created_at: new Date(d.created_at as string | Date),
      updated_at: new Date(d.updated_at as string | Date),
    };
  }
}
