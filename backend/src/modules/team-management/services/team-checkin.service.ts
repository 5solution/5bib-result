import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VolEvent } from '../entities/vol-event.entity';
import { VolRole } from '../entities/vol-role.entity';
import {
  CheckinMethod,
  RegistrationStatus,
  VolRegistration,
} from '../entities/vol-registration.entity';
import {
  CheckinLookupResponseDto,
  CheckinLookupRowDto,
  CheckinResponseDto,
  CheckinStatsDto,
  SelfCheckinDto,
} from '../dto/checkin.dto';
import { TeamCacheService } from './team-cache.service';

const EARTH_RADIUS_M = 6_371_000;
const LOOKUP_LIMIT = 8;

@Injectable()
export class TeamCheckinService {
  private readonly logger = new Logger(TeamCheckinService.name);

  constructor(
    @InjectRepository(VolRegistration, 'volunteer')
    private readonly regRepo: Repository<VolRegistration>,
    @InjectRepository(VolEvent, 'volunteer')
    private readonly eventRepo: Repository<VolEvent>,
    @InjectRepository(VolRole, 'volunteer')
    private readonly roleRepo: Repository<VolRole>,
    private readonly cache: TeamCacheService,
  ) {}

  async scanByQr(qrCode: string, eventId?: number): Promise<CheckinResponseDto> {
    const reg = await this.regRepo.findOne({
      where: { qr_code: qrCode },
      relations: { role: true, event: true },
    });
    if (!reg) throw new NotFoundException('QR not found');
    if (eventId != null && reg.event_id !== eventId) {
      throw new BadRequestException('QR belongs to a different event');
    }
    return this.commitCheckin(reg, 'qr_scan');
  }

  async selfCheckin(
    token: string,
    coords: SelfCheckinDto,
  ): Promise<CheckinResponseDto> {
    const reg = await this.regRepo.findOne({
      where: { magic_token: token },
      relations: { role: true, event: true },
    });
    if (!reg) throw new NotFoundException('Token not found');
    if (reg.magic_token_expires < new Date()) {
      throw new UnauthorizedException('Token expired');
    }
    const event = reg.event;
    if (!event) throw new NotFoundException('Event not found');
    if (event.location_lat == null || event.location_lng == null) {
      throw new BadRequestException('Event has no GPS location configured');
    }
    const distance = haversineMeters(
      Number(event.location_lat),
      Number(event.location_lng),
      coords.lat,
      coords.lng,
    );
    if (distance > event.checkin_radius_m) {
      throw new BadRequestException(
        `You are ${Math.round(distance)}m from the event (radius ${event.checkin_radius_m}m). Move closer and try again.`,
      );
    }
    reg.checkin_lat = coords.lat;
    reg.checkin_lng = coords.lng;
    return this.commitCheckin(reg, 'gps_verify');
  }

  private async commitCheckin(
    reg: VolRegistration,
    method: CheckinMethod,
  ): Promise<CheckinResponseDto> {
    // v1.4: check-in requires status === 'qr_sent'. Rows earlier in the
    // pipeline (pending_approval, approved, contract_sent, contract_signed)
    // haven't finished the pre-event flow; rows later (checked_in,
    // completed) are already handled.
    if (reg.status !== 'qr_sent') {
      throw new BadRequestException(
        `Cannot check in — registration status is "${reg.status}", expected "qr_sent"`,
      );
    }
    if (reg.checked_in_at) {
      throw new BadRequestException(
        `Already checked in at ${reg.checked_in_at.toISOString()}`,
      );
    }
    const now = new Date();
    reg.checked_in_at = now;
    reg.checkin_method = method;
    reg.status = 'checked_in';
    const saved = await this.regRepo.save(reg);
    await this.cache.invalidateEvent(saved.event_id, [saved.role_id]);
    return {
      success: true,
      full_name: saved.full_name,
      role_name: saved.role?.role_name ?? '',
      checked_in_at: now.toISOString(),
      method,
    };
  }

