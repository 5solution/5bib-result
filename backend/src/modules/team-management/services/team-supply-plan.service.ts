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
import { VolTeamCategory } from '../entities/vol-team-category.entity';
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
import { TeamRoleHierarchyService } from './team-role-hierarchy.service';

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
    @InjectRepository(VolTeamCategory, 'volunteer')
    private readonly categoryRepo: Repository<VolTeamCategory>,
    @InjectRepository(VolSupplyItem, 'volunteer')
    private readonly itemRepo: Repository<VolSupplyItem>,
    @InjectRepository(VolSupplyPlan, 'volunteer')
    private readonly planRepo: Repository<VolSupplyPlan>,
    @InjectRepository(VolSupplyAllocation, 'volunteer')
    private readonly allocRepo: Repository<VolSupplyAllocation>,
    private readonly cache: TeamCacheService,
    private readonly hierarchy: TeamRoleHierarchyService,
  ) {}

  /**
   * Return every item in the event + current plan row (if any) for the
   * role. Missing plans are returned with `requested_qty=0, fulfilled_qty=null`
   * so the UI can render a full table.
   */
  async getPlanForRole(
    eventId: number,
    categoryId: number,
  ): Promise<SupplyPlanRowDto[]> {
    const key = TeamCacheService.keySupplyPlan(eventId, categoryId);
    const hit = await this.cache.getJson<SupplyPlanRowDto[]>(key);
    if (hit) return hit;

    await this.assertEventCategory(eventId, categoryId);

    const items = await this.itemRepo.find({
      where: { event_id: eventId },
      order: { sort_order: 'ASC', id: 'ASC' },
    });
    if (items.length === 0) {
      await this.cache.setJson(key, [], CACHE_TTL.supplyPlan);
      return [];
    }

    const plans = await this.planRepo.find({
      where: { event_id: eventId, category_id: categoryId, item_id: In(items.map((i) => i.id)) },
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
    categoryId: number,
    dto: UpsertSupplyPlanRequestDto,
    actorRoleId: number | null,
  ): Promise<SupplyPlanRowDto[]> {
    // v1.8: when a leader is the actor, the target categoryId must be in
    // the set of categories covered by the BFS-resolved descendant roles.
    if (actorRoleId !== null) {
      const actorRole = await this.roleRepo.findOne({
        where: { id: actorRoleId },
      });
      if (!actorRole) {
        throw new ForbiddenException('Leader role not found');
      }
      if (!actorRole.is_leader_role) {
        throw new ForbiddenException('Actor is not a leader role');
      }
      const managedRoleSet = await this.hierarchy.resolveDescendantRoleIds(
        actorRoleId,
      );
      if (managedRoleSet.size === 0) {
        throw new BadRequestException(
          'Leader role chưa được cấu hình quản lý role nào. Liên hệ admin cấu hình "Quản lý role" trong Role.',
        );
      }
      const managedCategorySet = await this.resolveManagedCategoryIds(
        managedRoleSet,
      );
      if (!managedCategorySet.has(categoryId)) {
        throw new ForbiddenException(
          'Leader may only edit plan for categories in their managed hierarchy',
        );
      }
    }
    await this.assertEventCategory(eventId, categoryId);
    await this.assertItemsBelong(eventId, dto.items.map((i) => i.item_id));

    // v1.8 QC-FIX C-1: find-then-save race → 500 under concurrency.
    // MariaDB `INSERT ... ON DUPLICATE KEY UPDATE` (via TypeORM `.orUpdate`)
    // is atomic at row level — the UNIQUE `uq_plan_category_item` serializes
    // conflicting writers without throwing.
    if (dto.items.length > 0) {
      await this.dataSource.transaction(async (m) => {
        const planRepo = m.getRepository(VolSupplyPlan);
        const values = dto.items.map((entry) => ({
          event_id: eventId,
          category_id: categoryId,
          item_id: entry.item_id,
          requested_qty: entry.requested_qty,
          request_note: entry.request_note ?? null,
          // fulfilled_qty + fulfill_note omitted — leader path must not touch.
        }));
        await planRepo
          .createQueryBuilder()
          .insert()
          .into(VolSupplyPlan)
          .values(values)
          .orUpdate(
            ['requested_qty', 'request_note'],
            ['event_id', 'category_id', 'item_id'],
          )
          .execute();
      });
    }
    await this.cache.invalidateSupplyPlan(eventId, categoryId);
    this.logger.log(
      `[SUPPLY] plan.request event=${eventId} category=${categoryId} items=${dto.items.length} by=${actorRoleId ?? 'admin'}`,
    );
    return this.getPlanForRole(eventId, categoryId);
  }

  /** Admin fulfill upsert. Bulk sets fulfilled_qty + fulfill_note. */
  async upsertFulfill(
    eventId: number,
    categoryId: number,
    dto: UpsertSupplyPlanFulfillDto,
  ): Promise<SupplyPlanRowDto[]> {
    await this.assertEventCategory(eventId, categoryId);
    await this.assertItemsBelong(eventId, dto.items.map((i) => i.item_id));

    // v1.8 QC-FIX C-1: same atomic INSERT ON DUPLICATE KEY UPDATE as
    // upsertRequest. Admin fulfill may arrive before leader requested → the
    // insert sets requested_qty=0 default; existing row updates only
    // fulfilled_qty + fulfill_note (not the leader's requested_qty).
    if (dto.items.length > 0) {
      await this.dataSource.transaction(async (m) => {
        const planRepo = m.getRepository(VolSupplyPlan);
        const values = dto.items.map((entry) => ({
          event_id: eventId,
          category_id: categoryId,
          item_id: entry.item_id,
          requested_qty: 0,
          request_note: null,
          fulfilled_qty: entry.fulfilled_qty,
          fulfill_note: entry.fulfill_note ?? null,
        }));
        await planRepo
          .createQueryBuilder()
          .insert()
          .into(VolSupplyPlan)
          .values(values)
          .orUpdate(
            ['fulfilled_qty', 'fulfill_note'],
            ['event_id', 'category_id', 'item_id'],
          )
          .execute();
      });
    }
    await this.cache.invalidateSupplyPlan(eventId, categoryId);
    this.logger.log(
      `[SUPPLY] plan.fulfill event=${eventId} category=${categoryId} items=${dto.items.length}`,
    );
    return this.getPlanForRole(eventId, categoryId);
  }

  /**
   * Admin matrix: for each item × category, show plan (requested/fulfilled/gap)
   * + SUM(allocated) + SUM(confirmed) across all stations in that category.
   *
   * v1.8: grouped by team category, not role. DTO field names (`role_id`,
   * `roles`) are kept for backward compat with controllers — they'll be
   * renamed in the follow-up DTO fix.
   */
  async getEventOverview(eventId: number): Promise<EventSupplyOverviewDto> {
    const key = TeamCacheService.keySupplyOverview(eventId);
    const hit = await this.cache.getJson<EventSupplyOverviewDto>(key);
    if (hit) return hit;

    const [categories, items, plans] = await Promise.all([
      this.categoryRepo.find({
        where: { event_id: eventId },
        order: { sort_order: 'ASC', id: 'ASC' },
      }),
      this.itemRepo.find({
        where: { event_id: eventId },
        order: { sort_order: 'ASC', id: 'ASC' },
      }),
      this.planRepo.find({ where: { event_id: eventId } }),
    ]);

    // Aggregate allocation totals by (category_id, item_id) via one JOIN query.
    // vol_supply_allocation → vol_station.category_id.
    const allocTotals = await this.dataSource
      .getRepository(VolSupplyAllocation)
      .createQueryBuilder('a')
      .innerJoin('vol_station', 's', 's.id = a.station_id')
      .select('s.category_id', 'category_id')
      .addSelect('a.item_id', 'item_id')
      .addSelect('SUM(a.allocated_qty)', 'allocated_qty')
      .addSelect('SUM(COALESCE(a.confirmed_qty, 0))', 'confirmed_qty')
      .where('s.event_id = :eventId', { eventId })
      .groupBy('s.category_id')
      .addGroupBy('a.item_id')
      .getRawMany<{
        category_id: string;
        item_id: string;
        allocated_qty: string;
        confirmed_qty: string;
      }>();

    const allocByKey = new Map<string, { allocated: number; confirmed: number }>();
    for (const r of allocTotals) {
      allocByKey.set(`${r.category_id}:${r.item_id}`, {
        allocated: Number(r.allocated_qty) || 0,
        confirmed: Number(r.confirmed_qty) || 0,
      });
    }

    const planByKey = new Map(
      plans.map((p) => [`${p.category_id}:${p.item_id}`, p]),
    );

    const itemRows: SupplyOverviewItemRowDto[] = items.map((item) => {
      const cells: SupplyOverviewCellDto[] = categories.map((category) => {
        const k = `${category.id}:${item.id}`;
        const plan = planByKey.get(k);
        const alloc = allocByKey.get(k) ?? { allocated: 0, confirmed: 0 };
        return {
          // DTO field still named `role_id` for backward compat — value is category id (v1.8).
          role_id: category.id,
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
      // DTO field still named `roles`/`role_id`/`role_name` for backward compat — values are categories (v1.8).
      roles: categories.map((c) => ({ role_id: c.id, role_name: c.name })),
      items: itemRows,
    };
    await this.cache.setJson(key, overview, CACHE_TTL.supplyOverview);
    return overview;
  }

  private async assertEventCategory(eventId: number, categoryId: number): Promise<void> {
    const category = await this.categoryRepo.findOne({ where: { id: categoryId } });
    if (!category || category.event_id !== eventId) {
      throw new NotFoundException('Category not found in event');
    }
  }

  /**
   * v1.8: from a set of role ids, derive the set of team category ids
   * (distinct, non-null). Used by the leader authorization gate.
   */
  private async resolveManagedCategoryIds(
    managedRoleIds: Set<number>,
  ): Promise<Set<number>> {
    if (managedRoleIds.size === 0) return new Set();
    const roles = await this.roleRepo.find({
      where: { id: In(Array.from(managedRoleIds)) },
    });
    const catIds = new Set<number>();
    for (const r of roles) {
      if (r.category_id !== null && r.category_id !== undefined) {
        catIds.add(r.category_id);
      }
    }
    return catIds;
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
