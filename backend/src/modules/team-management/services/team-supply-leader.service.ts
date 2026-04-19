import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { VolRegistration } from '../entities/vol-registration.entity';
import { VolRole } from '../entities/vol-role.entity';
import { VolStation } from '../entities/vol-station.entity';
import { VolStationAssignment } from '../entities/vol-station-assignment.entity';
import { VolTeamCategory } from '../entities/vol-team-category.entity';
import { VolSupplyAllocation } from '../entities/vol-supply-allocation.entity';
import { VolSupplyItem } from '../entities/vol-supply-item.entity';
import { VolSupplyPlan } from '../entities/vol-supply-plan.entity';
import { VolSupplySupplement } from '../entities/vol-supply-supplement.entity';
import {
  LeaderStationAllocationDto,
  LeaderStationBriefDto,
  LeaderSupplyItemViewDto,
  LeaderSupplyViewDto,
  SupplementRowDto,
} from '../dto/supply.dto';
import { TeamRoleHierarchyService } from './team-role-hierarchy.service';

/**
 * v1.6 OQ-B Leader Supply View.
 *
 * Returns a combined view for a leader — every item in the event that has
 * a plan OR an allocation under this leader's role, with per-station
 * breakdown (allocation + confirmation state + crew contact + supplements).
 */
@Injectable()
export class TeamSupplyLeaderService {
  constructor(
    @InjectRepository(VolRegistration, 'volunteer')
    private readonly regRepo: Repository<VolRegistration>,
    @InjectRepository(VolRole, 'volunteer')
    private readonly roleRepo: Repository<VolRole>,
    @InjectRepository(VolTeamCategory, 'volunteer')
    private readonly categoryRepo: Repository<VolTeamCategory>,
    @InjectRepository(VolStation, 'volunteer')
    private readonly stationRepo: Repository<VolStation>,
    @InjectRepository(VolStationAssignment, 'volunteer')
    private readonly assignmentRepo: Repository<VolStationAssignment>,
    @InjectRepository(VolSupplyItem, 'volunteer')
    private readonly itemRepo: Repository<VolSupplyItem>,
    @InjectRepository(VolSupplyPlan, 'volunteer')
    private readonly planRepo: Repository<VolSupplyPlan>,
    @InjectRepository(VolSupplyAllocation, 'volunteer')
    private readonly allocRepo: Repository<VolSupplyAllocation>,
    @InjectRepository(VolSupplySupplement, 'volunteer')
    private readonly supRepo: Repository<VolSupplySupplement>,
    private readonly hierarchy: TeamRoleHierarchyService,
  ) {}

  /**
   * Token → leader registration. Gate: role.is_leader_role must be true.
   * Returns the leader's registration (caller uses event_id + role_id).
   */
  async validateLeaderToken(token: string): Promise<VolRegistration> {
    if (!token || token.length < 10) {
      throw new UnauthorizedException('Invalid token');
    }
    const reg = await this.regRepo.findOne({
      where: { magic_token: token },
      relations: { role: true, event: true },
    });
    if (!reg) throw new UnauthorizedException('Token not found');
    if (!reg.role?.is_leader_role) {
      throw new ForbiddenException('This token is not a leader token');
    }
    return reg;
  }

  /**
   * v1.6 Option B2: resolve every role this leader has authority over,
   * including nested descendants via BFS.
   *  - Leader role must be is_leader_role=true.
   *  - Junction must have ≥1 row; otherwise 400 (leader not configured).
   *  - Returns a Set of role IDs (does NOT include leader's own role).
   */
  async resolveManagedRoleIds(leaderReg: VolRegistration): Promise<Set<number>> {
    if (!leaderReg.role?.is_leader_role) {
      throw new ForbiddenException('Yêu cầu leader role');
    }
    const managed = await this.hierarchy.resolveDescendantRoleIds(
      leaderReg.role_id,
    );
    if (managed.size === 0) {
      throw new BadRequestException(
        'Leader role chưa được cấu hình quản lý role nào. Liên hệ admin cấu hình "Quản lý role" trong Role.',
      );
    }
    return managed;
  }

