import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VolEvent } from '../entities/vol-event.entity';
import {
  REGISTRATION_STATUS_VALUES,
  RegistrationStatus,
  VolRegistration,
} from '../entities/vol-registration.entity';
import { VolRole } from '../entities/vol-role.entity';
import { VolShirtStock } from '../entities/vol-shirt-stock.entity';
import {
  DashboardPersonDto,
  DashboardQueryDto,
  DashboardResponseDto,
  DashboardRoleBreakdownDto,
  DashboardShirtSizeDto,
} from '../dto/dashboard.dto';
import type { ShirtSizeEnum } from '../dto/shirt-stock.dto';
import { TeamCacheService } from './team-cache.service';

/**
 * Statuses that represent "active personnel" — everything from approved
 * onwards. Used for legacy total_approved / shirt / breakdown metrics.
 */
const POST_APPROVE: RegistrationStatus[] = [
  'approved',
  'contract_sent',
  'contract_signed',
  'qr_sent',
  'checked_in',
  'completed',
];

@Injectable()
export class TeamDashboardService {
  constructor(
    @InjectRepository(VolEvent, 'volunteer')
    private readonly eventRepo: Repository<VolEvent>,
    @InjectRepository(VolRegistration, 'volunteer')
    private readonly regRepo: Repository<VolRegistration>,
    @InjectRepository(VolRole, 'volunteer')
    private readonly roleRepo: Repository<VolRole>,
    @InjectRepository(VolShirtStock, 'volunteer')
    private readonly stockRepo: Repository<VolShirtStock>,
    private readonly cache: TeamCacheService,
  ) {}

  async getDashboard(
    eventId: number,
    params: DashboardQueryDto,
  ): Promise<DashboardResponseDto> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 100;
    const cacheKey = `team:event:${eventId}:dashboard:p${page}:l${limit}`;
    const cached = await this.cache.getJson<DashboardResponseDto>(cacheKey);
    if (cached) return cached;

    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    const [
      statusCounts,
      kpi,
      byRole,
      shirtSizes,
      shirtStock,
      peopleTotal,
      people,
    ] = await Promise.all([
      this.countByStatus(eventId),
      this.kpi(eventId),
      this.breakdownByRole(eventId),
      this.shirtSizeCounts(eventId),
      this.shirtStockRows(eventId),
      this.peopleCount(eventId),
      this.peoplePage(eventId, page, limit),
    ]);

    const total = REGISTRATION_STATUS_VALUES.reduce(
      (sum, s) => sum + (statusCounts[s] ?? 0),
      0,
    );
    const totalApproved = POST_APPROVE.reduce(
      (sum, s) => sum + (statusCounts[s] ?? 0),
      0,
    );

    const response: DashboardResponseDto = {
      event_id: event.id,
      event_name: event.event_name,
      last_updated: new Date().toISOString(),

      total_roles: byRole.filter((r) => r.headcount > 0).length,
      total,

      pending_approval: statusCounts.pending_approval ?? 0,
      approved: statusCounts.approved ?? 0,
      contract_sent: statusCounts.contract_sent ?? 0,
      contract_signed: statusCounts.contract_signed ?? 0,
      qr_sent: statusCounts.qr_sent ?? 0,
      checked_in: statusCounts.checked_in ?? 0,
      completed: statusCounts.completed ?? 0,
      waitlisted: statusCounts.waitlisted ?? 0,
      rejected: statusCounts.rejected ?? 0,
      cancelled: statusCounts.cancelled ?? 0,

      total_approved: totalApproved,
      total_checked_in: kpi.totalCheckedIn,
      checkin_rate:
        totalApproved > 0
          ? Math.round((kpi.totalCheckedIn / totalApproved) * 100)
          : 0,
      total_contract_signed: kpi.totalContractSigned,
      total_contract_unsigned: totalApproved - kpi.totalContractSigned,
      total_paid: kpi.totalPaid,
      total_suspicious: kpi.totalSuspicious,

      by_role: byRole,
      shirt_sizes: shirtSizes,
      total_shirt_registered: shirtSizes.reduce(
        (s, r) => s + (r.size ? r.count : 0),
        0,
      ),
      shirt_stock: shirtStock,
      people,
      people_total: peopleTotal,
    };

