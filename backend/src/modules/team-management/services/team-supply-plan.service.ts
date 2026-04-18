import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { VolEvent } from '../entities/vol-event.entity';
import { VolRole } from '../entities/vol-role.entity';
import { VolSupplyItem } from '../entities/vol-supply-item.entity';
import { VolSupplyPlan } from '../entities/vol-supply-plan.entity';
import { VolSupplyAllocation } from '../entities/vol-supply-allocation.entity';
import {
  EventSupplyOverviewDto,
  SupplyOverviewCellDto,
  SupplyOverviewItemRowDto,
  SupplyPlanRowDto,
  UpsertSupplyPlanFulfillDto,
  UpsertSupplyPlanRequestDto,
} from '../dto/supply.dto';
import { TeamCacheService, CACHE_TTL } from './team-cache.service';

/**
 * v1.6 Supply Plan service.
 *
 * A plan row = unique (role_id, item_id). Leader sets requested_qty +
 * request_note; admin sets fulfilled_qty + fulfill_note. gap_qty is a
 * MariaDB STORED generated column.
 *
 * Q7: leaders can only upsert for their own role. Admin (actorRoleId=null)
 * can upsert for any role.
 */
@Injectable()
export class TeamSupplyPlanService {
  private readonly logger = new Logger(TeamSupplyPlanService.name);

  constructor(
    @InjectDataSource('volunteer') private readonly dataSource: DataSource,
    @InjectRepository(VolEvent, 'volunteer')
    private readonly eventRepo: Repository<VolEvent>,
    @InjectRepository(VolRole, 'volunteer')
    private readonly roleRepo: Repository<VolRole>,
    @InjectRepository(VolSupplyItem, 'volunteer')
    private readonly itemRepo: Repository<VolSupplyItem>,
    @InjectRepository(VolSupplyPlan, 'volunteer')
    private readonly planRepo: Repository<VolSupplyPlan>,
    @InjectRepository(VolSupplyAllocation, 'volunteer')
    private readonly allocRepo: Repository<VolSupplyAllocation>,
    private readonly cache: TeamCacheService,
  ) {}

  /**
   * Return every item in the event + current plan row (if any) for the
   * role. Missing plans are returned with `requested_qty=0, fulfilled_qty=null`
   * so the UI can render a full table.
   */
  async getPlanForRole(
    eventId: number,
    roleId: number,
  ): Promise<SupplyPlanRowDto[]> {
    const key = TeamCacheService.keySupplyPlan(eventId, roleId);
    const hit = await this.cache.getJson<SupplyPlanRowDto[]>(key);
    if (hit) return hit;

    await this.assertEventRole(eventId, roleId);

    const items = await this.itemRepo.find({
      where: { event_id: eventId },
      order: { sort_order: 'ASC', id: 'ASC' },
    });
    if (items.length === 0) {
      await this.cache.setJson(key, [], CACHE_TTL.supplyPlan);
      return [];
    }

    const plans = await this.planRepo.find({
      where: { event_id: eventId, role_id: roleId, item_id: In(items.map((i) => i.id)) },
    });
    const planByItem = new Map(plans.map((p) => [p.item_id, p]));

    const rows: SupplyPlanRowDto[] = items.map((item) => {
      const plan = planByItem.get(item.id);
      return {
        plan_id: plan?.id ?? null,
        item_id: item.id,
        item_name: item.item_name,
        unit: item.unit,
        requested_qty: plan?.requested_qty ?? 0,
        request_note: plan?.request_note ?? null,
        fulfilled_qty: plan?.fulfilled_qty ?? null,
        fulfill_note: plan?.fulfill_note ?? null,
        gap_qty: plan?.gap_qty ?? null,
        updated_at: plan?.updated_at ? plan.updated_at.toISOString() : null,
      };
    });
    await this.cache.setJson(key, rows, CACHE_TTL.supplyPlan);
    return rows;
  }

