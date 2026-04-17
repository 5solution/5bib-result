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
  AdminUpdateUserDto,
  ApplicationListQueryDto,
  PublicApplyDto,
  PublicApplyResponseDto,
  RejectApplicationDto,
  UserListResponseDto,
  UserQrBadgeResponseDto,
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

  /**
   * BR-02: `scopeTeamId` truthy → hard-filter filter.team_id = scopeTeamId,
   * bỏ qua query.team_id do client gửi (ngăn leader thử nhìn team khác bằng
   * query string). scopeTeamId undefined = ops_admin, cho phép query.team_id.
   */
  async list(
    tenantId: string,
    eventId: string,
    query: ApplicationListQueryDto,
    scopeTeamId?: string,
  ): Promise<UserListResponseDto> {
    const event = await this.findEvent(tenantId, eventId);

    const filter: Record<string, unknown> = {
      event_id: event._id,
      deleted_at: null,
    };
    if (query.status) filter.status = query.status;
    if (query.role) filter.role = query.role;

    if (scopeTeamId) {
      if (!Types.ObjectId.isValid(scopeTeamId)) {
        // JWT team_id malformed → treat as no access thay vì 500
        return { items: [], total: 0 };
      }
      filter.team_id = new Types.ObjectId(scopeTeamId);
    } else if (query.team_id) {
      filter.team_id = new Types.ObjectId(query.team_id);
    }

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

  /**
   * BR-02: `scopeTeamId` truthy (leader) →
   *  1. Target user hiện phải thuộc team của leader (user.team_id === scopeTeamId).
   *     Null/khác team → 404 (giấu existence, không leak cross-team).
   *  2. Nếu body.team_id có, phải bằng scopeTeamId (leader không được "gán lại"
   *     TNV sang team khác).
   * scopeTeamId undefined (admin) → bypass cả 2 check.
   */
  async approve(
    tenantId: string,
    eventId: string,
    userId: string,
    approvedBy: string,
    teamId?: string,
    scopeTeamId?: string,
    request?: Request,
  ): Promise<UserResponseDto> {
    const event = await this.findEvent(tenantId, eventId);
    const user = await this.findUser(event._id, userId);

    // BR-02 enforcement — trước status check để không leak trạng thái user cross-team
    if (scopeTeamId) {
      if (
        !user.team_id ||
        String(user.team_id) !== scopeTeamId
      ) {
        // 404 thay vì 403 để không confirm user tồn tại ở team khác
        throw new NotFoundException('User not found');
      }
      if (teamId && teamId !== scopeTeamId) {
        throw new ForbiddenException(
          'Leader can only approve into their own team',
        );
      }
    }

    // Defense-in-depth: chỉ TNV mới được approve qua endpoint này. Crew/leader
    // phải tạo bằng adminCreateUser (auto-APPROVED). Ngăn privilege escalation
    // nếu migration/bug tạo PENDING user role khác ops_tnv.
    if (user.role !== 'ops_tnv') {
      throw new ForbiddenException(
        'Only TNV applications can be approved via this endpoint',
      );
    }

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

  /**
   * BR-02: `scopeTeamId` truthy (leader) → target user phải thuộc team của leader.
   * Khác team / null team → 404 (giấu existence, same rationale như approve()).
   */
  async reject(
    tenantId: string,
    eventId: string,
    userId: string,
    rejectedBy: string,
    dto: RejectApplicationDto,
    scopeTeamId?: string,
    request?: Request,
  ): Promise<UserResponseDto> {
    const event = await this.findEvent(tenantId, eventId);
    const user = await this.findUser(event._id, userId);

    // BR-02 enforcement — trước status check
    if (scopeTeamId) {
      if (!user.team_id || String(user.team_id) !== scopeTeamId) {
        throw new NotFoundException('User not found');
      }
    }

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

  /* ─────────── ADMIN: update profile / reassign team ─────────── */

  async adminUpdateUser(
    tenantId: string,
    eventId: string,
    userId: string,
    updatedBy: string,
    dto: AdminUpdateUserDto,
    request?: Request,
  ): Promise<UserResponseDto> {
    const event = await this.findEvent(tenantId, eventId);
    const user = await this.findUser(event._id, userId);

    const patch: Record<string, unknown> = {};
    if (dto.full_name !== undefined) patch.full_name = dto.full_name.trim();
    if (dto.email !== undefined) {
      patch.email = dto.email ? dto.email.trim().toLowerCase() : undefined;
    }
    if (dto.dob !== undefined) {
      patch.dob = dto.dob ? new Date(dto.dob) : undefined;
    }
    if (dto.emergency_contact !== undefined) {
      patch.emergency_contact = dto.emergency_contact;
    }
    if (dto.experience !== undefined) patch.experience = dto.experience;
    if (dto.shift_preferences !== undefined) {
      patch.shift_preferences = dto.shift_preferences;
    }

    // Phone change: enforce uniqueness per event
    if (dto.phone !== undefined && dto.phone.trim() !== user.phone) {
      const normalized = dto.phone.trim();
      const conflict = await this.userModel
        .findOne({
          event_id: event._id,
          phone: normalized,
          _id: { $ne: user._id },
          deleted_at: null,
        })
        .lean();
      if (conflict) {
        throw new ConflictException(
          'Số điện thoại đã tồn tại trong event',
        );
      }
      patch.phone = normalized;
    }

    // Team reassignment rules:
    //  - admin (leader role): không cho unassign (leader luôn phải có team)
    //  - tnv: cho phép unassign (null) hoặc gán team mới
    //  - crew: cho phép
    if (dto.team_id !== undefined) {
      if (dto.team_id === null || dto.team_id === '') {
        if (user.role === 'ops_leader') {
          throw new BadRequestException(
            'Leader không được unassign team (phải có team trách nhiệm)',
          );
        }
        patch.team_id = null;
      } else {
        if (!Types.ObjectId.isValid(dto.team_id)) {
          throw new NotFoundException('Team not found');
        }
        const team = await this.teamModel
          .findOne({
            _id: new Types.ObjectId(dto.team_id),
            event_id: event._id,
            deleted_at: null,
          })
          .lean();
        if (!team) throw new NotFoundException('Team not found');
        patch.team_id = team._id;
      }
    }

    await this.userModel.updateOne({ _id: user._id }, { $set: patch });

    await this.auditService.log({
      event_id: event._id,
      user_id: updatedBy,
      action: 'UPDATE_USER',
      entity_type: 'ops_users',
      entity_id: user._id,
      payload: patch,
      request,
    });

    const fresh = await this.userModel
      .findById(user._id)
      .select('-password_hash -qr_token_hash')
      .lean();
    if (!fresh) throw new NotFoundException('User disappeared');
    return this.toResponse(fresh);
  }

  /* ─────────── ADMIN: issue/rotate QR badge ─────────── */

  /**
   * Rotates QR token — returns plain once (for printing badge). Previous
   * physical badge becomes invalid. Chỉ hoạt động với user đã APPROVED/ACTIVE.
   * Leader không có qr_token_hash (login password); chỉ crew/tnv dùng QR.
   */
  async issueQrBadge(
    tenantId: string,
    eventId: string,
    userId: string,
    issuedBy: string,
    request?: Request,
  ): Promise<UserQrBadgeResponseDto> {
    const event = await this.findEvent(tenantId, eventId);
    const user = await this.findUser(event._id, userId);

    if (!['APPROVED', 'ACTIVE'].includes(user.status)) {
      throw new BadRequestException(
        `User status is ${user.status} — phải APPROVED/ACTIVE mới issue QR`,
      );
    }
    if (!['ops_crew', 'ops_tnv'].includes(user.role)) {
      throw new BadRequestException(
        `Role ${user.role} không dùng QR badge (chỉ crew/tnv)`,
      );
    }

    const qr = genQrToken();
    await this.userModel.updateOne(
      { _id: user._id },
      { $set: { qr_token_hash: qr.hash } },
    );

    await this.auditService.log({
      event_id: event._id,
      user_id: issuedBy,
      action: 'ISSUE_QR_BADGE',
      entity_type: 'ops_users',
      entity_id: user._id,
      payload: { role: user.role },
      request,
    });

    let teamName: string | null = null;
    if (user.team_id) {
      const team = await this.teamModel
        .findById(user.team_id)
        .select('name')
        .lean();
      if (team) teamName = team.name;
    }

    return {
      user_id: String(user._id),
      full_name: user.full_name,
      phone: user.phone,
      role: user.role,
      qr_token: qr.plain,
      team_name: teamName,
    };
  }

  /* ─────────── ADMIN: CSV export ─────────── */

  /**
   * Export CSV users trong event. Columns:
   *   id,phone,full_name,email,role,status,team_name,team_code,
   *   approved_at,created_at,experience,shift_preferences
   * Encode UTF-8 BOM để Excel hiện tiếng Việt đúng.
   */
  async exportCsv(
    tenantId: string,
    eventId: string,
    filter?: { status?: string; role?: string; team_id?: string },
  ): Promise<string> {
    const event = await this.findEvent(tenantId, eventId);

    const mongoFilter: Record<string, unknown> = {
      event_id: event._id,
      deleted_at: null,
    };
    if (filter?.status) mongoFilter.status = filter.status;
    if (filter?.role) mongoFilter.role = filter.role;
    if (filter?.team_id && Types.ObjectId.isValid(filter.team_id)) {
      mongoFilter.team_id = new Types.ObjectId(filter.team_id);
    }

    const [users, teams] = await Promise.all([
      this.userModel
        .find(mongoFilter)
        .select('-password_hash -qr_token_hash')
        .sort({ created_at: -1 })
        .lean(),
      this.teamModel
        .find({ event_id: event._id, deleted_at: null })
        .select('_id name code')
        .lean(),
    ]);
    const teamMap = new Map(teams.map((t) => [String(t._id), t]));

    const header = [
      'id',
      'phone',
      'full_name',
      'email',
      'role',
      'status',
      'team_name',
      'team_code',
      'approved_at',
      'created_at',
      'experience',
      'shift_preferences',
    ];

    const escape = (v: unknown): string => {
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/\r?\n/g, ' ');
      if (/[",]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const rows = users.map((u) => {
      const t = u.team_id ? teamMap.get(String(u.team_id)) : undefined;
      return [
        String(u._id),
        u.phone,
        u.full_name,
        u.email ?? '',
        u.role,
        u.status,
        t?.name ?? '',
        t?.code ?? '',
        u.approved_at ? new Date(u.approved_at).toISOString() : '',
        u.created_at ? new Date(u.created_at).toISOString() : '',
        u.experience ?? '',
        u.shift_preferences ?? '',
      ].map(escape).join(',');
    });

    // UTF-8 BOM → Excel mở đúng tiếng Việt
    return '\uFEFF' + header.join(',') + '\n' + rows.join('\n') + '\n';
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
