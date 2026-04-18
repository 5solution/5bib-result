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
import { VolSupplyAllocation } from '../entities/vol-supply-allocation.entity';
import { VolSupplyItem } from '../entities/vol-supply-item.entity';
import { VolSupplyPlan } from '../entities/vol-supply-plan.entity';
import { VolSupplySupplement } from '../entities/vol-supply-supplement.entity';
import {
  LeaderStationAllocationDto,
  LeaderSupplyItemViewDto,
  LeaderSupplyViewDto,
  SupplementRowDto,
} from '../dto/supply.dto';

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
    @InjectRepository(VolStation, 'volunteer')
    private readonly stationRepo: Repository<VolStation>,
    @InjectRepository(VolSupplyItem, 'volunteer')
    private readonly itemRepo: Repository<VolSupplyItem>,
    @InjectRepository(VolSupplyPlan, 'volunteer')
    private readonly planRepo: Repository<VolSupplyPlan>,
    @InjectRepository(VolSupplyAllocation, 'volunteer')
    private readonly allocRepo: Repository<VolSupplyAllocation>,
    @InjectRepository(VolSupplySupplement, 'volunteer')
    private readonly supRepo: Repository<VolSupplySupplement>,
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
   * v1.6 Option A: resolve the role this leader manages.
   *  - Leader role must be is_leader_role=true (caller already verified via
   *    validateLeaderToken, but re-assert for defensive depth).
   *  - manages_role_id must be set; otherwise this leader has no managed
   *    team and all downstream queries would be empty + confusing.
   *  - Returns the managed role_id (not self). Non-leader callers throw 403.
   */
  resolveManagedRoleId(leaderReg: VolRegistration): number {
    if (!leaderReg.role?.is_leader_role) {
      throw new ForbiddenException('Yêu cầu leader role');
    }
    const managed = leaderReg.role.manages_role_id;
    if (!managed) {
      throw new BadRequestException(
        'Leader role chưa được cấu hình quản lý role nào. Liên hệ admin cấu hình "Quản lý role" trong Role.',
      );
    }
    return managed;
  }

  async getLeaderSupplyView(token: string): Promise<LeaderSupplyViewDto> {
    const leader = await this.validateLeaderToken(token);
    const eventId = leader.event_id;
    // v1.6 Option A: query supply/stations for the MANAGED role, not the
    // leader's own role. 400 if manages_role_id is not configured.
    const roleId = this.resolveManagedRoleId(leader);
    const managedRole = await this.roleRepo.findOne({ where: { id: roleId } });
    const managedRoleName = managedRole?.role_name ?? leader.role?.role_name ?? '';

    const [plans, stations, items] = await Promise.all([
      this.planRepo.find({ where: { event_id: eventId, role_id: roleId } }),
      this.stationRepo.find({
        where: { event_id: eventId, role_id: roleId },
        order: { sort_order: 'ASC', id: 'ASC' },
      }),
      this.itemRepo.find({
        where: { event_id: eventId },
        order: { sort_order: 'ASC', id: 'ASC' },
      }),
    ]);

    const stationIds = stations.map((s) => s.id);
    const allocations =
      stationIds.length === 0
        ? []
        : await this.allocRepo.find({
            where: { station_id: In(stationIds) },
            relations: { confirmed_by_registration: true },
          });

    // Items to include: those with a plan in this role OR an allocation in
    // any station of this role.
    const relevantItemIds = new Set<number>([
      ...plans.map((p) => p.item_id),
      ...allocations.map((a) => a.item_id),
    ]);
    const itemsInView = items.filter((it) => relevantItemIds.has(it.id));

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

    return {
      event_id: eventId,
      role_id: roleId,
      role_name: managedRoleName,
      managed_role_name: managedRoleName,
      items: itemViews,
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