  /**
   * v1.8 — derive managed category IDs from managed role set. Public
   * controller uses this to validate `target_category_id`. Empty set means
   * the leader's hierarchy doesn't span any team (all managed roles are
   * floaters) — caller should 400 in that case.
   */
  async resolveManagedCategoryIds(
    leaderReg: VolRegistration,
  ): Promise<Set<number>> {
    const roleIds = await this.resolveManagedRoleIds(leaderReg);
    if (roleIds.size === 0) return new Set();
    const roles = await this.roleRepo.find({
      where: { id: In(Array.from(roleIds)) },
    });
    const categoryIds = new Set<number>();
    for (const r of roles) {
      if (r.category_id !== null && r.category_id !== undefined) {
        categoryIds.add(r.category_id);
      }
    }
    return categoryIds;
  }

  async getLeaderSupplyView(token: string): Promise<LeaderSupplyViewDto> {
    const leader = await this.validateLeaderToken(token);
    const eventId = leader.event_id;
    // v1.6 Option B2: query supply/stations for ALL managed roles (nested).
    const managedRoleSet = await this.resolveManagedRoleIds(leader);
    const managedRoleIds = Array.from(managedRoleSet);
    const managedRoles = await this.roleRepo.find({
      where: { id: In(managedRoleIds) },
      order: { sort_order: 'ASC', id: 'ASC' },
    });
    const managedRoleNames = managedRoles.map((r) => r.role_name);

    // v1.8: derive managed categories from the roles' category_id (distinct non-null).
    const managedCategoryIdSet = new Set<number>();
    for (const r of managedRoles) {
      if (r.category_id !== null && r.category_id !== undefined) {
        managedCategoryIdSet.add(r.category_id);
      }
    }
    const managedCategoryIds = Array.from(managedCategoryIdSet);
    const managedCategories =
      managedCategoryIds.length === 0
        ? []
        : await this.categoryRepo.find({
            where: { id: In(managedCategoryIds) },
            order: { sort_order: 'ASC', id: 'ASC' },
          });
    const managedCategoryNames = managedCategories.map((c) => c.name);

    // Deprecated role_id/role_name kept for backward compat.
    // Must reflect the LEADER's own role, NOT a managed (subordinate) role.
    const firstRoleId = leader.role_id;
    const firstRoleName = leader.role?.role_name ?? '';

    const [plans, stations, items] = await Promise.all([
      managedCategoryIds.length === 0
        ? Promise.resolve([])
        : this.planRepo.find({
            where: { event_id: eventId, category_id: In(managedCategoryIds) },
          }),
      managedCategoryIds.length === 0
        ? Promise.resolve([])
        : this.stationRepo.find({
            where: { event_id: eventId, category_id: In(managedCategoryIds) },
            relations: { category: true },
            order: { sort_order: 'ASC', id: 'ASC' },
          }),
      this.itemRepo.find({
        where: { event_id: eventId },
        order: { sort_order: 'ASC', id: 'ASC' },
      }),
    ]);

    const stationIds = stations.map((s) => s.id);
    const [allocations, assignmentCounts] = await Promise.all([
      stationIds.length === 0
        ? Promise.resolve<VolSupplyAllocation[]>([])
        : this.allocRepo.find({
            where: { station_id: In(stationIds) },
            relations: { confirmed_by_registration: true },
          }),
      stationIds.length === 0
        ? Promise.resolve<Array<{ station_id: number; cnt: string }>>([])
        : this.assignmentRepo
            .createQueryBuilder('a')
            .select('a.station_id', 'station_id')
            .addSelect('COUNT(a.id)', 'cnt')
            .where('a.station_id IN (:...ids)', { ids: stationIds })
            .groupBy('a.station_id')
            .getRawMany<{ station_id: number; cnt: string }>(),
    ]);

    // v1.8.1 FIX — leader view phải thấy TOÀN BỘ supply items của event,
    // kể cả item chưa có plan/allocation, để leader có thể initiate
    // request. Trước đây filter by plans+allocations làm leader thấy
    // items=[] khi admin chưa pre-create plan → không thể order.
    const itemsInView = items;

    // Pre-load supplements for all allocation ids.
    const allocIds = allocations.map((a) => a.id);
    const supplements =
      allocIds.length === 0
        ? []
        : await this.supRepo.find({
            where: { allocation_id: In(allocIds) },
            relations: { confirmed_by_registration: true },
            order: { round_number: 'ASC' },
          });
    const supByAlloc = new Map<number, VolSupplySupplement[]>();
    for (const s of supplements) {
      const bucket = supByAlloc.get(s.allocation_id) ?? [];
      bucket.push(s);
      supByAlloc.set(s.allocation_id, bucket);
    }

    const stationById = new Map(stations.map((s) => [s.id, s]));
    const planByItem = new Map(plans.map((p) => [p.item_id, p]));

    const itemViews: LeaderSupplyItemViewDto[] = itemsInView.map((item) => {
      const plan = planByItem.get(item.id);
      const stationRows: LeaderStationAllocationDto[] = allocations
        .filter((a) => a.item_id === item.id)
        .map((a) => this.toStationAllocation(a, stationById, supByAlloc));
      return {
        item_id: item.id,
        item_name: item.item_name,
        unit: item.unit,
        requested_qty: plan?.requested_qty ?? 0,
        fulfilled_qty: plan?.fulfilled_qty ?? null,
        gap_qty: plan?.gap_qty ?? null,
        request_note: plan?.request_note ?? null,
        fulfill_note: plan?.fulfill_note ?? null,
        stations: stationRows,
      };
    });

    const assignmentCountByStation = new Map<number, number>();
    for (const row of assignmentCounts) {
      assignmentCountByStation.set(Number(row.station_id), Number(row.cnt));
    }

    const stationBriefs: LeaderStationBriefDto[] = stations.map((st) => {
      const gps_lat = st.gps_lat;
      const gps_lng = st.gps_lng;
      return {
        id: st.id,
        station_name: st.station_name,
        category_id: st.category_id,
        category_name: st.category?.name ?? null,
        category_color: st.category?.color ?? null,
        location_description: st.location_description,
        gps_lat,
        gps_lng,
        google_maps_url:
          gps_lat && gps_lng
            ? `https://www.google.com/maps?q=${gps_lat},${gps_lng}`
            : null,
        status: st.status,
        sort_order: st.sort_order,
        assignment_count: assignmentCountByStation.get(st.id) ?? 0,
      };
    });

    return {
      event_id: eventId,
      role_id: firstRoleId,
      role_name: firstRoleName,
      managed_role_ids: managedRoleIds,
      managed_role_names: managedRoleNames,
      managed_category_ids: managedCategoryIds,
      managed_category_names: managedCategoryNames,
      items: itemViews,
      stations: stationBriefs,
    };
  }

