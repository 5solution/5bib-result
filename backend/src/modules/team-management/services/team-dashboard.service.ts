import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VolEvent } from '../entities/vol-event.entity';
import { VolRegistration } from '../entities/vol-registration.entity';
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

  /**
   * Single-call dashboard aggregate. Caches JSON for 60s. People list
   * paginated because a race could have 500+ approved personnel and
   * the admin dashboard table shouldn't dump them all.
   */
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

    const [kpi, byRole, shirtSizes, shirtStock, peopleTotal, people] =
      await Promise.all([
        this.kpi(eventId),
        this.breakdownByRole(eventId),
        this.shirtSizeCounts(eventId),
        this.shirtStockRows(eventId),
        this.peopleCount(eventId),
        this.peoplePage(eventId, page, limit),
      ]);

    const response: DashboardResponseDto = {
      event_id: event.id,
      event_name: event.event_name,
      last_updated: new Date().toISOString(),

      total_roles: byRole.filter((r) => r.headcount > 0).length,
      total_approved: kpi.totalApproved,
      total_checked_in: kpi.totalCheckedIn,
      checkin_rate:
        kpi.totalApproved > 0
          ? Math.round((kpi.totalCheckedIn / kpi.totalApproved) * 100)
          : 0,
      total_contract_signed: kpi.totalContractSigned,
      total_contract_unsigned: kpi.totalApproved - kpi.totalContractSigned,
      total_paid: kpi.totalPaid,

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

    // 60s cache. Invalidated by cache.invalidateEvent(eventId) on any mutation.
    await this.cache.setJson(cacheKey, response, 60);
    return response;
  }

  private async kpi(eventId: number): Promise<{
    totalApproved: number;
    totalCheckedIn: number;
    totalContractSigned: number;
    totalPaid: number;
  }> {
    const row = await this.regRepo
      .createQueryBuilder('r')
      .select('COUNT(r.id)', 'total_approved')
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
      .where('r.event_id = :eid', { eid: eventId })
      .andWhere("r.status = 'approved'")
      .getRawOne<{
        total_approved: string;
        total_checked_in: string;
        total_contract_signed: string;
        total_paid: string;
      }>();
    return {
      totalApproved: Number(row?.total_approved ?? 0),
      totalCheckedIn: Number(row?.total_checked_in ?? 0),
      totalContractSigned: Number(row?.total_contract_signed ?? 0),
      totalPaid: Number(row?.total_paid ?? 0),
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
      .andWhere("r.status = 'approved'")
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
      .andWhere("r.status = 'approved'")
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
      .andWhere("r.status = 'approved'")
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
    return this.regRepo.count({
      where: { event_id: eventId, status: 'approved' },
    });
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
      .andWhere("r.status = 'approved'")
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