  /**
   * Leader request upsert. Bulk: each entry overwrites requested_qty +
   * request_note. `actorRoleId` is the caller's role id (null if admin is
   * acting on leader's behalf).
   */
  async upsertRequest(
    eventId: number,
    roleId: number,
    dto: UpsertSupplyPlanRequestDto,
    actorRoleId: number | null,
  ): Promise<SupplyPlanRowDto[]> {
    // v1.6 Option A: when a leader is the actor, the target roleId must be
    // the role that leader.role.manages_role_id points to. If actorRoleId
    // already equals roleId it's a legacy same-role call — also allow it
    // for backward compat. Otherwise actorRole.manages_role_id must match.
    if (actorRoleId !== null && actorRoleId !== roleId) {
      const actorRole = await this.roleRepo.findOne({
        where: { id: actorRoleId },
      });
      if (!actorRole) {
        throw new ForbiddenException('Leader role not found');
      }
      if (!actorRole.is_leader_role) {
        throw new ForbiddenException('Actor is not a leader role');
      }
      if (actorRole.manages_role_id == null) {
        throw new BadRequestException(
          'Leader role chưa được cấu hình quản lý role nào. Liên hệ admin cấu hình "Quản lý role" trong Role.',
        );
      }
      if (actorRole.manages_role_id !== roleId) {
        throw new ForbiddenException(
          'Leader may only edit plan for the role they manage',
        );
      }
    }
    await this.assertEventRole(eventId, roleId);
    await this.assertItemsBelong(eventId, dto.items.map((i) => i.item_id));

    await this.dataSource.transaction(async (m) => {
      const planRepo = m.getRepository(VolSupplyPlan);
      for (const entry of dto.items) {
        const existing = await planRepo.findOne({
          where: { event_id: eventId, role_id: roleId, item_id: entry.item_id },
        });
        if (existing) {
          existing.requested_qty = entry.requested_qty;
          existing.request_note = entry.request_note ?? null;
          await planRepo.save(existing);
        } else {
          await planRepo.save(
            planRepo.create({
              event_id: eventId,
              role_id: roleId,
              item_id: entry.item_id,
              requested_qty: entry.requested_qty,
              request_note: entry.request_note ?? null,
              fulfilled_qty: null,
              fulfill_note: null,
            }),
          );
        }
      }
    });
    await this.cache.invalidateSupplyPlan(eventId, roleId);
    this.logger.log(
      `[SUPPLY] plan.request event=${eventId} role=${roleId} items=${dto.items.length} by=${actorRoleId ?? 'admin'}`,
    );
    return this.getPlanForRole(eventId, roleId);
  }

  /** Admin fulfill upsert. Bulk sets fulfilled_qty + fulfill_note. */
  async upsertFulfill(
    eventId: number,
    roleId: number,
    dto: UpsertSupplyPlanFulfillDto,
  ): Promise<SupplyPlanRowDto[]> {
    await this.assertEventRole(eventId, roleId);
    await this.assertItemsBelong(eventId, dto.items.map((i) => i.item_id));

    await this.dataSource.transaction(async (m) => {
      const planRepo = m.getRepository(VolSupplyPlan);
      for (const entry of dto.items) {
        const existing = await planRepo.findOne({
          where: { event_id: eventId, role_id: roleId, item_id: entry.item_id },
        });
        if (existing) {
          existing.fulfilled_qty = entry.fulfilled_qty;
          existing.fulfill_note = entry.fulfill_note ?? null;
          await planRepo.save(existing);
        } else {
          // Admin may fulfill before the leader requests; create a row with
          // requested_qty=0 so the gap column reflects "admin pushed supply
          // without a formal request".
          await planRepo.save(
            planRepo.create({
              event_id: eventId,
              role_id: roleId,
              item_id: entry.item_id,
              requested_qty: 0,
              request_note: null,
              fulfilled_qty: entry.fulfilled_qty,
              fulfill_note: entry.fulfill_note ?? null,
            }),
          );
        }
      }
    });
    await this.cache.invalidateSupplyPlan(eventId, roleId);
    this.logger.log(
      `[SUPPLY] plan.fulfill event=${eventId} role=${roleId} items=${dto.items.length}`,
    );
    return this.getPlanForRole(eventId, roleId);
  }

