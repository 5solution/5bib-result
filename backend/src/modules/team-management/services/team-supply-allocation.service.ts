import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { VolRole } from '../entities/vol-role.entity';
import { VolStation } from '../entities/vol-station.entity';
import { VolStationAssignment } from '../entities/vol-station-assignment.entity';
import { VolSupplyAllocation } from '../entities/vol-supply-allocation.entity';
import { VolSupplyItem } from '../entities/vol-supply-item.entity';
import { VolSupplyPlan } from '../entities/vol-supply-plan.entity';
import { VolRegistration } from '../entities/vol-registration.entity';
import {
  AllocationRowDto,
  ConfirmSupplyDto,
  UpsertAllocationDto,
  UnlockAllocationDto,
} from '../dto/supply.dto';
import { TeamCacheService, CACHE_TTL } from './team-cache.service';
import { TeamRoleHierarchyService } from './team-role-hierarchy.service';

/**
 * v1.6 Supply Allocation service.
 *
 * Invariants:
 * 1. `SUM(allocated_qty)` across all stations of a role × item must NOT
 *    exceed `vol_supply_plan.fulfilled_qty` (BR-SUP-04). Enforced inside
 *    a transaction with a pessimistic lock on the plan row.
 * 2. After a crew member confirms receipt (confirmSupply), is_locked=TRUE
 *    and further leader edits are rejected until admin unlocks.
 * 3. Crew confirm requires assignment.assignment_role === 'crew' (BR-SUP-09).
 */
@Injectable()
export class TeamSupplyAllocationService {
  private readonly logger = new Logger(TeamSupplyAllocationService.name);

  constructor(
    @InjectDataSource('volunteer') private readonly dataSource: DataSource,
    @InjectRepository(VolStation, 'volunteer')
    private readonly stationRepo: Repository<VolStation>,
    @InjectRepository(VolStationAssignment, 'volunteer')
    private readonly assignRepo: Repository<VolStationAssignment>,
    @InjectRepository(VolSupplyAllocation, 'volunteer')
    private readonly allocRepo: Repository<VolSupplyAllocation>,
    @InjectRepository(VolSupplyItem, 'volunteer')
    private readonly itemRepo: Repository<VolSupplyItem>,
    @InjectRepository(VolRegistration, 'volunteer')
    private readonly regRepo: Repository<VolRegistration>,
    @InjectRepository(VolRole, 'volunteer')
    private readonly roleRepo: Repository<VolRole>,
    private readonly cache: TeamCacheService,
    private readonly hierarchy: TeamRoleHierarchyService,
  ) {}

  /**
   * v1.6 Option B2: resolve the full Set of role_ids a leader actor is
   * authorized to touch (nested descendants via BFS). Returns null for
   * admin (actorRoleId === null). Throws 400 for misconfigured leader
   * (empty managed set) or 403 for non-leader actor.
   */
  private async resolveActorScopedRoleIds(
    actorRoleId: number | null,
  ): Promise<Set<number> | null> {
    if (actorRoleId === null) return null;
    const role = await this.roleRepo.findOne({ where: { id: actorRoleId } });
    if (!role) throw new ForbiddenException('Actor role not found');
    if (!role.is_leader_role) {
      throw new ForbiddenException('Actor is not a leader role');
    }
    const managed = await this.hierarchy.resolveDescendantRoleIds(actorRoleId);
    if (managed.size === 0) {
      throw new BadRequestException(
        'Leader role chưa được cấu hình quản lý role nào. Liên hệ admin cấu hình "Quản lý role" trong Role.',
      );
    }
    return managed;
  }

  /** List all allocations for a station + the underlying item names. TTL 30s. */
  async getAllocationsForStation(stationId: number): Promise<AllocationRowDto[]> {
    const key = TeamCacheService.keyStationAllocations(stationId);
    const hit = await this.cache.getJson<AllocationRowDto[]>(key);
    if (hit) return hit;

    const station = await this.stationRepo.findOne({ where: { id: stationId } });
    if (!station) throw new NotFoundException('Station not found');

    const rows = await this.allocRepo.find({
      where: { station_id: stationId },
      relations: { item: true, confirmed_by_registration: true },
      order: { id: 'ASC' },
    });
    const dtos = rows.map((r) => this.toAllocationRow(r));
    await this.cache.setJson(key, dtos, CACHE_TTL.stationAllocations);
    return dtos;
  }

