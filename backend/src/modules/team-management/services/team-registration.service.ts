import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  EventFeaturesConfigDto,
  UpdateEventFeaturesDto,
  NghiemThuResponseDto,
} from '../dto/event-features.dto';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository, QueryFailedError } from 'typeorm';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';
import { env } from 'src/config';
import { MailService } from 'src/modules/notification/mail.service';
import { VolEvent } from '../entities/vol-event.entity';
import { VolRole, FormFieldConfig } from '../entities/vol-role.entity';
import { VN_BANKS, normalizeHolderName } from '../constants/banks';

const OUR_S3_PREFIXES = (() => {
  const bucket = env.teamManagement.s3Bucket;
  const region = env.s3.region;
  return [
    `https://${bucket}.s3.${region}.amazonaws.com/team-photos/`,
    `https://${bucket}.s3.amazonaws.com/team-photos/`,
    env.s3.cdnUrl ? `${env.s3.cdnUrl.replace(/\/$/, '')}/team-photos/` : null,
  ].filter((s): s is string => !!s);
})();
import {
  RegistrationStatus,
  REGISTRATION_STATUS_VALUES,
  ShirtSize,
  VolRegistration,
} from '../entities/vol-registration.entity';
import { RegisterDto } from '../dto/register.dto';
import {
  RegisterResponseDto,
  StatusResponseDto,
} from '../dto/response.dto';
import {
  ListRegistrationsResponseDto,
  RegistrationListRowDto,
} from '../dto/registration-row.dto';
import { UpdateRegistrationDto } from '../dto/update-registration.dto';
import { BackfillBenBDto } from '../dto/backfill-ben-b.dto';
import { UpdateProfileDto, UpdateProfileResponseDto } from '../dto/update-profile.dto';
import {
  BulkAction,
  BulkUpdateRegistrationsDto,
  BulkUpdateResponseDto,
} from '../dto/bulk-update.dto';
import { RegistrationDetailDto } from '../dto/registration-detail.dto';
import { AdminManualRegisterDto } from '../dto/manual-register.dto';
import { TeamCacheService } from './team-cache.service';
import { TeamPhotoService } from './team-photo.service';

