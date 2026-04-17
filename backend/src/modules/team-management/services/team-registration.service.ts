import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, QueryFailedError } from 'typeorm';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';
import { env } from 'src/config';
import { MailService } from 'src/modules/notification/mail.service';
import { VolEvent } from '../entities/vol-event.entity';
import { VolRole, FormFieldConfig } from '../entities/vol-role.entity';

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
import {
  BulkUpdateRegistrationsDto,
  BulkUpdateResponseDto,
} from '../dto/bulk-update.dto';
import { RegistrationDetailDto } from '../dto/registration-detail.dto';
import { TeamCacheService } from './team-cache.service';
import { TeamPhotoService } from './team-photo.service';

const VALID_SHIRT_SIZES: ShirtSize[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

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
   * Public registration — atomic transaction with pessimistic write lock on
   * the role row to prevent two users grabbing the same last slot.
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

      // Lock the event row too — otherwise an admin closing the event
      // concurrently is invisible under REPEATABLE READ snapshot.
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
      this.validatePhotoUrls(dto.form_data);

      const existing = await m.getRepository(VolRegistration).findOne({
        where: { email: dto.email, role_id: dto.role_id },
      });
      if (existing) {
        throw new ConflictException('This email is already registered for this role');
      }

      const magicToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + env.teamManagement.magicTokenDays);

      const shirtSize = this.extractShirtSize(dto.form_data);
      const avatarUrl = this.extractString(dto.form_data, 'avatar_photo');
      const cccdUrl = this.extractString(dto.form_data, 'cccd_photo');

      const hasSlot = role.filled_slots < role.max_slots;
      const isApproved = hasSlot;
      const isWaitlisted = !hasSlot && role.waitlist_enabled;
      if (!isApproved && !isWaitlisted) {
        throw new BadRequestException('Role is full and waitlist is disabled');
      }

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
        status: isApproved ? 'approved' : 'waitlisted',
        waitlist_position: waitlistPosition,
        magic_token: magicToken,
        magic_token_expires: expiresAt,
        qr_code: isApproved ? magicToken : null,
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
        await m
          .getRepository(VolRole)
          .increment({ id: role.id }, 'filled_slots', 1);
      }

      return {
        regId: saved.id,
        eventId: role.event_id,
        outcome: {
          status: saved.status as 'approved' | 'waitlisted',
          waitlist_position: saved.waitlist_position,
          magic_token: saved.magic_token,
          event_name: event.event_name,
          role_name: role.role_name,
        },
      };
    });

    await this.cache.invalidateEvent(eventId, [dto.role_id]);

    // Fire-and-forget side effects: QR + email. Failures must not roll back the DB.
    void this.sendPostRegisterEmail(regId, outcome).catch((err) =>
      this.logger.warn(`Post-register email failed for reg ${regId}: ${err.message}`),
    );

    return {
      id: regId,
      status: outcome.status,
      waitlist_position: outcome.waitlist_position,
      message:
        outcome.status === 'approved'
          ? 'Đăng ký thành công! Kiểm tra email để nhận QR code.'
          : `Bạn đang ở danh sách chờ (vị trí ${outcome.waitlist_position}). Chúng tôi sẽ email khi có slot.`,
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
    const qr =
      reg.status === 'approved' && reg.qr_code
        ? await QRCode.toDataURL(reg.qr_code)
        : null;
    return {
      full_name: reg.full_name,
      role_name: reg.role?.role_name ?? '',
      event_name: reg.event?.event_name ?? '',
      status: reg.status,
      waitlist_position: reg.waitlist_position,
      contract_status: reg.contract_status,
      checked_in_at: reg.checked_in_at ? reg.checked_in_at.toISOString() : null,
      qr_code: qr,
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
    const qb = this.regRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.role', 'role')
      .where('r.event_id = :eid', { eid: params.eventId })
      .orderBy('r.created_at', 'DESC')
      .skip((params.page - 1) * params.limit)
      .take(params.limit);
    if (params.status) qb.andWhere('r.status = :s', { s: params.status });
    if (params.roleId) qb.andWhere('r.role_id = :rid', { rid: params.roleId });
    if (params.search) {
      qb.andWhere('(r.full_name LIKE :q OR r.email LIKE :q OR r.phone LIKE :q)', {
        q: `%${params.search}%`,
      });
    }
    const [rows, total] = await qb.getManyAndCount();
    return { data: rows.map((r) => this.toListRow(r)), total };
  }

  /**
   * Full admin detail — CCCD number NOT masked; CCCD photo served via 1h
   * presigned S3 URL. Admin username would normally be logged here for
   * audit; wire that in once the auth module exposes the user payload in
   * the service layer.
   */
  async getDetail(id: number): Promise<RegistrationDetailDto> {
    const reg = await this.regRepo.findOne({
      where: { id },
      relations: { role: true, event: true },
    });
    if (!reg) throw new NotFoundException('Registration not found');

    let cccdPhotoUrl: string | null = null;
    if (reg.cccd_photo_url) {
      try {
        cccdPhotoUrl = await this.photos.presignCccd(reg.cccd_photo_url, 3600);
      } catch (err) {
        this.logger.warn(
          `Failed to presign CCCD reg=${id}: ${(err as Error).message}`,
        );
      }
    }
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
      actual_working_days: reg.actual_working_days,
      actual_compensation: reg.actual_compensation,
      payment_status: reg.payment_status,
      notes: reg.notes,
      created_at: reg.created_at.toISOString(),
    };
  }

  /**
   * Apply the same transition to a batch of registrations. Per-registration
   * transaction so one failure doesn't poison the whole batch.
   * Maximum 200 ids (enforced in DTO).
   */
  async bulkUpdate(
    dto: BulkUpdateRegistrationsDto,
  ): Promise<BulkUpdateResponseDto> {
    let updated = 0;
    let skipped = 0;
    const failed: number[] = [];
    for (const id of dto.ids) {
      try {
        const before = await this.regRepo.findOne({ where: { id } });
        if (!before) {
          failed.push(id);
          continue;
        }
        if (before.status === dto.status) {
          skipped++;
          continue;
        }
        await this.updateRegistration(id, {
          status: dto.status,
          notes: dto.notes,
        });
        updated++;
      } catch (err) {
        this.logger.warn(
          `Bulk update failed id=${id}: ${(err as Error).message}`,
        );
        failed.push(id);
      }
    }
    return { updated, skipped, failed_ids: failed };
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
    };
  }

  /**
   * Strip / mask sensitive fields before returning to admin list views.
   *   - `cccd` (ID number) → `***<last4>`
   *   - `cccd_photo` URL → omitted (admins fetch presigned via /detail)
   */
  private sanitizeFormData(input: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = { ...input };
    if (typeof out.cccd === 'string' && out.cccd.length >= 4) {
      out.cccd = `***${out.cccd.slice(-4)}`;
    }
    delete out.cccd_photo;
    return out;
  }

  /**
   * Admin action: approve / reject / cancel a registration.
   * Side effects on status transitions run inside the same transaction that
   * touches filled_slots, to keep counts consistent.
   */
  async updateRegistration(
    id: number,
    dto: UpdateRegistrationDto,
  ): Promise<VolRegistration> {
    const { updated, waitlistTriggerRoleId } = await this.dataSource.transaction(
      async (m) => {
        const reg = await m
          .getRepository(VolRegistration)
          .findOne({ where: { id } });
        if (!reg) throw new NotFoundException('Registration not found');

        const previousStatus = reg.status;
        let triggerRoleId: number | null = null;

        if (dto.status && dto.status !== previousStatus) {
          if (dto.status === 'approved' && previousStatus !== 'approved') {
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
            reg.magic_token = crypto.randomBytes(32).toString('hex');
            reg.magic_token_expires = this.expiry();
            reg.qr_code = reg.magic_token;
            reg.waitlist_position = null;
          } else if (
            (dto.status === 'rejected' || dto.status === 'cancelled') &&
            previousStatus === 'approved'
          ) {
            await m.getRepository(VolRole).decrement({ id: reg.role_id }, 'filled_slots', 1);
            triggerRoleId = reg.role_id;
          } else if (
            (dto.status === 'rejected' || dto.status === 'cancelled') &&
            previousStatus === 'waitlisted'
          ) {
            // Remove from waitlist → shift positions down.
            const myPos = reg.waitlist_position ?? 0;
            if (myPos > 0) {
              await m
                .getRepository(VolRegistration)
                .createQueryBuilder()
                .update()
                .set({ waitlist_position: () => 'waitlist_position - 1' })
                .where('role_id = :rid', { rid: reg.role_id })
                .andWhere('status = :s', { s: 'waitlisted' })
                .andWhere('waitlist_position > :p', { p: myPos })
                .execute();
            }
            reg.waitlist_position = null;
          }

          reg.status = dto.status;
        }

        if (dto.notes != null) reg.notes = dto.notes;
        if (dto.payment_status != null) reg.payment_status = dto.payment_status;
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

        const saved = await m.getRepository(VolRegistration).save(reg);
        return { updated: saved, waitlistTriggerRoleId: triggerRoleId };
      },
    );

    await this.cache.invalidateEvent(updated.event_id, [updated.role_id]);

    if (waitlistTriggerRoleId != null) {
      // Do not block the HTTP response on the waitlist promotion.
      void this.autoFillWaitlist(waitlistTriggerRoleId).catch((err) =>
        this.logger.warn(`Waitlist auto-fill failed: ${err.message}`),
      );
    }

    return updated;
  }

  /**
   * Promote the head of the waitlist when a slot opens. Runs in its own
   * transaction so the admin action returns immediately.
   */
  async autoFillWaitlist(roleId: number): Promise<VolRegistration | null> {
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
        .where('r.role_id = :rid', { rid: roleId })
        .andWhere('r.status = :s', { s: 'waitlisted' })
        .orderBy('r.waitlist_position', 'ASC')
        .getOne();
      if (!next) return null;

      next.status = 'approved';
      next.magic_token = crypto.randomBytes(32).toString('hex');
      next.magic_token_expires = this.expiry();
      next.qr_code = next.magic_token;
      const oldPos = next.waitlist_position ?? 0;
      next.waitlist_position = null;
      const saved = await m.getRepository(VolRegistration).save(next);

      await m.getRepository(VolRole).increment({ id: roleId }, 'filled_slots', 1);

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
      await this.cache.invalidateEvent(promoted.event_id, [roleId]);
      void this.sendPostRegisterEmail(promoted.id, {
        status: 'approved',
        waitlist_position: null,
        magic_token: promoted.magic_token,
        event_name: '',
        role_name: '',
      }).catch((err) =>
        this.logger.warn(`Waitlist promote email failed: ${err.message}`),
      );
    }

    return promoted;
  }

  // --- helpers ---

  private expiry(): Date {
    const d = new Date();
    d.setDate(d.getDate() + env.teamManagement.magicTokenDays);
    return d;
  }

  private buildMagicLink(token: string): string {
    return `${env.teamManagement.crewBaseUrl}/status/${token}`;
  }

  private validateFormData(
    fields: FormFieldConfig[],
    data: Record<string, unknown>,
  ): void {
    for (const f of fields) {
      const v = data[f.key];
      const isEmpty =
        v == null || v === '' || (Array.isArray(v) && v.length === 0);
      if (f.required && isEmpty) {
        throw new BadRequestException(`Missing required field: ${f.key}`);
      }
      if (isEmpty) continue;
      // If the field has an `options` whitelist, enforce it — otherwise an
      // out-of-list value is silently dropped by the DB enum cast.
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

  /**
   * Reject attacker-controlled URLs in form_data photo fields. Only URLs that
   * point into our S3 bucket under the `team-photos/` prefix are acceptable.
   */
  private validatePhotoUrls(data: Record<string, unknown>): void {
    for (const key of ['avatar_photo', 'cccd_photo']) {
      const v = data[key];
      if (v == null || v === '') continue;
      if (typeof v !== 'string') {
        throw new BadRequestException(`Field "${key}" must be a string URL`);
      }
      // Uploads store CCCD as the raw S3 key (no host), so accept either
      // `team-photos/...` keys OR a full URL pointing to our bucket/CDN.
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

  private async sendPostRegisterEmail(
    regId: number,
    outcome: {
      status: 'approved' | 'waitlisted';
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
    const eventName = outcome.event_name || reg.event?.event_name || '';
    const roleName = outcome.role_name || reg.role?.role_name || '';
    const magicLink = this.buildMagicLink(outcome.magic_token);
    if (outcome.status === 'approved') {
      const qrDataUrl = await QRCode.toDataURL(outcome.magic_token);
      await this.mail.sendTeamRegistrationApproved({
        toEmail: reg.email,
        fullName: reg.full_name,
        eventName,
        roleName,
        magicLink,
        qrDataUrl,
      });
    } else {
      await this.mail.sendTeamWaitlisted({
        toEmail: reg.email,
        fullName: reg.full_name,
        eventName,
        roleName,
        waitlistPosition: outcome.waitlist_position ?? 0,
        magicLink,
      });
    }
  }
}