  /**
   * Leader or admin upserts allocations for one station.
   *
   * Gates:
   *  - Leader (actorRoleId !== null) must match station.role_id.
   *  - For each item, SUM(allocated_qty) across stations in the role must
   *    not exceed plan.fulfilled_qty.
   *  - Row-level: cannot edit a row where is_locked === true.
   *  - Optimistic concurrency: if client supplies updated_at older than
   *    what's in DB → 409.
   */
  async upsertAllocationsForStation(
    stationId: number,
    dto: UpsertAllocationDto,
    actorRoleId: number | null,
  ): Promise<AllocationRowDto[]> {
    const station = await this.stationRepo.findOne({ where: { id: stationId } });
    if (!station) throw new NotFoundException('Station not found');

    // v1.6 Option B2: leader gate — station.role_id must be in the
    // BFS-resolved managed set. Admin (null) bypasses.
    const scopedRoleIds = await this.resolveActorScopedRoleIds(actorRoleId);
    if (scopedRoleIds !== null && !scopedRoleIds.has(station.role_id)) {
      throw new ForbiddenException(
        'Leader may only edit allocations for stations within their managed hierarchy',
      );
    }
    // Duplicate-item-in-payload guard.
    const itemIds = dto.allocations.map((a) => a.item_id);
    if (new Set(itemIds).size !== itemIds.length) {
      throw new BadRequestException(
        'Duplicate item_id in allocations payload',
      );
    }

    // Verify items belong to the event.
    if (itemIds.length > 0) {
      const items = await this.itemRepo.find({ where: { id: In(itemIds) } });
      if (items.length !== itemIds.length) {
        throw new BadRequestException('One or more items not found');
      }
      for (const it of items) {
        if (it.event_id !== station.event_id) {
          throw new BadRequestException(
            `Item ${it.id} does not belong to this event`,
          );
        }
      }
    }

    await this.dataSource.transaction(async (m) => {
      const allocRepo = m.getRepository(VolSupplyAllocation);
      const planRepo = m.getRepository(VolSupplyPlan);

      for (const entry of dto.allocations) {
        // Pessimistic lock on plan row for (role, item) — blocks concurrent
        // allocation writers against the same pool.
        const plan = await planRepo
          .createQueryBuilder('p')
          .setLock('pessimistic_write')
          .where(
            'p.role_id = :roleId AND p.item_id = :itemId',
            { roleId: station.role_id, itemId: entry.item_id },
          )
          .getOne();

        const fulfilled = plan?.fulfilled_qty ?? 0;

        // Existing allocation row for this station, locked for update.
        const existing = await allocRepo
          .createQueryBuilder('a')
          .setLock('pessimistic_write')
          .where(
            'a.station_id = :sid AND a.item_id = :iid',
            { sid: stationId, iid: entry.item_id },
          )
          .getOne();

        if (existing) {
          // Optimistic concurrency check — if caller passed a timestamp and
          // it's older than the stored row, someone else just mutated it.
          if (dto.optimistic_updated_at) {
            const serverTs = existing.updated_at.getTime();
            const clientTs = new Date(dto.optimistic_updated_at).getTime();
            if (Number.isFinite(clientTs) && serverTs > clientTs) {
              throw new ConflictException(
                'Allocation has been modified since you loaded it — reload and retry',
              );
            }
          }
          if (existing.is_locked) {
            throw new ConflictException(
              `Allocation ${existing.id} is locked (crew already confirmed). Admin must unlock first.`,
            );
          }
        }

        // Compute SUM across OTHER stations in the same role + new value,
        // then compare to fulfilled_qty.
        const otherTotalRaw = await allocRepo
          .createQueryBuilder('a')
          .innerJoin('vol_station', 's', 's.id = a.station_id')
          .select('COALESCE(SUM(a.allocated_qty), 0)', 'total')
          .where('s.role_id = :roleId', { roleId: station.role_id })
          .andWhere('a.item_id = :iid', { iid: entry.item_id })
          .andWhere('a.station_id != :sid', { sid: stationId })
          .getRawOne<{ total: string }>();
        const otherTotal = Number(otherTotalRaw?.total ?? 0);
        const prospective = otherTotal + entry.allocated_qty;

        if (fulfilled > 0 && prospective > fulfilled) {
          throw new BadRequestException(
            `Allocation exceeds fulfilled pool for item ${entry.item_id}: ` +
              `prospective=${prospective}, fulfilled=${fulfilled}`,
          );
        }
        // If there's no plan or fulfilled=0, still allow 0-value writes but
        // reject >0 (nothing to allocate from).
        if ((!plan || fulfilled === 0) && entry.allocated_qty > 0) {
          throw new BadRequestException(
            `Cannot allocate item ${entry.item_id}: admin has not fulfilled any quantity for role ${station.role_id}`,
          );
        }

        if (existing) {
          existing.allocated_qty = entry.allocated_qty;
          await allocRepo.save(existing);
        } else {
          await allocRepo.save(
            allocRepo.create({
              station_id: stationId,
              item_id: entry.item_id,
              allocated_qty: entry.allocated_qty,
            }),
          );
        }
      }
    });

    await this.cache.invalidateStationAllocations(stationId, station.event_id);
    this.logger.log(
      `[SUPPLY] alloc.upsert station=${stationId} items=${dto.allocations.length} by=${actorRoleId ?? 'admin'}`,
    );
    return this.getAllocationsForStation(stationId);
  }

