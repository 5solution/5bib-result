import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VolEvent } from '../entities/vol-event.entity';
import { VolRole } from '../entities/vol-role.entity';
import { VolRegistration } from '../entities/vol-registration.entity';
import {
  CheckinResponseDto,
  CheckinStatsDto,
  SelfCheckinDto,
} from '../dto/checkin.dto';
import { TeamCacheService } from './team-cache.service';

const EARTH_RADIUS_M = 6_371_000;

@Injectable()
export class TeamCheckinService {
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
    reg.checkin_lat = String(coords.lat);
    reg.checkin_lng = String(coords.lng);
    return this.commitCheckin(reg, 'gps_verify');
  }

  private async commitCheckin(
    reg: VolRegistration,
    method: 'qr_scan' | 'gps_verify',
  ): Promise<CheckinResponseDto> {
    if (reg.status !== 'approved') {
      throw new BadRequestException(
        `Cannot check in — registration status is "${reg.status}"`,
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

  async statsForEvent(eventId: number): Promise<CheckinStatsDto> {
    const roles = await this.roleRepo.find({ where: { event_id: eventId } });
    const roleMap = new Map<number, string>();
    for (const r of roles) roleMap.set(r.id, r.role_name);

    const rows = await this.regRepo
      .createQueryBuilder('r')
      .select('r.role_id', 'role_id')
      .addSelect('COUNT(r.id)', 'approved')
      .addSelect(
        'SUM(CASE WHEN r.checked_in_at IS NOT NULL THEN 1 ELSE 0 END)',
        'checked_in',
      )
      .where('r.event_id = :eid', { eid: eventId })
      .andWhere("r.status = 'approved'")
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
