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
import {
  ShirtSize,
  VolRegistration,
} from '../entities/vol-registration.entity';
import { RegisterDto } from '../dto/register.dto';
import {
  RegisterResponseDto,
  StatusResponseDto,
} from '../dto/response.dto';
import { UpdateRegistrationDto } from '../dto/update-registration.dto';
import { TeamCacheService } from './team-cache.service';

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
  ) {}

  /**
   * Public registration — atomic transaction with pessimistic write lock on
   * the role row to prevent two users grabbing the same last slot.
   */
  async register(dto: RegisterDto): Promise<RegisterResponseDto> {
    const { regId, outcome } = await this.dataSource.transaction(async (m) => {
      const role = await m
        .getRepository(VolRole)
        .createQueryBuilder('r')
        .setLock('pessimistic_write')
        .where('r.id = :id', { id: dto.role_id })
        .getOne();
      if (!role) throw new NotFoundException('Role not found');

      const event = await m
        .getRepository(VolEvent)
        .findOne({ where: { id: role.event_id } });
      if (!event) throw new NotFoundException('Event not found');
      if (event.status !== 'open') {
        throw new BadRequestException('Event not open for registration');
      }
      const now = new Date();
      if (event.registration_open > now || event.registration_close < now) {
        throw new BadRequestException('Registration window closed');
      }

      this.validateFormData(role.form_fields, dto.form_data);

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
        outcome: {
          status: saved.status as 'approved' | 'waitlisted',
          waitlist_position: saved.waitlist_position,
          magic_token: saved.magic_token,
          event_name: event.event_name,
          role_name: role.role_name,
        },
      };
    });

    await this.cache.invalidateEvent(
      (await this.regRepo.findOne({ where: { id: regId } }))!.event_id,
      [dto.role_id],
    );

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
    page?: number;
    limit?: number;
  }): Promise<{ data: VolRegistration[]; total: number }> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(200, Math.max(1, params.limit ?? 50));
    const qb = this.regRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.role', 'role')
      .where('r.event_id = :eid', { eid: params.eventId })
      .orderBy('r.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    if (params.status) qb.andWhere('r.status = :s', { s: params.status });
    if (params.roleId) qb.andWhere('r.role_id = :rid', { rid: params.roleId });
    if (params.search) {
      qb.andWhere('(r.full_name LIKE :q OR r.email LIKE :q OR r.phone LIKE :q)', {
        q: `%${params.search}%`,
      });
    }
    const [data, total] = await qb.getManyAndCount();
    return { data, total };
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
      if (!f.required) continue;
      const v = data[f.key];
      if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) {
        throw new BadRequestException(`Missing required field: ${f.key}`);
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