  /**
   * Crew confirms receipt. Token must belong to a registration that is:
   *  - assigned to the allocation's station, AND
   *  - assignment_role === 'crew' (BR-SUP-09)
   *
   * Each matched allocation is set to confirmed_qty + is_locked=TRUE.
   * If already locked (previously confirmed), rejects — admin must unlock.
   */
  async confirmSupply(
    token: string,
    dto: ConfirmSupplyDto,
  ): Promise<AllocationRowDto[]> {
    const reg = await this.validateCrewToken(token);
    const assignment = await this.assignRepo.findOne({
      where: { registration_id: reg.id },
      relations: { station: true },
    });
    if (!assignment || !assignment.station) {
      throw new ForbiddenException('You are not assigned to a station');
    }
    if (assignment.assignment_role !== 'crew') {
      throw new ForbiddenException(
        'Only crew can confirm supply (BR-SUP-09)',
      );
    }
    const stationId = assignment.station_id;

    const itemIds = dto.receipts.map((r) => r.item_id);
    if (new Set(itemIds).size !== itemIds.length) {
      throw new BadRequestException('Duplicate item_id in receipts payload');
    }

    await this.dataSource.transaction(async (m) => {
      const allocRepo = m.getRepository(VolSupplyAllocation);
      for (const entry of dto.receipts) {
        const row = await allocRepo
          .createQueryBuilder('a')
          .setLock('pessimistic_write')
          .where('a.station_id = :sid AND a.item_id = :iid', {
            sid: stationId,
            iid: entry.item_id,
          })
          .getOne();
        if (!row) {
          throw new NotFoundException(
            `No allocation for item ${entry.item_id} at this station`,
          );
        }
        if (row.is_locked) {
          throw new ConflictException(
            `Allocation ${row.id} already confirmed — admin must unlock to re-confirm`,
          );
        }
        row.confirmed_qty = entry.confirmed_qty;
        row.confirmed_at = new Date();
        row.confirmed_by_registration_id = reg.id;
        row.confirmation_note = dto.note ?? null;
        row.is_locked = true;
        await allocRepo.save(row);
      }
    });

    await this.cache.invalidateStationAllocations(
      stationId,
      assignment.station.event_id,
    );
    this.logger.log(
      `[AUDIT][SUPPLY] alloc.confirm station=${stationId} by_reg=${reg.id} items=${dto.receipts.length}`,
    );
    return this.getAllocationsForStation(stationId);
  }

  /**
   * Admin unlocks an allocation row to permit edits. admin_note is
   * required for audit. Does NOT clear confirmed_qty/confirmed_by — those
   * remain as history. Next upsert overwrites allocated_qty; next crew
   * confirm re-locks.
   */
  async unlockAllocation(
    id: number,
    adminId: string,
    dto: UnlockAllocationDto,
  ): Promise<AllocationRowDto> {
    const row = await this.allocRepo.findOne({
      where: { id },
      relations: { station: true },
    });
    if (!row) throw new NotFoundException('Allocation not found');
    if (!row.is_locked) {
      throw new BadRequestException('Allocation is not locked');
    }
    row.is_locked = false;
    row.unlocked_by_admin_id = adminId;
    row.unlocked_at = new Date();
    row.unlock_note = dto.admin_note;
    const saved = await this.allocRepo.save(row);

    await this.cache.invalidateStationAllocations(
      row.station_id,
      row.station?.event_id,
    );
    this.logger.log(
      `[AUDIT][SUPPLY] alloc.unlock id=${id} by_admin=${adminId} note="${dto.admin_note}"`,
    );
    return this.toAllocationRow(saved);
  }

  // ---- helpers ----

  async validateCrewToken(token: string): Promise<VolRegistration> {
    if (!token || token.length < 10) {
      throw new UnauthorizedException('Invalid token');
    }
    const reg = await this.regRepo.findOne({
      where: { magic_token: token },
      relations: { event: true, role: true },
    });
    if (!reg) throw new UnauthorizedException('Token not found');
    if (reg.magic_token_expires && reg.magic_token_expires.getTime() < Date.now()) {
      throw new UnauthorizedException('Token expired');
    }
    return reg;
  }

  private toAllocationRow(row: VolSupplyAllocation): AllocationRowDto {
    return {
      id: row.id,
      station_id: row.station_id,
      item_id: row.item_id,
      item_name: row.item?.item_name ?? '',
      unit: row.item?.unit ?? '',
      allocated_qty: row.allocated_qty,
      confirmed_qty: row.confirmed_qty,
      shortage_qty: row.shortage_qty,
      is_locked: row.is_locked,
      confirmed_at: row.confirmed_at ? row.confirmed_at.toISOString() : null,
      confirmation_note: row.confirmation_note,
      confirmed_by: row.confirmed_by_registration
        ? {
            name: row.confirmed_by_registration.full_name ?? null,
            phone: row.confirmed_by_registration.phone ?? null,
          }
        : null,
      updated_at: row.updated_at.toISOString(),
    };
  }
}