  /**
   * Fallback lookup for race-day staff — can't realistically type a 64-char
   * magic_token by hand. Matches across full_name / phone / form_data.cccd
   * with trimmed LIKE (case-insensitive). Also does last-N match on CCCD
   * when the query is 4–12 pure digits. Only returns `approved` regs.
   */
  async lookup(
    query: string,
    eventId: number,
    adminIdentity: string,
  ): Promise<CheckinLookupResponseDto> {
    const q = (query ?? '').trim();
    if (q.length < 2) {
      throw new BadRequestException('Query must be at least 2 characters');
    }

    // Race-day staff lookup — surfaces people who are eligible for check-in
    // (qr_sent) plus those already checked in (for "mark completed" flow).
    const qb = this.regRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.role', 'role')
      .where('r.event_id = :eid', { eid: eventId })
      .andWhere("r.status IN ('qr_sent', 'checked_in', 'completed')");

    const like = `%${q}%`;
    const isDigits = /^\d{4,12}$/.test(q);

    if (isDigits) {
      // Pure-digit query: also allow last-N CCCD match (e.g. staff asks
      // TNV for "4 số cuối CCCD") and last-N phone.
      const digitsLike = `%${q}`;
      qb.andWhere(
        `(
          LOWER(r.full_name) LIKE LOWER(:like)
          OR r.phone LIKE :like
          OR r.phone LIKE :digitsLike
          OR CAST(JSON_UNQUOTE(JSON_EXTRACT(r.form_data, '$.cccd')) AS CHAR) LIKE :like
          OR CAST(JSON_UNQUOTE(JSON_EXTRACT(r.form_data, '$.cccd')) AS CHAR) LIKE :digitsLike
        )`,
        { like, digitsLike },
      );
    } else {
      qb.andWhere(
        `(
          LOWER(r.full_name) LIKE LOWER(:like)
          OR r.phone LIKE :like
          OR LOWER(CAST(JSON_UNQUOTE(JSON_EXTRACT(r.form_data, '$.cccd')) AS CHAR)) LIKE LOWER(:like)
        )`,
        { like },
      );
    }

    // Not-yet-checked-in first, then alphabetical by name.
    qb.orderBy('CASE WHEN r.checked_in_at IS NULL THEN 0 ELSE 1 END', 'ASC')
      .addOrderBy('r.full_name', 'ASC')
      .limit(LOOKUP_LIMIT);

    const rows = await qb.getMany();

    this.logger.log(
      `CHECKIN_LOOKUP admin=${adminIdentity} q="${q}" eventId=${eventId} matches=${rows.length}`,
    );

    return {
      data: rows.map((r) => this.toLookupRow(r)),
    };
  }

  private toLookupRow(r: VolRegistration): CheckinLookupRowDto {
    const form = (r.form_data ?? {}) as Record<string, unknown>;
    const rawCccd = typeof form.cccd === 'string' ? form.cccd : '';
    const cccd_last4 = rawCccd.length >= 4 ? rawCccd.slice(-4) : '';
    const avatarFromForm =
      typeof form.avatar_photo === 'string' ? form.avatar_photo : null;
    return {
      id: r.id,
      full_name: r.full_name,
      role_name: r.role?.role_name ?? '',
      cccd_last4,
      phone_masked: maskPhone(r.phone),
      avatar_photo_url: r.avatar_photo_url ?? avatarFromForm,
      status: r.status,
      checked_in_at: r.checked_in_at ? r.checked_in_at.toISOString() : null,
      qr_code: r.qr_code ?? r.magic_token,
    };
  }

  async statsForEvent(eventId: number): Promise<CheckinStatsDto> {
    const roles = await this.roleRepo.find({ where: { event_id: eventId } });
    const roleMap = new Map<number, string>();
    for (const r of roles) roleMap.set(r.id, r.role_name);

    // "Approved" in this stats context = everyone who is pipeline-eligible
    // (pre-checkin or beyond). Pre-v1.4 this literally meant `status='approved'`;
    // in v1.4 it's any status that holds a slot.
    const POST_APPROVE: RegistrationStatus[] = [
      'approved',
      'contract_sent',
      'contract_signed',
      'qr_sent',
      'checked_in',
      'completed',
    ];
    const rows = await this.regRepo
      .createQueryBuilder('r')
      .select('r.role_id', 'role_id')
      .addSelect('COUNT(r.id)', 'approved')
      .addSelect(
        'SUM(CASE WHEN r.checked_in_at IS NOT NULL THEN 1 ELSE 0 END)',
        'checked_in',
      )
      .where('r.event_id = :eid', { eid: eventId })
      .andWhere('r.status IN (:...statuses)', { statuses: POST_APPROVE })
      .groupBy('r.role_id')
      .getRawMany<{ role_id: number; approved: string; checked_in: string }>();

    let totalApproved = 0;
    let totalCheckedIn = 0;
    const byRole = rows.map((row) => {
      const approved = Number(row.approved);
      const checkedIn = Number(row.checked_in);
      totalApproved += approved;
      totalCheckedIn += checkedIn;
      return {
        role_name: roleMap.get(Number(row.role_id)) ?? `role#${row.role_id}`,
        approved,
        checked_in: checkedIn,
      };
    });
    const percentage = totalApproved > 0
      ? Math.round((totalCheckedIn / totalApproved) * 100)
      : 0;
    return {
      total_approved: totalApproved,
      total_checked_in: totalCheckedIn,
      percentage,
      by_role: byRole,
    };
  }
}

/**
 * Mask middle digits of a VN phone so a list visible to passers-by doesn't
 * leak the full number. Falls back to the raw phone if the length doesn't
 * match an expected pattern (don't throw — staff still needs to see
 * *something* to disambiguate).
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const raw = phone.trim();
  const digits = raw.replace(/\D/g, '');
  // Mask only when we have at least head(3) + mask(3) + tail(3) = 9 digits.
  if (digits.length < 9) return raw;
  const head = digits.slice(0, 3);
  const tail = digits.slice(-3);
  return `${head}***${tail}`;
}

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.asin(Math.min(1, Math.sqrt(a)));
  return EARTH_RADIUS_M * c;
}