  private toStationAllocation(
    a: VolSupplyAllocation,
    stationById: Map<number, VolStation>,
    supByAlloc: Map<number, VolSupplySupplement[]>,
  ): LeaderStationAllocationDto {
    const st = stationById.get(a.station_id);
    const sups = supByAlloc.get(a.id) ?? [];
    const supDtos: SupplementRowDto[] = sups.map((s) => ({
      id: s.id,
      allocation_id: s.allocation_id,
      round_number: s.round_number,
      qty: s.qty,
      note: s.note,
      confirmed_qty: s.confirmed_qty,
      shortage_qty: s.shortage_qty,
      confirmed_at: s.confirmed_at ? s.confirmed_at.toISOString() : null,
      confirmed_by_name: s.confirmed_by_registration?.full_name ?? null,
      confirmed_by_phone: s.confirmed_by_registration?.phone ?? null,
      confirmation_note: s.confirmation_note,
      created_at: s.created_at.toISOString(),
    }));
    return {
      allocation_id: a.id,
      station_id: a.station_id,
      station_name: st?.station_name ?? '',
      allocated_qty: a.allocated_qty,
      confirmed_qty: a.confirmed_qty,
      shortage_qty: a.shortage_qty,
      is_locked: a.is_locked,
      confirmed_at: a.confirmed_at ? a.confirmed_at.toISOString() : null,
      confirmation_note: a.confirmation_note,
      confirmed_by: a.confirmed_by_registration
        ? {
            name: a.confirmed_by_registration.full_name ?? null,
            phone: a.confirmed_by_registration.phone ?? null,
          }
        : null,
      supplements: supDtos,
    };
  }
}