  /**
   * Admin matrix: for each item × role, show plan (requested/fulfilled/gap)
   * + SUM(allocated) + SUM(confirmed) across all stations in that role.
   */
  async getEventOverview(eventId: number): Promise<EventSupplyOverviewDto> {
    const key = TeamCacheService.keySupplyOverview(eventId);
    const hit = await this.cache.getJson<EventSupplyOverviewDto>(key);
    if (hit) return hit;

    const [roles, items, plans] = await Promise.all([
      this.roleRepo.find({
        where: { event_id: eventId },
        order: { sort_order: 'ASC', id: 'ASC' },
      }),
      this.itemRepo.find({
        where: { event_id: eventId },
        order: { sort_order: 'ASC', id: 'ASC' },
      }),
      this.planRepo.find({ where: { event_id: eventId } }),
    ]);

    // Aggregate allocation totals by (role_id, item_id) via one JOIN query.
    // vol_supply_allocation → vol_station.role_id.
    const allocTotals = await this.dataSource
      .getRepository(VolSupplyAllocation)
      .createQueryBuilder('a')
      .innerJoin('vol_station', 's', 's.id = a.station_id')
      .select('s.role_id', 'role_id')
      .addSelect('a.item_id', 'item_id')
      .addSelect('SUM(a.allocated_qty)', 'allocated_qty')
      .addSelect('SUM(COALESCE(a.confirmed_qty, 0))', 'confirmed_qty')
      .where('s.event_id = :eventId', { eventId })
      .groupBy('s.role_id')
      .addGroupBy('a.item_id')
      .getRawMany<{
        role_id: string;
        item_id: string;
        allocated_qty: string;
        confirmed_qty: string;
      }>();

    const allocByKey = new Map<string, { allocated: number; confirmed: number }>();
    for (const r of allocTotals) {
      allocByKey.set(`${r.role_id}:${r.item_id}`, {
        allocated: Number(r.allocated_qty) || 0,
        confirmed: Number(r.confirmed_qty) || 0,
      });
    }

    const planByKey = new Map(
      plans.map((p) => [`${p.role_id}:${p.item_id}`, p]),
    );

    const itemRows: SupplyOverviewItemRowDto[] = items.map((item) => {
      const cells: SupplyOverviewCellDto[] = roles.map((role) => {
        const key = `${role.id}:${item.id}`;
        const plan = planByKey.get(key);
        const alloc = allocByKey.get(key) ?? { allocated: 0, confirmed: 0 };
        return {
          role_id: role.id,
          requested_qty: plan?.requested_qty ?? 0,
          fulfilled_qty: plan?.fulfilled_qty ?? null,
          gap_qty: plan?.gap_qty ?? null,
          allocated_qty: alloc.allocated,
          confirmed_qty: alloc.confirmed,
        };
      });
      return {
        item_id: item.id,
        item_name: item.item_name,
        unit: item.unit,
        cells,
      };
    });

    const overview: EventSupplyOverviewDto = {
      roles: roles.map((r) => ({ role_id: r.id, role_name: r.role_name })),
      items: itemRows,
    };
    await this.cache.setJson(key, overview, CACHE_TTL.supplyOverview);
    return overview;
  }

  private async assertEventRole(eventId: number, roleId: number): Promise<void> {
    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!role || role.event_id !== eventId) {
      throw new NotFoundException('Role not found in event');
    }
  }

  private async assertItemsBelong(
    eventId: number,
    itemIds: number[],
  ): Promise<void> {
    if (itemIds.length === 0) return;
    const unique = Array.from(new Set(itemIds));
    const items = await this.itemRepo.find({
      where: { id: In(unique) },
    });
    if (items.length !== unique.length) {
      throw new BadRequestException('One or more items not found');
    }
    for (const it of items) {
      if (it.event_id !== eventId) {
        throw new BadRequestException(
          `Item ${it.id} does not belong to event ${eventId}`,
        );
      }
    }
  }
}