const VALID_SHIRT_SIZES: ShirtSize[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * v1.4 state machine — only these transitions are legal. Centralised here
 * so every caller (approve / reject / cancel / contract / checkin / complete)
 * goes through one guard.
 *
 * Terminal states: rejected, cancelled (no outgoing edges).
 */
const ALLOWED_TRANSITIONS: Readonly<Record<RegistrationStatus, RegistrationStatus[]>> = {
  pending_approval: ['approved', 'rejected', 'waitlisted', 'cancelled'],
  // approved → qr_sent is the "no-contract" fast-path: when the role has
  // no contract_template_id, we skip contract_sent/contract_signed and
  // deliver the QR + portal email directly (see TeamContractService
  // .sendContractForRegistrationId). Contract flow is unchanged.
  approved: ['contract_sent', 'qr_sent', 'rejected', 'cancelled'],
  contract_sent: ['contract_signed', 'cancelled'],
  contract_signed: ['qr_sent', 'cancelled'],
  qr_sent: ['checked_in', 'cancelled'],
  checked_in: ['completed', 'cancelled'],
  completed: [], // terminal-ish — only admin /clear-suspicious / /confirm-completion idempotency
  waitlisted: ['pending_approval', 'cancelled'],
  rejected: [],
  cancelled: [],
};

@Injectable()
export class TeamRegistrationService {
  private readonly logger = new Logger(TeamRegistrationService.name);

  constructor(
    @InjectDataSource('volunteer') private readonly dataSource: DataSource,
    @InjectRepository(VolRegistration, 'volunteer')
    private readonly regRepo: Repository<VolRegistration>,
    @InjectRepository(VolRole, 'volunteer')
    private readonly roleRepo: Repository<VolRole>,
    @InjectRepository(VolEvent, 'volunteer')
    private readonly eventRepo: Repository<VolEvent>,
    private readonly cache: TeamCacheService,
    private readonly mail: MailService,
    private readonly photos: TeamPhotoService,
  ) {}

  /**
   * Central state-machine guard. Throws 400 if the transition isn't in
   * ALLOWED_TRANSITIONS. Returns the new status so callers can chain.
   */
  private assertTransition(from: RegistrationStatus, to: RegistrationStatus): void {
    const allowed = ALLOWED_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException(
        `Invalid status transition: ${from} → ${to}`,
      );
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // Public registration
  // ──────────────────────────────────────────────────────────────────────

  /**
   * Public registration — atomic transaction with pessimistic write lock on
   * the role row to prevent two users grabbing the same last slot. Under the
   * v1.4 state machine every new registration starts at pending_approval
   * (admin must approve), unless the role is full and waitlist is enabled
   * → waitlisted. Legacy auto_approve=true on the role is IGNORED for the
   * public register path (OQ-3: admin must approve).
   */
  async register(dto: RegisterDto): Promise<RegisterResponseDto> {
    const { regId, eventId, outcome } = await this.dataSource.transaction(async (m) => {
      const role = await m
        .getRepository(VolRole)
        .createQueryBuilder('r')
        .setLock('pessimistic_write')
        .where('r.id = :id', { id: dto.role_id })
        .getOne();
      if (!role) throw new NotFoundException('Role not found');

      const event = await m
        .getRepository(VolEvent)
        .createQueryBuilder('e')
        .setLock('pessimistic_write')
        .where('e.id = :id', { id: role.event_id })
        .getOne();
      if (!event) throw new NotFoundException('Event not found');
      if (event.status !== 'open') {
        throw new BadRequestException('Event not open for registration');
      }
      const now = new Date();
      if (event.registration_open > now || event.registration_close < now) {
        throw new BadRequestException('Registration window closed');
      }

      this.validateFormData(role.form_fields, dto.form_data);
      this.validateBankFields(role.form_fields, dto.form_data, dto.full_name);
      this.validatePhotoUrls(dto.form_data);

      const existing = await m.getRepository(VolRegistration).findOne({
        where: { email: dto.email, role_id: dto.role_id },
      });
      if (existing) {
        throw new ConflictException('This email is already registered for this role');
      }

      // v1.4: always pending_approval unless slots are full AND waitlist enabled.
      // filled_slots is incremented only when admin approves (see approveRegistration).
      const hasSlot = role.filled_slots < role.max_slots;
      let assignedStatus: RegistrationStatus;
      if (hasSlot) {
        assignedStatus = 'pending_approval';
      } else if (role.waitlist_enabled) {
        assignedStatus = 'waitlisted';
      } else {
        throw new BadRequestException('Role is full and waitlist is disabled');
      }
      const isWaitlisted = assignedStatus === 'waitlisted';

      let waitlistPosition: number | null = null;
      if (isWaitlisted) {
        const maxPos = await m
          .getRepository(VolRegistration)
          .createQueryBuilder('r')
          .select('COALESCE(MAX(r.waitlist_position), 0)', 'max')
          .where('r.role_id = :id', { id: dto.role_id })
          .andWhere('r.status = :s', { s: 'waitlisted' })
          .getRawOne<{ max: string }>();
        waitlistPosition = Number(maxPos?.max ?? 0) + 1;
      }

      const magicToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = this.expiry();

      const shirtSize = this.extractShirtSize(dto.form_data);
      const avatarUrl = this.extractString(dto.form_data, 'avatar_photo');
      const cccdUrl = this.extractString(dto.form_data, 'cccd_photo');
      // v037: CCCD back face is required for the contract / acceptance to
      // render with full identity data — enforce here regardless of role
      // form_fields config so existing roles don't bypass the requirement.
      const cccdBackUrl = this.extractString(dto.form_data, 'cccd_back_photo');
      if (!cccdBackUrl) {
        throw new BadRequestException(
          'Vui lòng chụp và upload ảnh CCCD/CMND mặt sau (bắt buộc để lập hợp đồng).',
        );
      }
      // v037: Free-text professional background. Optional.
      const expertise = this.extractString(dto.form_data, 'expertise');

      // v037+: Persist Bên B identity fields directly to dedicated columns
      // so contract / acceptance rendering can use them without relying on
      // admin backfill. Form uses `dob` legacy key — alias to birth_date.
      const birthDateRaw =
        this.extractString(dto.form_data, 'birth_date') ||
        this.extractString(dto.form_data, 'dob');
      const cccdIssueDateRaw = this.extractString(dto.form_data, 'cccd_issue_date');
      const cccdIssuePlaceRaw = this.extractString(dto.form_data, 'cccd_issue_place');
      // YYYY-MM-DD strings are stored as-is on date columns (MariaDB casts).
      const birthDate = birthDateRaw && /^\d{4}-\d{2}-\d{2}$/.test(birthDateRaw) ? birthDateRaw : null;
      const cccdIssueDate = cccdIssueDateRaw && /^\d{4}-\d{2}-\d{2}$/.test(cccdIssueDateRaw) ? cccdIssueDateRaw : null;

      const reg = m.getRepository(VolRegistration).create({
        role_id: dto.role_id,
        event_id: role.event_id,
        full_name: dto.full_name,
        email: dto.email,
        phone: dto.phone,
        form_data: dto.form_data,
        shirt_size: shirtSize,
        avatar_photo_url: avatarUrl,
        cccd_photo_url: cccdUrl,
        cccd_back_photo_url: cccdBackUrl,
        expertise: expertise || null,
        birth_date: birthDate,
        cccd_issue_date: cccdIssueDate,
        cccd_issue_place: cccdIssuePlaceRaw || null,
        status: assignedStatus,
        waitlist_position: waitlistPosition,
        magic_token: magicToken,
        magic_token_expires: expiresAt,
        // QR is only issued once the person reaches `qr_sent` (after signing).
        qr_code: null,
      });

      let saved: VolRegistration;
      try {
        saved = await m.getRepository(VolRegistration).save(reg);
      } catch (err) {
        if (this.isDupEntry(err)) {
          throw new ConflictException('This email is already registered for this role');
        }
        throw err;
      }

      return {
        regId: saved.id,
        eventId: role.event_id,
        outcome: {
          status: saved.status as 'pending_approval' | 'waitlisted',
          waitlist_position: saved.waitlist_position,
          magic_token: saved.magic_token,
          event_name: event.event_name,
          role_name: role.role_name,
        },
      };
    });

    await this.cache.invalidateEvent(eventId, [dto.role_id]);

    // Email the waitlist notification immediately; pending_approval gets
    // "registration received" messaging inline in the HTTP response.
    if (outcome.status === 'waitlisted') {
      void this.sendWaitlistedEmail(regId, outcome).catch((err) =>
        this.logger.warn(`waitlist email failed reg=${regId}: ${err.message}`),
      );
    }

    const message =
      outcome.status === 'waitlisted'
        ? `Bạn đang ở danh sách chờ (vị trí ${outcome.waitlist_position}). Chúng tôi sẽ email khi có slot.`
        : 'Đã nhận đăng ký. Ban tổ chức sẽ duyệt và thông báo qua email trong vòng 24h.';
    // SECURITY: DO NOT return magic_link here. The portal token is sent to
    // the crew member by email only after admin approval. Echoing it to the
    // anonymous register caller would let anyone who submits a form (with
    // or without a valid email) hit /status/:token and see the profile
    // they just posted, and for auto_approve=true roles they'd bypass
    // approval entirely. magic_link is only ever returned on admin
    // manual-register responses (see manualRegister below).
    return {
      id: regId,
      status: outcome.status,
      waitlist_position: outcome.waitlist_position,
      message,
    };
  }

  /**
   * Admin manual-create. Per Danny Q3: when `auto_approve=true`, skip the
   * pending_approval stage and land directly in `approved` — then fire the
   * contract-send chain immediately. When `auto_approve=false` behaves like
   * the public path (pending_approval).
   */
  async adminManualRegister(
    dto: AdminManualRegisterDto,
    adminIdentity: string,
    opts: { skipRequiredPhotos?: boolean; skipAllRequired?: boolean } = {},
  ): Promise<RegisterResponseDto> {
    const autoApprove = dto.auto_approve !== false;

    const { regId, eventId, outcome } = await this.dataSource.transaction(async (m) => {
      const role = await m
        .getRepository(VolRole)
        .createQueryBuilder('r')
        .setLock('pessimistic_write')
        .where('r.id = :id', { id: dto.role_id })
        .getOne();
      if (!role) throw new NotFoundException('Role not found');

      const event = await m
        .getRepository(VolEvent)
        .createQueryBuilder('e')
        .setLock('pessimistic_write')
        .where('e.id = :id', { id: role.event_id })
        .getOne();
      if (!event) throw new NotFoundException('Event not found');

      this.validateFormData(role.form_fields, dto.form_data, opts);
      this.validateBankFields(role.form_fields, dto.form_data, dto.full_name);
      this.validatePhotoUrls(dto.form_data);

      const existing = await m.getRepository(VolRegistration).findOne({
        where: { email: dto.email, role_id: dto.role_id },
      });
      if (existing) {
        throw new ConflictException('This email is already registered for this role');
      }

      const hasSlot = role.filled_slots < role.max_slots;
      let assignedStatus: RegistrationStatus;
      if (autoApprove) {
        if (hasSlot) assignedStatus = 'approved';
        else if (role.waitlist_enabled) assignedStatus = 'waitlisted';
        else throw new BadRequestException('Role is full and waitlist is disabled');
      } else {
        if (hasSlot) assignedStatus = 'pending_approval';
        else if (role.waitlist_enabled) assignedStatus = 'waitlisted';
        else throw new BadRequestException('Role is full and waitlist is disabled');
      }

      const isApproved = assignedStatus === 'approved';
      const isWaitlisted = assignedStatus === 'waitlisted';

      let waitlistPosition: number | null = null;
      if (isWaitlisted) {
        const maxPos = await m
          .getRepository(VolRegistration)
          .createQueryBuilder('r')
          .select('COALESCE(MAX(r.waitlist_position), 0)', 'max')
          .where('r.role_id = :id', { id: dto.role_id })
          .andWhere('r.status = :s', { s: 'waitlisted' })
          .getRawOne<{ max: string }>();
        waitlistPosition = Number(maxPos?.max ?? 0) + 1;
      }

      const magicToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = this.expiry();
      const shirtSize = this.extractShirtSize(dto.form_data);
      const avatarUrl = this.extractString(dto.form_data, 'avatar_photo');
      const cccdUrl = this.extractString(dto.form_data, 'cccd_photo');
      // v037 — admin manual register: CCCD back + expertise optional (admin
      // can fill via backfill modal). Public register path enforces CCCD back.
      const cccdBackUrl = this.extractString(dto.form_data, 'cccd_back_photo');
      const expertise = this.extractString(dto.form_data, 'expertise');

      const reg = m.getRepository(VolRegistration).create({
        role_id: dto.role_id,
        event_id: role.event_id,
        full_name: dto.full_name,
        email: dto.email,
        phone: dto.phone,
        form_data: dto.form_data,
        shirt_size: shirtSize,
        avatar_photo_url: avatarUrl,
        cccd_photo_url: cccdUrl,
        cccd_back_photo_url: cccdBackUrl,
        expertise: expertise || null,
        status: assignedStatus,
        waitlist_position: waitlistPosition,
        magic_token: magicToken,
        magic_token_expires: expiresAt,
        qr_code: null,
        notes: dto.notes ?? `Added manually by ${adminIdentity}`,
      });

      let saved: VolRegistration;
      try {
        saved = await m.getRepository(VolRegistration).save(reg);
      } catch (err) {
        if (this.isDupEntry(err)) {
          throw new ConflictException('This email is already registered for this role');
        }
        throw err;
      }

      if (isApproved) {
        await m.getRepository(VolRole).increment({ id: role.id }, 'filled_slots', 1);
      }

      return {
        regId: saved.id,
        eventId: role.event_id,
        outcome: {
          status: saved.status as
            | 'pending_approval'
            | 'approved'
            | 'waitlisted',
          waitlist_position: saved.waitlist_position,
          magic_token: saved.magic_token,
          event_name: event.event_name,
          role_name: role.role_name,
        },
      };
    });

    this.logger.log(
      `MANUAL_REGISTER admin=${adminIdentity} reg=${regId} status=${outcome.status}`,
    );
    await this.cache.invalidateEvent(eventId, [dto.role_id]);

    if (outcome.status === 'waitlisted') {
      void this.sendWaitlistedEmail(regId, outcome).catch((err) =>
        this.logger.warn(`manual-register waitlist email failed reg=${regId}: ${err.message}`),
      );
    }

    // Auto-chain approve → contract_sent only if landed in approved. Kept
    // side-effect of approveRegistration's email flow by calling it here
    // with a synthetic re-transition — but simplest is to just let the
    // contract service's sendContractToRegistration run next tick.
    if (outcome.status === 'approved') {
      // Defer: contract send will be triggered by the caller / bulk job
      // or by explicitly calling roles/:id/send-contracts. For manual
      // register we eagerly mark approved and let the admin fire contract.
      // This keeps the coupling loose and avoids a circular dep between
      // TeamRegistrationService ↔ TeamContractService at construction.
      this.logger.log(
        `MANUAL_REGISTER reg=${regId} landed in approved; admin must trigger contract send.`,
      );
    }

    return {
      id: regId,
      status: outcome.status,
      waitlist_position: outcome.waitlist_position,
      message:
        outcome.status === 'approved'
          ? `Đã thêm ${dto.full_name} với trạng thái approved — bấm "Gửi hợp đồng" để tiếp tục.`
          : outcome.status === 'waitlisted'
            ? `Đã thêm ${dto.full_name} vào danh sách chờ (vị trí ${outcome.waitlist_position}).`
            : `Đã thêm ${dto.full_name} với trạng thái chờ duyệt — cần duyệt sau.`,
      magic_link: this.buildMagicLink(outcome.magic_token),
    };
  }

  async getStatus(token: string): Promise<StatusResponseDto> {
    const reg = await this.regRepo.findOne({
      where: { magic_token: token },
      relations: { role: true, event: true },
    });
    if (!reg) throw new NotFoundException('Token not found');
    if (reg.magic_token_expires < new Date()) {
      throw new UnauthorizedException('Token expired');
    }
    // QR is only meaningful once we've reached qr_sent (post-sign).
    const qr =
      (reg.status === 'qr_sent' ||
        reg.status === 'checked_in' ||
        reg.status === 'completed') &&
      reg.qr_code
        ? await QRCode.toDataURL(reg.qr_code)
        : null;
    // v1.5 BR-CHAT-02: group chat link only visible to TNV who has signed the
    // contract. Platform is always exposed — icon hint alone leaks nothing.
    const canSeeChatLink =
      reg.status === 'contract_signed' ||
      reg.status === 'qr_sent' ||
      reg.status === 'checked_in' ||
      reg.status === 'completed';
    return {
      full_name: reg.full_name,
      role_name: reg.role?.role_name ?? '',
      event_name: reg.event?.event_name ?? '',
      status: reg.status,
      waitlist_position: reg.waitlist_position,
      contract_status: reg.contract_status,
      checked_in_at: reg.checked_in_at ? reg.checked_in_at.toISOString() : null,
      qr_code: qr,
      // v1.4.1 — profile-edit UI dependencies. The TNV owns this record so
      // CCCD is NOT masked here (they need to see their own number to edit).
      // cccd_photo_url stays omitted — the photo is re-uploaded separately.
      email: reg.email,
      phone: reg.phone,
      avatar_photo_url: reg.avatar_photo_url,
      // v037+ — surfaced so crew "missing profile" banner can react.
      // cccd_photo_url and cccd_back_photo_url are S3 keys (not presigned)
      // — frontend only checks truthy; the actual image is rendered in
      // form_data via the public upload endpoint that returned the URL.
      cccd_photo_url: reg.cccd_photo_url,
      cccd_back_photo_url: reg.cccd_back_photo_url,
      birth_date: reg.birth_date ? String(reg.birth_date) : null,
      cccd_issue_date: reg.cccd_issue_date ? String(reg.cccd_issue_date) : null,
      cccd_issue_place: reg.cccd_issue_place,
      form_data: this.ownerFormData(reg.form_data),
      form_fields: reg.role?.form_fields ?? [],
      has_pending_changes: reg.has_pending_changes,
      pending_changes: reg.has_pending_changes
        ? (reg.pending_changes ?? null)
        : null,
      pending_changes_submitted_at: reg.pending_changes_submitted_at
        ? reg.pending_changes_submitted_at.toISOString()
        : null,
      chat_platform: reg.role?.chat_platform ?? null,
      chat_group_url: canSeeChatLink ? (reg.role?.chat_group_url ?? null) : null,
      // v2.0 — acceptance + payment surfacing for the crew status page.
      acceptance_status: reg.acceptance_status,
      acceptance_sent_at: reg.acceptance_sent_at
        ? reg.acceptance_sent_at.toISOString()
        : null,
      acceptance_signed_at: reg.acceptance_signed_at
        ? reg.acceptance_signed_at.toISOString()
        : null,
      acceptance_value: reg.acceptance_value,
      // Only expose dispute reason when actually disputed — otherwise the
      // notes column may carry admin working notes the crew shouldn't see.
      acceptance_notes:
        reg.acceptance_status === 'disputed' ? reg.acceptance_notes : null,
      payment_status: reg.payment_status,
    };
  }

  async listForEvent(params: {
    eventId: number;
    status?: string;
    roleId?: number;
    search?: string;
    page: number;
    limit: number;
  }): Promise<ListRegistrationsResponseDto> {
    const baseQb = () =>
      this.regRepo
        .createQueryBuilder('r')
        .where('r.event_id = :eid', { eid: params.eventId });

    const qb = baseQb()
      .leftJoinAndSelect('r.role', 'role')
      .orderBy('r.created_at', 'DESC')
      .skip((params.page - 1) * params.limit)
      .take(params.limit);
    // Accept comma-separated list of statuses per v1.4 spec.
    const statuses = this.parseStatusFilter(params.status);
    if (statuses.length > 0) {
      qb.andWhere('r.status IN (:...statuses)', { statuses });
    }
    if (params.roleId) qb.andWhere('r.role_id = :rid', { rid: params.roleId });
    if (params.search) {
      qb.andWhere('(r.full_name LIKE :q OR r.email LIKE :q OR r.phone LIKE :q)', {
        q: `%${params.search}%`,
      });
    }
    const [rows, total] = await qb.getManyAndCount();

    // by_status: count across the full event (ignoring status/role/search
    // filters) so filter tabs show the true totals even when a filter is
    // already active.
    const statusRows = await baseQb()
      .select('r.status', 'status')
      .addSelect('COUNT(r.id)', 'count')
      .groupBy('r.status')
      .getRawMany<{ status: string; count: string }>();
    const by_status: Record<string, number> = {};
    for (const s of REGISTRATION_STATUS_VALUES) by_status[s] = 0;
    for (const row of statusRows) by_status[row.status] = Number(row.count);

    return {
      data: rows.map((r) => this.toListRow(r)),
      total,
      by_status,
    };
  }

  private parseStatusFilter(raw: string | undefined): RegistrationStatus[] {
    if (!raw) return [];
    const allowed = new Set<string>(REGISTRATION_STATUS_VALUES);
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter((s): s is RegistrationStatus => allowed.has(s));
  }

  /**
   * Full admin detail — CCCD number NOT masked; CCCD photo served via 1h
   * presigned S3 URL. Every successful CCCD access is audit-logged with
   * the admin identity per spec Danger Zone #5.
   */
  async getDetail(
    id: number,
    adminIdentity: string,
  ): Promise<RegistrationDetailDto> {
    const reg = await this.regRepo.findOne({
      where: { id },
      relations: { role: true, event: true },
    });
    if (!reg) throw new NotFoundException('Registration not found');

    let cccdPhotoUrl: string | null = null;
    if (reg.cccd_photo_url) {
      try {
        cccdPhotoUrl = await this.photos.presignCccd(reg.cccd_photo_url, 3600);
        this.logger.log(
          `CCCD_ACCESS admin=${adminIdentity} reg=${id} event=${reg.event_id} role=${reg.role?.role_name ?? '?'}`,
        );
      } catch (err) {
        this.logger.warn(
          `Failed to presign CCCD reg=${id} admin=${adminIdentity}: ${(err as Error).message}`,
        );
      }
    }

    // v037: presign back face URL for admin display. Same audit/log path as
    // the front face — this is identity data and must never leak to non-admin.
    let cccdBackPhotoUrl: string | null = null;
    if (reg.cccd_back_photo_url) {
      try {
        cccdBackPhotoUrl = await this.photos.presignCccd(
          reg.cccd_back_photo_url,
          3600,
        );
      } catch (err) {
        this.logger.warn(
          `Failed to presign CCCD-back reg=${id} admin=${adminIdentity}: ${(err as Error).message}`,
        );
      }
    }

    // Audit every detail-view that exposes the magic token — lets us trace
    // any "a TNV's account was used without their knowledge" incident back to
    // which admin pulled the token and when.
    this.logger.log(
      `MAGIC_LINK_VIEW admin=${adminIdentity} reg=${id} event=${reg.event_id} expires=${reg.magic_token_expires.toISOString()}`,
    );
    return {
      id: reg.id,
      role_id: reg.role_id,
      role_name: reg.role?.role_name ?? '',
      event_id: reg.event_id,
      event_name: reg.event?.event_name ?? '',
      full_name: reg.full_name,
      email: reg.email,
      phone: reg.phone,
      shirt_size: reg.shirt_size,
      avatar_photo_url: reg.avatar_photo_url,
      cccd_photo_url: cccdPhotoUrl,
      cccd_back_photo_url: cccdBackPhotoUrl,
      expertise: reg.expertise,
      form_data: reg.form_data,
      status: reg.status,
      waitlist_position: reg.waitlist_position,
      checked_in_at: reg.checked_in_at ? reg.checked_in_at.toISOString() : null,
      checkin_method: reg.checkin_method,
      contract_status: reg.contract_status,
      contract_signed_at: reg.contract_signed_at
        ? reg.contract_signed_at.toISOString()
        : null,
      contract_pdf_url: reg.contract_pdf_url,
      has_signature: !!reg.contract_signature_url,
      actual_working_days: reg.actual_working_days,
      actual_compensation: reg.actual_compensation,
      payment_status: reg.payment_status,
      notes: reg.notes,
      created_at: reg.created_at.toISOString(),
      role_daily_rate: reg.role ? String(reg.role.daily_rate) : undefined,
      role_working_days: reg.role ? reg.role.working_days : undefined,
      // v1.4.1 — profile-edit workflow
      has_pending_changes: reg.has_pending_changes,
      pending_changes: reg.has_pending_changes
        ? (reg.pending_changes ?? null)
        : null,
      pending_changes_submitted_at: reg.pending_changes_submitted_at
        ? reg.pending_changes_submitted_at.toISOString()
        : null,
      // Magic-link recovery — expose to admin so they can resend manually.
      // Audit-logged below. Token is already leaked through contract/status
      // emails, so admin access here adds no net privilege escalation.
      //
      // v1.8 Leader portal expiry: for leader roles, the magic link stays valid
      // until event_end_date + 7 days (see validateLeaderToken). Display the
      // REAL expiry so the admin doesn't think the link is dead after 7 days.
      magic_link: this.buildMagicLink(reg.magic_token),
      magic_token: reg.magic_token,
      magic_token_expires: (() => {
        if (reg.role?.is_leader_role && reg.event?.event_end_date) {
          const d = new Date(reg.event.event_end_date);
          d.setDate(d.getDate() + 7);
          d.setHours(23, 59, 59, 999);
          return d.toISOString();
        }
        return reg.magic_token_expires.toISOString();
      })(),
      // v2.0 — Acceptance + contract_number
      contract_number: reg.contract_number,
      acceptance_status: reg.acceptance_status,
      acceptance_value: reg.acceptance_value,
      acceptance_sent_at: reg.acceptance_sent_at
        ? reg.acceptance_sent_at.toISOString()
        : null,
      acceptance_signed_at: reg.acceptance_signed_at
        ? reg.acceptance_signed_at.toISOString()
        : null,
      // Return the raw S3 key — admin UI opens via the public token
      // endpoint GET /public/team-acceptance-pdf/:magic_token when needed.
      acceptance_pdf_url: reg.acceptance_pdf_url,
      acceptance_notes: reg.acceptance_notes,
      // Bên B (birth_date / cccd issue) — required for contract rendering.
      birth_date: reg.birth_date,
      cccd_issue_date: reg.cccd_issue_date,
      cccd_issue_place: reg.cccd_issue_place,
      // Force-paid audit trail (NULL on standard markPaid flow)
      payment_forced_reason: reg.payment_forced_reason,
      payment_forced_at: reg.payment_forced_at
        ? reg.payment_forced_at.toISOString()
        : null,
      payment_forced_by: reg.payment_forced_by,
    };
  }

  /**
   * Bulk approve/reject/cancel. Iterates and calls the same per-row service
   * method the single-row endpoints use, so side-effects (email, slot
   * increment, waitlist promotion) all run correctly per row.
   */
  async bulkUpdate(
    dto: BulkUpdateRegistrationsDto,
  ): Promise<BulkUpdateResponseDto> {
    let updated = 0;
    let skipped = 0;
    const failed: number[] = [];
    for (const id of dto.ids) {
      try {
        const reg = await this.regRepo.findOne({ where: { id } });
        if (!reg) {
          failed.push(id);
          continue;
        }
        const didMutate = await this.runBulkAction(id, dto.action, dto.reason);
        if (didMutate) updated++;
        else skipped++;
      } catch (err) {
        this.logger.warn(
          `Bulk update failed id=${id} action=${dto.action}: ${(err as Error).message}`,
        );
        failed.push(id);
      }
    }
    return { updated, skipped, failed_ids: failed };
  }

  private async runBulkAction(
    id: number,
    action: BulkAction,
    reason: string | undefined,
  ): Promise<boolean> {
    if (action === 'approve') {
      await this.approveRegistration(id);
      return true;
    }
    if (action === 'reject') {
      if (!reason || reason.trim().length === 0) {
        throw new BadRequestException(
          'rejection reason is required for bulk reject',
        );
      }
      await this.rejectRegistration(id, reason.trim());
      return true;
    }
    if (action === 'cancel') {
      await this.cancelRegistration(id, reason?.trim());
      return true;
    }
    return false;
  }

  // ──────────────────────────────────────────────────────────────────────
  // State transitions
  // ──────────────────────────────────────────────────────────────────────

  /**
   * Admin approves a pending registration. Increments filled_slots under
   * pessimistic lock, leaves status at 'approved'. The contract email is
   * the caller's responsibility — call TeamContractService.sendContractToRegistration
   * after this returns (or do it in the controller). Kept decoupled to
   * avoid a circular DI dep.
   */
  async approveRegistration(id: number): Promise<VolRegistration> {
    const result = await this.dataSource.transaction(async (m) => {
      const reg = await m
        .getRepository(VolRegistration)
        .createQueryBuilder('r')
        .setLock('pessimistic_write')
        .where('r.id = :id', { id })
        .getOne();
      if (!reg) throw new NotFoundException('Registration not found');

      this.assertTransition(reg.status, 'approved');

      const role = await m
        .getRepository(VolRole)
        .createQueryBuilder('r')
        .setLock('pessimistic_write')
        .where('r.id = :id', { id: reg.role_id })
        .getOne();
      if (!role) throw new NotFoundException('Role not found');
      if (role.filled_slots >= role.max_slots) {
        throw new BadRequestException('No slots available to approve');
      }

      await m.getRepository(VolRole).increment({ id: role.id }, 'filled_slots', 1);

      reg.status = 'approved';
      reg.waitlist_position = null;
      const saved = await m.getRepository(VolRegistration).save(reg);
      return saved;
    });

    await this.cache.invalidateEvent(result.event_id, [result.role_id]);
    this.logger.log(`APPROVE reg=${id} → approved`);
    return result;
  }

  /**
   * Admin rejects. Allowed from pending_approval OR approved (so admin can
   * reverse an early mistake before contract goes out). If the registration
   * held a slot (was approved), decrement filled_slots and auto-promote the
   * head of the waitlist.
   */
  async rejectRegistration(
    id: number,
    rejection_reason: string,
  ): Promise<VolRegistration> {
    if (!rejection_reason || rejection_reason.trim().length === 0) {
      throw new BadRequestException('rejection_reason is required');
    }

    const { updated, triggerRoleId } = await this.dataSource.transaction(async (m) => {
      const reg = await m
        .getRepository(VolRegistration)
        .createQueryBuilder('r')
        .setLock('pessimistic_write')
        .where('r.id = :id', { id })
        .getOne();
      if (!reg) throw new NotFoundException('Registration not found');

      this.assertTransition(reg.status, 'rejected');

      let triggerRoleId: number | null = null;
      if (reg.status === 'approved') {
        await m.getRepository(VolRole).decrement({ id: reg.role_id }, 'filled_slots', 1);
        triggerRoleId = reg.role_id;
      }

      reg.status = 'rejected';
      reg.rejection_reason = rejection_reason.trim();
      reg.waitlist_position = null;
      const saved = await m.getRepository(VolRegistration).save(reg);
      return { updated: saved, triggerRoleId };
    });

    await this.cache.invalidateEvent(updated.event_id, [updated.role_id]);
    this.logger.log(`REJECT reg=${id} → rejected`);

    // Fire emails + waitlist promote outside the transaction.
    void this.sendRejectionEmail(updated, rejection_reason.trim()).catch((err) =>
      this.logger.warn(`reject email failed reg=${id}: ${err.message}`),
    );
    if (triggerRoleId != null) {
      void this.promoteNextWaitlisted(updated.event_id, triggerRoleId).catch((err) =>
        this.logger.warn(`waitlist promote after reject failed: ${err.message}`),
      );
    }
    return updated;
  }

  /**
   * Admin cancels — allowed from any non-terminal state. If the row held a
   * slot (approved / contract_sent / contract_signed / qr_sent / checked_in),
   * free the slot and promote the next waitlisted.
   */
  async cancelRegistration(
    id: number,
    reason?: string,
  ): Promise<VolRegistration> {
    const { updated, triggerRoleId } = await this.dataSource.transaction(async (m) => {
      const reg = await m
        .getRepository(VolRegistration)
        .createQueryBuilder('r')
        .setLock('pessimistic_write')
        .where('r.id = :id', { id })
        .getOne();
      if (!reg) throw new NotFoundException('Registration not found');

      this.assertTransition(reg.status, 'cancelled');

      const heldSlot: RegistrationStatus[] = [
        'approved',
        'contract_sent',
        'contract_signed',
        'qr_sent',
        'checked_in',
        'completed',
      ];
      let triggerRoleId: number | null = null;
      if (heldSlot.includes(reg.status)) {
        await m.getRepository(VolRole).decrement({ id: reg.role_id }, 'filled_slots', 1);
        triggerRoleId = reg.role_id;
      } else if (reg.status === 'waitlisted' && reg.waitlist_position != null) {
        // Shift positions down for anyone after us in the queue.
        await m
          .getRepository(VolRegistration)
          .createQueryBuilder()
          .update()
          .set({ waitlist_position: () => 'waitlist_position - 1' })
          .where('role_id = :rid', { rid: reg.role_id })
          .andWhere('status = :s', { s: 'waitlisted' })
          .andWhere('waitlist_position > :p', { p: reg.waitlist_position })
          .execute();
      }

      reg.status = 'cancelled';
      reg.waitlist_position = null;
      if (reason && reason.trim().length > 0) {
        const stamp = this.timestamp();
        reg.notes = [reg.notes, `[${stamp}] Cancelled: ${reason.trim()}`]
          .filter((x): x is string => !!x)
          .join('\n');
      }
      const saved = await m.getRepository(VolRegistration).save(reg);
      return { updated: saved, triggerRoleId };
    });

    await this.cache.invalidateEvent(updated.event_id, [updated.role_id]);
    this.logger.log(`CANCEL reg=${id} → cancelled`);

    void this.mail
      .sendTeamCancelled({
        toEmail: updated.email,
        fullName: updated.full_name,
        eventName: '',
        roleName: '',
        reason,
      })
      .catch((err) =>
        this.logger.warn(`cancel email failed reg=${id}: ${err.message}`),
      );
    if (triggerRoleId != null) {
      void this.promoteNextWaitlisted(updated.event_id, triggerRoleId).catch((err) =>
        this.logger.warn(`waitlist promote after cancel failed: ${err.message}`),
      );
    }
    return updated;
  }

  /**
   * Admin confirms completion (override). Transitions checked_in → completed,
   * snapshots daily_rate × working_days, and clears suspicious_checkin (admin
   * override implicitly vouches).
   */
  async confirmCompletionByAdmin(
    id: number,
    note?: string,
  ): Promise<VolRegistration> {
    const updated = await this.dataSource.transaction(async (m) => {
      const reg = await m
        .getRepository(VolRegistration)
        .createQueryBuilder('r')
        .setLock('pessimistic_write')
        .where('r.id = :id', { id })
        .getOne();
      if (!reg) throw new NotFoundException('Registration not found');

      this.assertTransition(reg.status, 'completed');

      const role = await m
        .getRepository(VolRole)
        .findOne({ where: { id: reg.role_id } });
      if (!role) throw new NotFoundException('Role not found');

      const now = new Date();
      reg.status = 'completed';
      reg.completion_confirmed_at = now;
      reg.completion_confirmed_by = 'admin';
      reg.completion_confirmed_id = null;
      reg.suspicious_checkin = false;
      reg.snapshot_daily_rate = String(role.daily_rate);
      reg.snapshot_working_days = role.working_days;
      reg.actual_working_days = role.working_days;
      reg.actual_compensation = String(
        Number(role.daily_rate) * role.working_days,
      );
      if (note && note.trim().length > 0) {
        const stamp = this.timestamp();
        reg.notes = [reg.notes, `[${stamp}] Admin complete note: ${note.trim()}`]
          .filter((x): x is string => !!x)
          .join('\n');
      }
      return m.getRepository(VolRegistration).save(reg);
    });

    await this.cache.invalidateEvent(updated.event_id, [updated.role_id]);
    this.logger.log(`ADMIN_COMPLETE reg=${id} → completed`);
    return updated;
  }

  /**
   * Admin clears a suspicious flag. Note is required — appended to the
   * registration.notes field with a UTC timestamp for audit.
   */
  async clearSuspicious(
    id: number,
    admin_note: string,
    adminIdentity: string,
  ): Promise<VolRegistration> {
    if (!admin_note || admin_note.trim().length === 0) {
      throw new BadRequestException('admin_note is required');
    }
    const reg = await this.regRepo.findOne({ where: { id } });
    if (!reg) throw new NotFoundException('Registration not found');
    if (!reg.suspicious_checkin) {
      throw new BadRequestException('Registration is not flagged as suspicious');
    }
    const stamp = this.timestamp();
    reg.suspicious_checkin = false;
    reg.notes = [
      reg.notes,
      `[${stamp}] Suspicious cleared by ${adminIdentity}: ${admin_note.trim()}`,
    ]
      .filter((x): x is string => !!x)
      .join('\n');
    const saved = await this.regRepo.save(reg);
    await this.cache.invalidateEvent(saved.event_id, [saved.role_id]);
    this.logger.log(`CLEAR_SUSPICIOUS admin=${adminIdentity} reg=${id}`);
    return saved;
  }

  /**
   * Non-state PATCH — notes / payment / working_days edits. Used by
   * `PATCH /registrations/:id`. Guards payment_status='paid' against
   * suspicious_checkin per BR-LDR-06.
   */
  async updateRegistration(
    id: number,
    dto: UpdateRegistrationDto,
  ): Promise<VolRegistration> {
    const updated = await this.dataSource.transaction(async (m) => {
      const reg = await m
        .getRepository(VolRegistration)
        .findOne({ where: { id } });
      if (!reg) throw new NotFoundException('Registration not found');

      // ─── v2.1 — Profile fields (entity columns) ───
      // Each field is `undefined` = no change, `null` = clear, value = set.
      if (dto.full_name !== undefined) reg.full_name = dto.full_name;
      if (dto.phone !== undefined) reg.phone = dto.phone;
      if (dto.email !== undefined) reg.email = dto.email;
      if (dto.shirt_size !== undefined) reg.shirt_size = dto.shirt_size;
      if (dto.birth_date !== undefined) reg.birth_date = dto.birth_date as never;
      if (dto.cccd_issue_date !== undefined)
        reg.cccd_issue_date = dto.cccd_issue_date as never;
      if (dto.cccd_issue_place !== undefined)
        reg.cccd_issue_place = dto.cccd_issue_place;

      // ─── v2.1 — form_data JSON fields (legacy origin from public form) ───
      // Mirror the keys public RegisterDto uses so admin-edited values
      // surface under "Dữ liệu form" too.
      const fd: Record<string, unknown> = { ...(reg.form_data ?? {}) };
      let fdChanged = false;
      const writeFd = (k: string, v: string | null | undefined) => {
        if (v === undefined) return;
        if (v === null || v === '') delete fd[k];
        else fd[k] = v;
        fdChanged = true;
      };
      writeFd('cccd', dto.cccd);
      writeFd('bank_account_number', dto.bank_account_number);
      writeFd('bank_holder_name', dto.bank_holder_name);
      writeFd('bank_name', dto.bank_name);
      writeFd('bank_branch', dto.bank_branch);
      writeFd('address', dto.address);
      // Sync birth_date → form_data.dob (legacy alias used by some templates)
      if (dto.birth_date !== undefined) {
        if (dto.birth_date === null) delete fd.dob;
        else fd.dob = dto.birth_date;
        fdChanged = true;
      }
      if (fdChanged) reg.form_data = fd;

      if (dto.notes != null) reg.notes = dto.notes;

      if (dto.payment_status != null) {
        // v2.0 — paid transitions go through TeamPaymentService.markPaid so
        // the acceptance-signed gate isn't bypassed. The old in-place set
        // here would let an admin flip to 'paid' without a signed biên bản
        // nghiệm thu. Only allow pending→pending (no-op) or paid→pending
        // (revert) inline; pending→paid must call POST /:id/payment/mark-paid
        // or /force-paid.
        if (dto.payment_status === 'paid' && reg.payment_status !== 'paid') {
          throw new BadRequestException(
            'Dùng endpoint POST /registrations/:id/payment/mark-paid (hoặc force-paid) để chuyển sang "đã thanh toán". ' +
              'Endpoint này không bypass được cổng nghiệm thu.',
          );
        }
        if (dto.payment_status === 'paid' && reg.suspicious_checkin) {
          throw new BadRequestException(
            'Cần xem xét trước khi thanh toán — registration is flagged as suspicious. Clear the flag first.',
          );
        }
        // QC F-3: when reverting paid → pending, clear force-paid audit
        // columns so a later markPaid via the standard gate starts fresh
        // (and `was_forced` in MarkPaidResponseDto doesn't lie). Mirror
        // of TeamPaymentService.revertPaid. Without this, the stale
        // payment_forced_reason silently resurfaces on the next mark-paid.
        if (
          dto.payment_status === 'pending' &&
          reg.payment_status === 'paid'
        ) {
          reg.payment_forced_reason = null;
          reg.payment_forced_at = null;
          reg.payment_forced_by = null;
        }
        reg.payment_status = dto.payment_status;
      }

      if (dto.actual_working_days != null) {
        reg.actual_working_days = dto.actual_working_days;
        const role = await m
          .getRepository(VolRole)
          .findOne({ where: { id: reg.role_id } });
        if (role) {
          reg.actual_compensation = String(
            Number(role.daily_rate) * dto.actual_working_days,
          );
        }
      }

      return m.getRepository(VolRegistration).save(reg);
    });
    await this.cache.invalidateEvent(updated.event_id, [updated.role_id]);
    return updated;
  }

  /**
   * v2.0 — Admin backfill Bên B fields required for contract/acceptance
   * rendering. Writes entity columns (birth_date, cccd_issue_*) and
   * merges bank/address into form_data JSON.
   *
   * Any field left undefined on the DTO is NOT touched. Explicit null
   * clears the value. Admin fills this via the "Bổ sung thông tin Bên B"
   * modal on the registration detail page before sending HĐ.
   */
  async backfillBenB(
    id: number,
    dto: BackfillBenBDto,
    adminIdentity: string,
  ): Promise<VolRegistration> {
    const updated = await this.dataSource.transaction(async (m) => {
      const reg = await m
        .getRepository(VolRegistration)
        .findOne({ where: { id } });
      if (!reg) throw new NotFoundException('Registration not found');

      if (dto.birth_date !== undefined) reg.birth_date = dto.birth_date;
      if (dto.cccd_issue_date !== undefined)
        reg.cccd_issue_date = dto.cccd_issue_date;
      if (dto.cccd_issue_place !== undefined)
        reg.cccd_issue_place = dto.cccd_issue_place;

      // Merge bank/address into form_data JSON. Only touch keys the admin
      // explicitly sent.
      const form: Record<string, unknown> = { ...(reg.form_data ?? {}) };
      if (dto.bank_account_number !== undefined) {
        form.bank_account_number = dto.bank_account_number;
      }
      if (dto.bank_name !== undefined) {
        form.bank_name = dto.bank_name;
      }
      if (dto.address !== undefined) {
        form.address = dto.address;
      }
      reg.form_data = form;

      return m.getRepository(VolRegistration).save(reg);
    });
    this.logger.log(
      `BACKFILL_BEN_B admin=${adminIdentity} reg=${id} event=${updated.event_id}`,
    );
    await this.cache.invalidateEvent(updated.event_id, [updated.role_id]);
    return updated;
  }

  // ──────────────────────────────────────────────────────────────────────
  // v1.4.1 — TNV profile edit + admin re-approval
  // ──────────────────────────────────────────────────────────────────────

  /**
   * Editable top-level keys. Email is deliberately missing — it's part of
   * the uq_email_role unique index and allowing mutation would let TNVs
   * collide across rows.
   */
  private static readonly PROFILE_EDIT_ALLOWED = new Set([
    'full_name',
    'phone',
    'form_data',
  ]);

  /**
   * Public self-service profile edit from the crew site. Behaviour branches
   * on current status:
   *   pending_approval → apply directly (nothing committed yet, admin will
   *     see the updated values when they review the original registration).
   *   rejected / cancelled → 400 (terminal).
   *   everything else (approved, contract_sent, ..., completed) → store in
   *     pending_changes JSON, flag the row, email admin. Admin must call
   *     /approve-changes or /reject-changes to finalise.
   *
   * Photos flow via the existing /team-upload-photo endpoint — the TNV
   * uploads first, receives an S3 URL/key, and passes that back in
   * form_data. validatePhotoUrls enforces the origin check.
   */
  async submitProfileEdit(
    token: string,
    dto: UpdateProfileDto,
  ): Promise<UpdateProfileResponseDto> {
    const reg = await this.regRepo.findOne({
      where: { magic_token: token },
      relations: { role: true, event: true },
    });
    if (!reg) throw new NotFoundException('Token not found');
    if (reg.magic_token_expires < new Date()) {
      throw new UnauthorizedException('Token expired');
    }
    if (reg.status === 'rejected' || reg.status === 'cancelled') {
      throw new BadRequestException(
        'Không thể sửa thông tin ở trạng thái này',
      );
    }

    // Reject client attempts to change email even if it leaks through the
    // DTO (defense-in-depth — UpdateProfileDto doesn't declare an `email`
    // field but class-validator's whitelist is not enforced here).
    const raw = dto as unknown as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(raw, 'email')) {
      throw new BadRequestException(
        'Email không thể thay đổi sau khi đăng ký',
      );
    }

    // Strip unknown top-level keys to keep pending_changes clean and prevent
    // arbitrary-field writes to main row when applying.
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(dto)) {
      if (TeamRegistrationService.PROFILE_EDIT_ALLOWED.has(k) && v !== undefined) {
        patch[k] = this.sanitizeProfileValue(k, v);
      }
    }
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('Chưa có trường nào được cập nhật');
    }

    // If the patch touches form_data, merge it with the current form_data so
    // callers can submit partial updates (just the 3 fields they edited).
    if (patch.form_data) {
      patch.form_data = {
        ...(reg.form_data ?? {}),
        ...(patch.form_data as Record<string, unknown>),
      };
    }

    // Validate role-level constraints against the effective post-patch values
    // so bank-holder-name still matches the (possibly new) full_name, etc.
    const effectiveFullName =
      (patch.full_name as string | undefined) ?? reg.full_name;
    const effectiveFormData =
      (patch.form_data as Record<string, unknown> | undefined) ?? reg.form_data;

    if (reg.role?.form_fields) {
      // Only re-check required-ness for fields that were already populated
      // in the existing record (don't force the user to upload missing
      // photos just because they want to update their phone). The full
      // schema still validates options/format on the fields they DID touch.
      const touched = new Set<string>(
        patch.form_data
          ? Object.keys(patch.form_data as Record<string, unknown>)
          : [],
      );
      const relaxedFields = reg.role.form_fields.map((f) => ({
        ...f,
        required:
          f.required &&
          (touched.has(f.key) ||
            !this.isEmpty((reg.form_data ?? {})[f.key])),
      }));
      this.validateFormData(relaxedFields, effectiveFormData);
      this.validateBankFields(
        reg.role.form_fields,
        effectiveFormData,
        effectiveFullName,
      );
    }
    this.validatePhotoUrls(effectiveFormData);

    const now = new Date();

    if (reg.status === 'pending_approval') {
      // Apply directly — admin review hasn't happened yet.
      if (patch.full_name != null) reg.full_name = patch.full_name as string;
      if (patch.phone != null) reg.phone = patch.phone as string;
      if (patch.form_data != null) {
        reg.form_data = patch.form_data as Record<string, unknown>;
        reg.shirt_size = this.extractShirtSize(reg.form_data) ?? reg.shirt_size;
        reg.avatar_photo_url =
          this.extractString(reg.form_data, 'avatar_photo') ??
          reg.avatar_photo_url;
        reg.cccd_photo_url =
          this.extractString(reg.form_data, 'cccd_photo') ?? reg.cccd_photo_url;
        // v037: sync cccd_back to entity column too — required for contract render.
        reg.cccd_back_photo_url =
          this.extractString(reg.form_data, 'cccd_back_photo') ??
          reg.cccd_back_photo_url;
        // Sync birth_date / cccd_issue_* if TNV provided in form_data.
        const birthDate =
          this.extractString(reg.form_data, 'birth_date') ||
          this.extractString(reg.form_data, 'dob');
        if (birthDate && /^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
          reg.birth_date = birthDate as never;
        }
        const cccdIssueDate = this.extractString(reg.form_data, 'cccd_issue_date');
        if (cccdIssueDate && /^\d{4}-\d{2}-\d{2}$/.test(cccdIssueDate)) {
          reg.cccd_issue_date = cccdIssueDate as never;
        }
        const cccdIssuePlace = this.extractString(reg.form_data, 'cccd_issue_place');
        if (cccdIssuePlace) reg.cccd_issue_place = cccdIssuePlace;
      }
      reg.has_pending_changes = false;
      reg.pending_changes = null;
      reg.pending_changes_submitted_at = null;
      const stamp = this.timestamp();
      reg.notes = [reg.notes, `[${stamp}] TNV sửa thông tin (pending_approval, áp dụng ngay)`]
        .filter((x): x is string => !!x)
        .join('\n');
      await this.regRepo.save(reg);
      await this.cache.invalidateEvent(reg.event_id, [reg.role_id]);
      this.logger.log(
        `PROFILE_EDIT_APPLY reg=${reg.id} status=pending_approval`,
      );
      return {
        outcome: 'applied',
        message: 'Đã cập nhật thông tin.',
        pending_changes_submitted_at: null,
      };
    }

    // v037+: When TNV BỔ SUNG (fill missing fields, không phải sửa giá trị
    // đã có) — apply ngay, không cần admin duyệt. Common case: admin import
    // staff từ Excel để skeleton, TNV vào portal điền lần đầu identity +
    // photos. Chỉ khi TNV sửa value đã có (A → B) mới route qua admin queue.
    const isFillOnly = this.isProfileEditFillOnly(reg, patch);
    if (isFillOnly) {
      // Apply directly — same shape as pending_approval branch.
      if (patch.full_name != null && !reg.full_name) reg.full_name = patch.full_name as string;
      if (patch.phone != null && !reg.phone) reg.phone = patch.phone as string;
      if (patch.form_data != null) {
        const merged = patch.form_data as Record<string, unknown>;
        reg.form_data = merged;
        reg.shirt_size = this.extractShirtSize(merged) ?? reg.shirt_size;
        reg.avatar_photo_url =
          this.extractString(merged, 'avatar_photo') ?? reg.avatar_photo_url;
        reg.cccd_photo_url =
          this.extractString(merged, 'cccd_photo') ?? reg.cccd_photo_url;
        reg.cccd_back_photo_url =
          this.extractString(merged, 'cccd_back_photo') ?? reg.cccd_back_photo_url;
        const bd =
          this.extractString(merged, 'birth_date') ||
          this.extractString(merged, 'dob');
        if (bd && /^\d{4}-\d{2}-\d{2}$/.test(bd) && !reg.birth_date) {
          reg.birth_date = bd as never;
        }
        const id = this.extractString(merged, 'cccd_issue_date');
        if (id && /^\d{4}-\d{2}-\d{2}$/.test(id) && !reg.cccd_issue_date) {
          reg.cccd_issue_date = id as never;
        }
        const ip = this.extractString(merged, 'cccd_issue_place');
        if (ip && !reg.cccd_issue_place) reg.cccd_issue_place = ip;
      }
      reg.has_pending_changes = false;
      reg.pending_changes = null;
      reg.pending_changes_submitted_at = null;
      const stamp = this.timestamp();
      reg.notes = [reg.notes, `[${stamp}] TNV bổ sung thông tin (fill-only, áp dụng ngay)`]
        .filter((x): x is string => !!x)
        .join('\n');
      await this.regRepo.save(reg);
      await this.cache.invalidateEvent(reg.event_id, [reg.role_id]);
      this.logger.log(
        `PROFILE_EDIT_FILL reg=${reg.id} status=${reg.status} keys=${Object.keys(patch).join(',')}`,
      );
      return {
        outcome: 'applied',
        message: 'Đã bổ sung thông tin.',
        pending_changes_submitted_at: null,
      };
    }

    // Status ∈ {approved, contract_sent, contract_signed, qr_sent, checked_in,
    // completed, waitlisted} AND patch sửa field đã có giá trị — queue for
    // admin review.
    reg.pending_changes = patch;
    reg.has_pending_changes = true;
    reg.pending_changes_submitted_at = now;
    await this.regRepo.save(reg);
    await this.cache.invalidateEvent(reg.event_id, [reg.role_id]);
    this.logger.log(
      `PROFILE_EDIT_QUEUED reg=${reg.id} status=${reg.status} keys=${Object.keys(patch).join(',')}`,
    );

    // Fire-and-forget admin notification.
    void this.sendProfileEditAdminNotification(reg, patch).catch((err) =>
      this.logger.warn(
        `profile-edit admin email failed reg=${reg.id}: ${(err as Error).message}`,
      ),
    );

    return {
      outcome: 'pending_admin_approval',
      message: 'Đã gửi yêu cầu — admin sẽ duyệt trong thời gian sớm nhất.',
      pending_changes_submitted_at: now.toISOString(),
    };
  }

  /**
   * Admin approves the queued profile edit: copy pending_changes → main
   * columns, clear the flag, invalidate cache.
   */
  async approveProfileChanges(
    id: number,
    adminIdentity: string,
  ): Promise<VolRegistration> {
    const updated = await this.dataSource.transaction(async (m) => {
      const reg = await m
        .getRepository(VolRegistration)
        .createQueryBuilder('r')
        .setLock('pessimistic_write')
        .where('r.id = :id', { id })
        .getOne();
      if (!reg) throw new NotFoundException('Registration not found');
      if (!reg.has_pending_changes || !reg.pending_changes) {
        throw new BadRequestException(
          'Không có thay đổi nào đang chờ duyệt',
        );
      }
      const patch = reg.pending_changes;
      if (typeof patch.full_name === 'string') {
        reg.full_name = patch.full_name;
      }
      if (typeof patch.phone === 'string') {
        reg.phone = patch.phone;
      }
      if (patch.form_data && typeof patch.form_data === 'object') {
        reg.form_data = patch.form_data as Record<string, unknown>;
        reg.shirt_size =
          this.extractShirtSize(reg.form_data) ?? reg.shirt_size;
        reg.avatar_photo_url =
          this.extractString(reg.form_data, 'avatar_photo') ??
          reg.avatar_photo_url;
        reg.cccd_photo_url =
          this.extractString(reg.form_data, 'cccd_photo') ?? reg.cccd_photo_url;
        // v037: sync cccd_back + identity fields after admin approval.
        reg.cccd_back_photo_url =
          this.extractString(reg.form_data, 'cccd_back_photo') ??
          reg.cccd_back_photo_url;
        const birthDate =
          this.extractString(reg.form_data, 'birth_date') ||
          this.extractString(reg.form_data, 'dob');
        if (birthDate && /^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
          reg.birth_date = birthDate as never;
        }
        const cccdIssueDate = this.extractString(reg.form_data, 'cccd_issue_date');
        if (cccdIssueDate && /^\d{4}-\d{2}-\d{2}$/.test(cccdIssueDate)) {
          reg.cccd_issue_date = cccdIssueDate as never;
        }
        const cccdIssuePlace = this.extractString(reg.form_data, 'cccd_issue_place');
        if (cccdIssuePlace) reg.cccd_issue_place = cccdIssuePlace;
      }
      reg.has_pending_changes = false;
      reg.pending_changes = null;
      reg.pending_changes_submitted_at = null;
      const stamp = this.timestamp();
      reg.notes = [
        reg.notes,
        `[${stamp}] [AUDIT] Admin ${adminIdentity} duyệt thay đổi`,
      ]
        .filter((x): x is string => !!x)
        .join('\n');
      return m.getRepository(VolRegistration).save(reg);
    });
    await this.cache.invalidateEvent(updated.event_id, [updated.role_id]);
    this.logger.log(
      `PROFILE_EDIT_APPROVE admin=${adminIdentity} reg=${id}`,
    );
    return updated;
  }

  /**
   * Admin rejects the profile edit. Reason required → appended to notes
   * audit trail, and TNV is emailed.
   */
  async rejectProfileChanges(
    id: number,
    reason: string,
    adminIdentity: string,
  ): Promise<VolRegistration> {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('reason is required');
    }
    const trimmed = reason.trim();
    const updated = await this.dataSource.transaction(async (m) => {
      const reg = await m
        .getRepository(VolRegistration)
        .createQueryBuilder('r')
        .setLock('pessimistic_write')
        .where('r.id = :id', { id })
        .getOne();
      if (!reg) throw new NotFoundException('Registration not found');
      if (!reg.has_pending_changes) {
        throw new BadRequestException(
          'Không có thay đổi nào đang chờ duyệt',
        );
      }
      reg.has_pending_changes = false;
      reg.pending_changes = null;
      reg.pending_changes_submitted_at = null;
      const stamp = this.timestamp();
      reg.notes = [
        reg.notes,
        `[${stamp}] [AUDIT] Admin ${adminIdentity} từ chối thay đổi: ${trimmed}`,
      ]
        .filter((x): x is string => !!x)
        .join('\n');
      return m.getRepository(VolRegistration).save(reg);
    });
    await this.cache.invalidateEvent(updated.event_id, [updated.role_id]);
    this.logger.log(
      `PROFILE_EDIT_REJECT admin=${adminIdentity} reg=${id} reason="${trimmed}"`,
    );
    void this.sendProfileEditRejectedEmail(updated, trimmed).catch((err) =>
      this.logger.warn(
        `profile-edit reject email failed reg=${id}: ${(err as Error).message}`,
      ),
    );
    return updated;
  }

  /**
   * Strip HTML tags from textual field values (defense against XSS when
   * names/phones get rendered in admin list without careful escaping).
   * Non-string values pass through unchanged (objects, numbers, booleans).
   */
  private sanitizeProfileValue(key: string, value: unknown): unknown {
    if (key === 'form_data' && value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = typeof v === 'string' ? this.stripHtml(v) : v;
      }
      return out;
    }
    if (typeof value === 'string') return this.stripHtml(value);
    return value;
  }

  private stripHtml(s: string): string {
    return s.replace(/<[^>]*>/g, '').trim();
  }

  private isEmpty(v: unknown): boolean {
    return v == null || v === '' || (Array.isArray(v) && v.length === 0);
  }

  private async sendProfileEditAdminNotification(
    reg: VolRegistration,
    patch: Record<string, unknown>,
  ): Promise<void> {
    const fullReg = await this.regRepo.findOne({
      where: { id: reg.id },
      relations: { event: true, role: true },
    });
    if (!fullReg) return;
    const eventName = fullReg.event?.event_name ?? '';
    const roleName = fullReg.role?.role_name ?? '';
    const subject = `[5BIB Crew] - TNV yêu cầu sửa thông tin - ${eventName} (${fullReg.full_name})`;
    const adminLink = `${env.teamManagement.crewBaseUrl.replace(/\/?$/, '')
      .replace('crew.', 'admin.')}/team-management/${fullReg.event_id}/registrations?highlight=${fullReg.id}`;

    const diffHtml = this.formatPatchAsHtml(patch, fullReg);
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color:#1c1917;">
        <h2 style="color:#ea580c;">Yêu cầu sửa thông tin TNV</h2>
        <p><strong>${escapeHtml(fullReg.full_name)}</strong> (${escapeHtml(fullReg.email)}) — vai trò <strong>${escapeHtml(roleName)}</strong> — sự kiện <strong>${escapeHtml(eventName)}</strong> — trạng thái <code>${fullReg.status}</code>.</p>
        <h3>Đề xuất thay đổi:</h3>
        ${diffHtml}
        <p><a href="${adminLink}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 16px;text-decoration:none;border-radius:6px;">Mở trong admin</a></p>
        <p style="color:#78716c;font-size:12px;">Thay đổi sẽ KHÔNG được áp dụng cho đến khi bạn bấm "Duyệt thay đổi" trong admin.</p>
      </div>
    `;
    // Fallback address: use TEAM_EMAIL_FROM (same mailbox that sent the
    // registration-received emails) so there's a human inbox to see these.
    const adminEmail = env.teamManagement.emailFrom;
    await this.mail.sendCustomHtml(adminEmail, subject, html);
  }

  private async sendProfileEditRejectedEmail(
    reg: VolRegistration,
    reason: string,
  ): Promise<void> {
    const fullReg = await this.regRepo.findOne({
      where: { id: reg.id },
      relations: { event: true, role: true },
    });
    if (!fullReg) return;
    const subject = `[5BIB Crew] - Yêu cầu sửa thông tin bị từ chối - ${fullReg.event?.event_name ?? ''}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width:560px; margin:0 auto; color:#1c1917;">
        <h2>Chào ${escapeHtml(fullReg.full_name)},</h2>
        <p>Yêu cầu sửa thông tin của bạn cho sự kiện <strong>${escapeHtml(fullReg.event?.event_name ?? '')}</strong> đã bị từ chối.</p>
        <p><strong>Lý do:</strong> ${escapeHtml(reason)}</p>
        <p>Nếu cần hỗ trợ, vui lòng liên hệ ban tổ chức.</p>
        <p>Trang cá nhân: <a href="${env.teamManagement.crewBaseUrl}/status/${fullReg.magic_token}">${env.teamManagement.crewBaseUrl}/status/${fullReg.magic_token}</a></p>
      </div>
    `;
    await this.mail.sendCustomHtml(fullReg.email, subject, html);
  }

  private formatPatchAsHtml(
    patch: Record<string, unknown>,
    reg: VolRegistration,
  ): string {
    const rows: string[] = [];
    const label = (k: string): string => {
      if (k === 'full_name') return 'Họ tên';
      if (k === 'phone') return 'Số điện thoại';
      return k;
    };
    if (typeof patch.full_name === 'string') {
      rows.push(rowHtml(label('full_name'), reg.full_name, patch.full_name));
    }
    if (typeof patch.phone === 'string') {
      rows.push(rowHtml(label('phone'), reg.phone, patch.phone));
    }
    if (patch.form_data && typeof patch.form_data === 'object') {
      const nextForm = patch.form_data as Record<string, unknown>;
      const currentForm = reg.form_data ?? {};
      for (const [k, v] of Object.entries(nextForm)) {
        const cur = currentForm[k];
        if (JSON.stringify(cur) === JSON.stringify(v)) continue;
        rows.push(rowHtml(k, formatValue(cur), formatValue(v)));
      }
    }
    if (rows.length === 0) return '<p><em>(không có thay đổi)</em></p>';
    return `
      <table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse;border-color:#e7e5e4;">
        <thead><tr style="background:#fafaf9;"><th align="left">Trường</th><th align="left">Hiện tại</th><th align="left">Đề xuất</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    `;

    function rowHtml(k: string, cur: unknown, next: unknown): string {
      return `<tr><td>${escapeHtml(String(k))}</td><td style="color:#78716c;">${escapeHtml(String(cur ?? '—'))}</td><td><strong>${escapeHtml(String(next ?? '—'))}</strong></td></tr>`;
    }
    function formatValue(v: unknown): string {
      if (v == null || v === '') return '—';
      if (typeof v === 'object') return JSON.stringify(v);
      return String(v);
    }
  }

  /**
   * When a slot frees (reject/cancel of an approved+ person), promote the
   * head of the waitlist. Per Danny OQ-3: promote to `pending_approval`,
   * NOT `approved` — admin still has to review.
   */
  async promoteNextWaitlisted(
    eventId: number,
    roleId: number,
  ): Promise<VolRegistration | null> {
    const promoted = await this.dataSource.transaction(async (m) => {
      const role = await m
        .getRepository(VolRole)
        .createQueryBuilder('r')
        .setLock('pessimistic_write')
        .where('r.id = :id', { id: roleId })
        .getOne();
      if (!role) return null;
      if (!role.waitlist_enabled) return null;
      if (role.filled_slots >= role.max_slots) return null;

      const next = await m
        .getRepository(VolRegistration)
        .createQueryBuilder('r')
        .setLock('pessimistic_write')
        .where('r.role_id = :rid', { rid: roleId })
        .andWhere('r.status = :s', { s: 'waitlisted' })
        .orderBy('r.waitlist_position', 'ASC')
        .getOne();
      if (!next) return null;

      this.assertTransition(next.status, 'pending_approval');

      const oldPos = next.waitlist_position ?? 0;
      next.status = 'pending_approval';
      next.waitlist_position = null;
      const saved = await m.getRepository(VolRegistration).save(next);

      if (oldPos > 0) {
        await m
          .getRepository(VolRegistration)
          .createQueryBuilder()
          .update()
          .set({ waitlist_position: () => 'waitlist_position - 1' })
          .where('role_id = :rid', { rid: roleId })
          .andWhere('status = :s', { s: 'waitlisted' })
          .andWhere('waitlist_position > :p', { p: oldPos })
          .execute();
      }

      return saved;
    });

    if (promoted) {
      await this.cache.invalidateEvent(eventId, [roleId]);
      void this.sendWaitlistPromotedEmail(promoted).catch((err) =>
        this.logger.warn(`waitlist promote email failed: ${err.message}`),
      );
      this.logger.log(`WAITLIST_PROMOTE reg=${promoted.id} → pending_approval`);
    }
    return promoted;
  }

  // ──────────────────────────────────────────────────────────────────────
  // Transition helpers called from other services
  // ──────────────────────────────────────────────────────────────────────

  /**
   * Atomic helper for other services (checkin, contract) — transition a
   * registration with the state-machine guard. Uses conditional UPDATE
   * (WHERE status = fromStatus) so two concurrent callers can't both win.
   */
  async transitionStatus(
    id: number,
    from: RegistrationStatus,
    to: RegistrationStatus,
    manager?: EntityManager,
  ): Promise<VolRegistration> {
    this.assertTransition(from, to);
    const runner = manager ?? this.dataSource.manager;
    const result = await runner
      .createQueryBuilder()
      .update(VolRegistration)
      .set({ status: to })
      .where('id = :id', { id })
      .andWhere('status = :from', { from })
      .execute();
    if (!result.affected) {
      throw new ConflictException(
        `Could not transition reg=${id} from ${from} — current status has changed.`,
      );
    }
    const reg = await runner.getRepository(VolRegistration).findOne({ where: { id } });
    if (!reg) throw new NotFoundException('Registration not found');
    return reg;
  }

  // ──────────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────────

  private expiry(): Date {
    const d = new Date();
    d.setDate(d.getDate() + env.teamManagement.magicTokenDays);
    return d;
  }

  private timestamp(): string {
    return new Date().toISOString();
  }

  private buildMagicLink(token: string): string {
    return `${env.teamManagement.crewBaseUrl}/status/${token}`;
  }

  private toListRow(r: VolRegistration): RegistrationListRowDto {
    return {
      id: r.id,
      role_id: r.role_id,
      role_name: r.role?.role_name ?? null,
      event_id: r.event_id,
      full_name: r.full_name,
      email: r.email,
      phone: r.phone,
      shirt_size: r.shirt_size,
      avatar_photo_url: r.avatar_photo_url,
      // v037+ — for "Hồ sơ" pill in admin table. KEYs (not presigned URLs)
      // — admin client only checks truthy; for display, use the existing
      // detail-view path which presigns.
      cccd_photo_url: r.cccd_photo_url,
      cccd_back_photo_url: r.cccd_back_photo_url,
      status: r.status,
      waitlist_position: r.waitlist_position,
      contract_status: r.contract_status,
      checked_in_at: r.checked_in_at ? r.checked_in_at.toISOString() : null,
      payment_status: r.payment_status,
      actual_working_days: r.actual_working_days,
      actual_compensation: r.actual_compensation,
      form_data: this.sanitizeFormData(r.form_data),
      notes: r.notes,
      created_at: r.created_at.toISOString(),
      has_pending_changes: r.has_pending_changes,
      // v2.0 — acceptance gate so the admin list can filter/sort
      // by "sẵn sàng gửi nghiệm thu" / "đã ký" / "tranh chấp".
      acceptance_status: r.acceptance_status,
      acceptance_sent_at: r.acceptance_sent_at
        ? r.acceptance_sent_at.toISOString()
        : null,
      acceptance_signed_at: r.acceptance_signed_at
        ? r.acceptance_signed_at.toISOString()
        : null,
      acceptance_value: r.acceptance_value,
      contract_number: r.contract_number,
    };
  }

  private sanitizeFormData(input: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = { ...input };
    if (typeof out.cccd === 'string' && out.cccd.length >= 4) {
      out.cccd = `***${out.cccd.slice(-4)}`;
    }
    delete out.cccd_photo;
    return out;
  }

  /**
   * Like sanitizeFormData but for the owner (TNV viewing their own status).
   * Keeps the raw CCCD since they need it to edit, but still drops the
   * cccd_photo URL — re-upload goes through the photo endpoint.
   */
  private ownerFormData(input: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = { ...input };
    delete out.cccd_photo;
    return out;
  }

  /**
   * v037+ — Returns true if every field in `patch` is filling a currently
   * empty/null value on the registration. If ANY field is overwriting an
   * existing value (modify, not fill), returns false → route to admin queue.
   *
   * Used for the "imported staff first-time fill" case: admin imports a
   * skeleton row, TNV gets welcome email, fills CCCD/photo/etc. for the
   * first time → apply immediately. Subsequent edits that change already-
   * filled values still need admin approval.
   */
  private isProfileEditFillOnly(
    reg: VolRegistration,
    patch: Record<string, unknown>,
  ): boolean {
    const isEmpty = (v: unknown) =>
      v == null || v === '' || (Array.isArray(v) && v.length === 0);
    // Compare top-level entity fields.
    if (patch.full_name !== undefined) {
      if (!isEmpty(reg.full_name) && reg.full_name !== patch.full_name) return false;
    }
    if (patch.phone !== undefined) {
      if (!isEmpty(reg.phone) && reg.phone !== patch.phone) return false;
    }
    // Compare form_data entries (and entity columns synced from form_data).
    if (patch.form_data) {
      const newFd = patch.form_data as Record<string, unknown>;
      const oldFd = (reg.form_data ?? {}) as Record<string, unknown>;
      for (const [k, newVal] of Object.entries(newFd)) {
        const oldVal = oldFd[k];
        // If user sent same value as before → not a change (skip).
        if (oldVal === newVal) continue;
        // Special cases: keys synced to entity columns. The entity column
        // is the source of truth; form_data may lag behind for legacy data.
        if (k === 'cccd_photo' && !isEmpty(reg.cccd_photo_url)) return false;
        if (k === 'cccd_back_photo' && !isEmpty(reg.cccd_back_photo_url)) return false;
        if (k === 'avatar_photo' && !isEmpty(reg.avatar_photo_url)) return false;
        if ((k === 'birth_date' || k === 'dob') && !isEmpty(reg.birth_date)) return false;
        if (k === 'cccd_issue_date' && !isEmpty(reg.cccd_issue_date)) return false;
        if (k === 'cccd_issue_place' && !isEmpty(reg.cccd_issue_place)) return false;
        // For form_data-only keys (cccd, address, bank_*, shirt_size, etc.):
        // if old value is non-empty and differs → modify.
        if (!isEmpty(oldVal)) return false;
      }
    }
    return true;
  }

  private validateFormData(
    fields: FormFieldConfig[],
    data: Record<string, unknown>,
    opts: { skipRequiredPhotos?: boolean; skipAllRequired?: boolean } = {},
  ): void {
    for (const f of fields) {
      const v = data[f.key];
      const isEmpty =
        v == null || v === '' || (Array.isArray(v) && v.length === 0);
      // Bulk-import flow lets the admin skip ALL required fields — TNV
      // fills them later via the welcome-email magic link (computeMissingSections
      // surfaces what's missing). `skipRequiredPhotos` is the legacy narrower
      // flag preserved for callers that only want to skip photo requireds.
      const skipThisRequired =
        opts.skipAllRequired === true ||
        (opts.skipRequiredPhotos === true && f.type === 'photo');
      if (f.required && isEmpty && !skipThisRequired) {
        throw new BadRequestException(`Missing required field: ${f.key}`);
      }
      if (isEmpty) continue;
      if (f.type === 'shirt_size' || f.type === 'select') {
        const opts = f.options ?? [];
        if (opts.length > 0 && typeof v === 'string' && !opts.includes(v)) {
          throw new BadRequestException(
            `Field "${f.key}" value "${v}" is not in allowed options`,
          );
        }
      }
    }
  }

  private validateBankFields(
    fields: FormFieldConfig[],
    data: Record<string, unknown>,
    fullName: string,
  ): void {
    const hasField = (key: string) => fields.some((f) => f.key === key);

    if (hasField('bank_account_number')) {
      const v = data['bank_account_number'];
      if (typeof v === 'string' && v.length > 0) {
        if (!/^\d{6,20}$/.test(v)) {
          throw new BadRequestException(
            'Số tài khoản ngân hàng phải có 6–20 chữ số.',
          );
        }
      }
    }

    if (hasField('bank_name')) {
      const v = data['bank_name'];
      if (typeof v === 'string' && v.length > 0) {
        if (!VN_BANKS.includes(v)) {
          throw new BadRequestException(
            'Ngân hàng không có trong danh sách hỗ trợ.',
          );
        }
      }
    }

    if (hasField('bank_holder_name')) {
      const v = data['bank_holder_name'];
      if (typeof v === 'string' && v.length > 0) {
        if (normalizeHolderName(v) !== normalizeHolderName(fullName)) {
          throw new BadRequestException(
            'Tên chủ tài khoản phải khớp với họ tên đăng ký',
          );
        }
      }
    }
  }

  private validatePhotoUrls(data: Record<string, unknown>): void {
    // v037: include cccd_back_photo so TNV self-edit can update the back face.
    // Without this key here, submitProfileEdit silently drops the value.
    for (const key of ['avatar_photo', 'cccd_photo', 'cccd_back_photo']) {
      const v = data[key];
      if (v == null || v === '') continue;
      if (typeof v !== 'string') {
        throw new BadRequestException(`Field "${key}" must be a string URL`);
      }
      if (v.startsWith('team-photos/')) continue;
      const ok = OUR_S3_PREFIXES.some((prefix) => v.startsWith(prefix));
      if (!ok) {
        throw new BadRequestException(
          `Field "${key}" URL is not from our S3 bucket. Upload via /api/public/team-upload-photo first.`,
        );
      }
    }
  }

  private extractShirtSize(form: Record<string, unknown>): ShirtSize | null {
    const raw = form['shirt_size'];
    if (typeof raw !== 'string') return null;
    const upper = raw.toUpperCase();
    return (VALID_SHIRT_SIZES as string[]).includes(upper) ? (upper as ShirtSize) : null;
  }

  private extractString(form: Record<string, unknown>, key: string): string | null {
    const v = form[key];
    return typeof v === 'string' && v.length > 0 ? v : null;
  }

  private isDupEntry(err: unknown): boolean {
    if (!(err instanceof QueryFailedError)) return false;
    const driverError = (err as QueryFailedError & { driverError?: { code?: string } }).driverError;
    return driverError?.code === 'ER_DUP_ENTRY';
  }

  // ──────────────────────────────────────────────────────────────────────
  // Email helpers
  // ──────────────────────────────────────────────────────────────────────

  private async sendWaitlistedEmail(
    regId: number,
    outcome: {
      waitlist_position: number | null;
      magic_token: string;
      event_name: string;
      role_name: string;
    },
  ): Promise<void> {
    const reg = await this.regRepo.findOne({
      where: { id: regId },
      relations: { role: true, event: true },
    });
    if (!reg) return;
    await this.mail.sendTeamWaitlisted({
      toEmail: reg.email,
      fullName: reg.full_name,
      eventName: outcome.event_name || reg.event?.event_name || '',
      roleName: outcome.role_name || reg.role?.role_name || '',
      waitlistPosition: outcome.waitlist_position ?? 0,
      magicLink: this.buildMagicLink(outcome.magic_token),
    });
  }

  /**
   * Promoted waitlist → pending_approval. Different wording from the
   * initial waitlisted email: "a slot opened up, we're reviewing".
   */
  private async sendWaitlistPromotedEmail(reg: VolRegistration): Promise<void> {
    const full = await this.regRepo.findOne({
      where: { id: reg.id },
      relations: { role: true, event: true },
    });
    if (!full) return;
    // Re-use the waitlisted template with position=0 + different reason text
    // in the subject line; richer template can be added later if product asks.
    await this.mail.sendTeamWaitlisted({
      toEmail: full.email,
      fullName: full.full_name,
      eventName: full.event?.event_name ?? '',
      roleName: full.role?.role_name ?? '',
      waitlistPosition: 0,
      magicLink: this.buildMagicLink(full.magic_token),
    });
  }

  /**
   * Rejection email. No dedicated MailService method exists yet — fall back
   * to the cancelled template which already takes a reason. Wording is
   * acceptable ("we are unable to confirm your registration"); a dedicated
   * template can be added to MailService later.
   */
  private async sendRejectionEmail(
    reg: VolRegistration,
    reason: string,
  ): Promise<void> {
    const full = await this.regRepo.findOne({
      where: { id: reg.id },
      relations: { role: true, event: true },
    });
    if (!full) return;
    await this.mail.sendTeamCancelled({
      toEmail: full.email,
      fullName: full.full_name,
      eventName: full.event?.event_name ?? '',
      roleName: full.role?.role_name ?? '',
      reason,
    });
  }

  // ──────────────────────────────────────────────────────────────────────
  // v1.9 — Feature mode config
  // ──────────────────────────────────────────────────────────────────────

  async getEventFeaturesConfig(eventId: number): Promise<EventFeaturesConfigDto> {
    const cached = await this.cache.getEventConfig(eventId);
    if (cached) {
      return {
        event_id: eventId,
        feature_mode: cached.feature_mode as 'full' | 'lite',
        feature_nghiem_thu: cached.feature_nghiem_thu,
      };
    }
    const event = await this.eventRepo.findOne({
      where: { id: eventId },
      select: ['id', 'feature_mode', 'feature_nghiem_thu'],
    });
    if (!event) throw new NotFoundException(`Event ${eventId} not found`);
    const config = { feature_mode: event.feature_mode, feature_nghiem_thu: event.feature_nghiem_thu };
    await this.cache.cacheEventConfig(eventId, config);
    return { event_id: eventId, ...config };
  }

  async getEventFeaturesConfigByToken(token: string): Promise<EventFeaturesConfigDto> {
    const reg = await this.regRepo.findOne({
      where: { magic_token: token },
      select: ['event_id'],
    });
    if (!reg) throw new NotFoundException('Token not found');
    return this.getEventFeaturesConfig(reg.event_id);
  }

  async updateEventFeatures(
    eventId: number,
    dto: UpdateEventFeaturesDto,
  ): Promise<EventFeaturesConfigDto> {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException(`Event ${eventId} not found`);

    // BR-FT-03: Full → Lite only if no qr_sent or checked_in records exist.
    if (dto.feature_mode === 'lite' && event.feature_mode === 'full') {
      const [qrSentCount, checkedInCount] = await Promise.all([
        this.regRepo.count({ where: { event_id: eventId, status: 'qr_sent' } }),
        this.regRepo.count({ where: { event_id: eventId, status: 'checked_in' } }),
      ]);
      if (qrSentCount > 0 || checkedInCount > 0) {
        throw new ConflictException({
          message: 'Có nhân sự đang ở trạng thái không tương thích với Lite mode',
          details: { qr_sent_count: qrSentCount, checked_in_count: checkedInCount },
        });
      }
    }

    await this.eventRepo.update(eventId, {
      feature_mode: dto.feature_mode,
      feature_nghiem_thu: dto.feature_nghiem_thu,
    });
    await this.cache.invalidateEventConfig(eventId);

    this.logger.log(
      `EVENT_FEATURES_UPDATED eventId=${eventId} mode=${dto.feature_mode} nghiem_thu=${dto.feature_nghiem_thu}`,
    );
    return {
      event_id: eventId,
      feature_mode: dto.feature_mode,
      feature_nghiem_thu: dto.feature_nghiem_thu,
    };
  }

  async confirmNghiemThu(
    regId: number,
    adminEmail: string,
    note?: string,
  ): Promise<NghiemThuResponseDto> {
    const reg = await this.regRepo.findOne({
      where: { id: regId },
      relations: { event: true },
    });
    if (!reg) throw new NotFoundException(`Registration ${regId} not found`);
    if (reg.status === 'completed') {
      throw new ConflictException('Registration đã ở trạng thái completed');
    }

    const event = reg.event!;
    // Endpoint name "nghiem-thu" is historical — semantically this is the
    // manual completion-confirm path. Lite mode uses it to skip QR/check-in;
    // Full mode uses it after check-in. The `feature_nghiem_thu` toggle
    // controls payment gate (markPaid vs forcePaid), NOT this transition.
    const requiredStatus = event.feature_mode === 'full' ? 'checked_in' : 'contract_signed';
    if (reg.status !== requiredStatus) {
      throw new BadRequestException(
        `Mode ${event.feature_mode === 'full' ? 'Full' : 'Lite'} yêu cầu status "${requiredStatus}", hiện tại: "${reg.status}"`,
      );
    }

    const now = new Date();
    const stamp = this.timestamp();
    const newNotes = note
      ? [reg.notes, `[${stamp}] [Hoàn thành] ${note.trim()}`]
          .filter((x): x is string => !!x)
          .join('\n')
      : reg.notes;

    await this.regRepo.update(regId, {
      status: 'completed',
      completion_confirmed_at: now,
      completion_confirmed_by: 'admin',
      notes: newNotes,
    });

    await this.cache.invalidateEvent(reg.event_id, [reg.role_id]);
    this.logger.log(
      `NGHIEM_THU_CONFIRMED regId=${regId} by=${adminEmail} mode=${event.feature_mode}`,
    );
    return { id: regId, status: 'completed', completed_at: now.toISOString() };
  }

  /**
   * v037+ — Admin uploads photo on behalf of TNV (when TNV was imported
   * from Excel and skipped the public register form). Uses TeamPhotoService
   * to put the file on S3, then writes the resulting key/URL to the
   * registration's photo column. Audit log includes admin identity.
   */
  async adminUploadPhoto(
    regId: number,
    file: Express.Multer.File,
    photoType: 'avatar' | 'cccd' | 'cccd_back',
    adminIdentity: string,
  ): Promise<{ url: string; column: string }> {
    const reg = await this.regRepo.findOne({ where: { id: regId } });
    if (!reg) throw new NotFoundException('Registration not found');
    const result = await this.photos.upload(file, photoType);
    let column: string;
    if (photoType === 'avatar') {
      reg.avatar_photo_url = result.url;
      column = 'avatar_photo_url';
    } else if (photoType === 'cccd') {
      reg.cccd_photo_url = result.url;
      column = 'cccd_photo_url';
    } else {
      reg.cccd_back_photo_url = result.url;
      column = 'cccd_back_photo_url';
    }
    // Mirror into form_data so the "Ảnh & file đính kèm" section + crew
    // self-edit reads the same value the admin just uploaded.
    const fd: Record<string, unknown> = { ...(reg.form_data ?? {}) };
    if (photoType === 'avatar') fd.avatar_photo = result.url;
    else if (photoType === 'cccd') fd.cccd_photo = result.url;
    else fd.cccd_back_photo = result.url;
    reg.form_data = fd;
    await this.regRepo.save(reg);
    await this.cache.invalidateEvent(reg.event_id, [reg.role_id]);
    this.logger.log(
      `PHOTO_UPLOAD actor=admin:${adminIdentity} reg=${regId} type=${photoType} bytes=${file.size} key=${result.url}`,
    );
    return { url: result.url, column };
  }

  /**
   * Batch confirm-completion. Best-effort — reports per-id success/fail in
   * response. Used by admin "Xác nhận hoàn thành N người" bulk button.
   */
  async confirmNghiemThuBatch(
    registrationIds: number[],
    adminEmail: string,
    note?: string,
  ): Promise<{ succeeded: number[]; failed: Record<number, string> }> {
    const succeeded: number[] = [];
    const failed: Record<number, string> = {};
    for (const id of registrationIds) {
      try {
        await this.confirmNghiemThu(id, adminEmail, note);
        succeeded.push(id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failed[id] = msg;
      }
    }
    this.logger.log(
      `NGHIEM_THU_BATCH by=${adminEmail} succeeded=${succeeded.length} failed=${Object.keys(failed).length}`,
    );
    return { succeeded, failed };
  }

  /**
   * Confirm ALL registrations in an event matching a status filter.
   * Lite-mode shortcut: select all "contract_signed" → "completed" in 1
   * click. Internally loads ids by event+status (no pagination needed —
   * idx_event_status covers it) then delegates to confirmNghiemThuBatch.
   */
  async confirmAllInEvent(
    eventId: number,
    status: 'contract_signed' | 'checked_in',
    adminEmail: string,
    note?: string,
  ): Promise<{ succeeded: number[]; failed: Record<number, string>; total: number }> {
    const rows = await this.regRepo.find({
      where: { event_id: eventId, status },
      select: ['id'],
    });
    const ids = rows.map((r) => r.id);
    if (ids.length === 0) {
      return { succeeded: [], failed: {}, total: 0 };
    }
    this.logger.log(
      `CONFIRM_ALL_IN_EVENT eventId=${eventId} status=${status} count=${ids.length} by=${adminEmail}`,
    );
    const result = await this.confirmNghiemThuBatch(ids, adminEmail, note);
    return { ...result, total: ids.length };
  }
}