    await this.cache.setJson(cacheKey, response, 60);
    return response;
  }

  /** GROUP BY status for the 9-card KPI map. */
  private async countByStatus(
    eventId: number,
  ): Promise<Record<string, number>> {
    const rows = await this.regRepo
      .createQueryBuilder('r')
      .select('r.status', 'status')
      .addSelect('COUNT(r.id)', 'count')
      .where('r.event_id = :eid', { eid: eventId })
      .groupBy('r.status')
      .getRawMany<{ status: string; count: string }>();
    const out: Record<string, number> = {};
    for (const s of REGISTRATION_STATUS_VALUES) out[s] = 0;
    for (const row of rows) out[row.status] = Number(row.count);
    return out;
  }

  private async kpi(eventId: number): Promise<{
    totalCheckedIn: number;
    totalContractSigned: number;
    totalPaid: number;
    totalSuspicious: number;
  }> {
    const row = await this.regRepo
      .createQueryBuilder('r')
      .addSelect(
        'SUM(CASE WHEN r.checked_in_at IS NOT NULL THEN 1 ELSE 0 END)',
        'total_checked_in',
      )
      .addSelect(
        "SUM(CASE WHEN r.contract_status = 'signed' THEN 1 ELSE 0 END)",
        'total_contract_signed',
      )
      .addSelect(
        "SUM(CASE WHEN r.payment_status = 'paid' THEN 1 ELSE 0 END)",
        'total_paid',
      )
      .addSelect(
        'SUM(CASE WHEN r.suspicious_checkin = 1 THEN 1 ELSE 0 END)',
        'total_suspicious',
      )
      .where('r.event_id = :eid', { eid: eventId })
      .andWhere('r.status IN (:...statuses)', { statuses: POST_APPROVE })
      .getRawOne<{
        total_checked_in: string;
        total_contract_signed: string;
        total_paid: string;
        total_suspicious: string;
      }>();
    return {
      totalCheckedIn: Number(row?.total_checked_in ?? 0),
      totalContractSigned: Number(row?.total_contract_signed ?? 0),
      totalPaid: Number(row?.total_paid ?? 0),
      totalSuspicious: Number(row?.total_suspicious ?? 0),
    };
  }

  private async breakdownByRole(
    eventId: number,
  ): Promise<DashboardRoleBreakdownDto[]> {
    const roles = await this.roleRepo.find({
      where: { event_id: eventId },
      order: { sort_order: 'ASC', id: 'ASC' },
    });
    const rows = await this.regRepo
      .createQueryBuilder('r')
      .select('r.role_id', 'role_id')
      .addSelect('COUNT(r.id)', 'headcount')
      .addSelect(
        'SUM(CASE WHEN r.checked_in_at IS NOT NULL THEN 1 ELSE 0 END)',
        'checked_in',
      )
      .addSelect(
        "SUM(CASE WHEN r.contract_status = 'signed' THEN 1 ELSE 0 END)",
        'contract_signed',
      )
      .addSelect(
        "SUM(CASE WHEN r.payment_status = 'paid' THEN 1 ELSE 0 END)",
        'paid',
      )
      .where('r.event_id = :eid', { eid: eventId })
      .andWhere('r.status IN (:...statuses)', { statuses: POST_APPROVE })
      .groupBy('r.role_id')
      .getRawMany<{
        role_id: number;
        headcount: string;
        checked_in: string;
        contract_signed: string;
        paid: string;
      }>();
    const byId = new Map<number, (typeof rows)[number]>();
    for (const row of rows) byId.set(Number(row.role_id), row);
    return roles.map((role) => {
      const row = byId.get(role.id);
      return {
        role_id: role.id,
        role_name: role.role_name,
        headcount: row ? Number(row.headcount) : 0,
        checked_in: row ? Number(row.checked_in) : 0,
        contract_signed: row ? Number(row.contract_signed) : 0,
        paid: row ? Number(row.paid) : 0,
      };
    });
  }

  private async shirtSizeCounts(
    eventId: number,
  ): Promise<DashboardShirtSizeDto[]> {
    const rows = await this.regRepo
      .createQueryBuilder('r')
      .select('r.shirt_size', 'size')
      .addSelect('COUNT(r.id)', 'count')
      .where('r.event_id = :eid', { eid: eventId })
      .andWhere('r.status IN (:...statuses)', { statuses: POST_APPROVE })
      .groupBy('r.shirt_size')
      .getRawMany<{ size: ShirtSizeEnum | null; count: string }>();
    return rows.map((row) => ({
      size: row.size,
      count: Number(row.count),
    }));
  }

  private async shirtStockRows(
    eventId: number,
  ): Promise<DashboardResponseDto['shirt_stock']> {
    const stocks = await this.stockRepo.find({
      where: { event_id: eventId },
      order: { size: 'ASC' },
    });
    const regRows = await this.regRepo
      .createQueryBuilder('r')
      .select('r.shirt_size', 'size')
      .addSelect('COUNT(r.id)', 'count')
      .where('r.event_id = :eid', { eid: eventId })
      .andWhere('r.status IN (:...statuses)', { statuses: POST_APPROVE })
      .andWhere('r.shirt_size IS NOT NULL')
      .groupBy('r.shirt_size')
      .getRawMany<{ size: ShirtSizeEnum; count: string }>();
    const regBySize = new Map<ShirtSizeEnum, number>();
    for (const r of regRows) regBySize.set(r.size, Number(r.count));
    return stocks.map((s) => ({
      size: s.size,
      registered: regBySize.get(s.size) ?? 0,
      planned: s.quantity_planned,
      ordered: s.quantity_ordered,
      received: s.quantity_received,
    }));
  }

  private async peopleCount(eventId: number): Promise<number> {
    return this.regRepo
      .createQueryBuilder('r')
      .where('r.event_id = :eid', { eid: eventId })
      .andWhere('r.status IN (:...statuses)', { statuses: POST_APPROVE })
      .getCount();
  }

  private async peoplePage(
    eventId: number,
    page: number,
    limit: number,
  ): Promise<DashboardPersonDto[]> {
    const rows = await this.regRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.role', 'role')
      .where('r.event_id = :eid', { eid: eventId })
      .andWhere('r.status IN (:...statuses)', { statuses: POST_APPROVE })
      .orderBy('role.sort_order', 'ASC')
      .addOrderBy('r.full_name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();
    return rows.map((r) => ({
      id: r.id,
      full_name: r.full_name,
      role_id: r.role_id,
      role_name: r.role?.role_name ?? '',
      shirt_size: r.shirt_size,
      contract_status: r.contract_status,
      checked_in_at: r.checked_in_at ? r.checked_in_at.toISOString() : null,
      payment_status: r.payment_status,
      avatar_photo_url: r.avatar_photo_url,
    }));
  }
}
