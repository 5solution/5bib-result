import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { VolRole } from '../entities/vol-role.entity';
import { VolStation } from '../entities/vol-station.entity';
import { VolStationAssignment } from '../entities/vol-station-assignment.entity';
import { VolSupplyAllocation } from '../entities/vol-supply-allocation.entity';
import { VolSupplySupplement } from '../entities/vol-supply-supplement.entity';
import { VolRegistration } from '../entities/vol-registration.entity';
import { SupplementRowDto } from '../dto/supply.dto';
import { TeamCacheService } from './team-cache.service';
import { TeamSupplyAllocationService } from './team-supply-allocation.service';
import { TeamRoleHierarchyService } from './team-role-hierarchy.service';

/**
 * v1.6 Supplement service (OQ-D Option 2 — multi-round supplements).
 *
 * Each supplement = 1 row in vol_supply_supplement. round_number is
 * computed per-allocation as MAX(round_number)+1 inside the create txn.
 *
 * Flow:
 * 1. Leader creates supplement (allocation must already be is_locked=TRUE,
 *    i.e. round-1 already confirmed). confirmed_qty starts null.
 * 2. Crew (same station) confirms → confirmed_qty + confirmed_at + locked.
 *    "Locked" for supplements = once confirmed_qty is non-null, that row
 *    can't be re-confirmed (leader must create a new round).
 */
@Injectable()
export class TeamSupplySupplementService {
  private readonly logger = new Logger(TeamSupplySupplementService.name);

  constructor(
    @InjectDataSource('volunteer') private readonly dataSource: DataSource,
    @InjectRepository(VolSupplySupplement, 'volunteer')
    private readonly supRepo: Repository<VolSupplySupplement>,
    @InjectRepository(VolSupplyAllocation, 'volunteer')
    private readonly allocRepo: Repository<VolSupplyAllocation>,
    @InjectRepository(VolStation, 'volunteer')
    private readonly stationRepo: Repository<VolStation>,
    @InjectRepository(VolStationAssignment, 'volunteer')
    private readonly assignRepo: Repository<VolStationAssignment>,
    @InjectRepository(VolRegistration, 'volunteer')
    private readonly regRepo: Repository<VolRegistration>,
    @InjectRepository(VolRole, 'volunteer')
    private readonly roleRepo: Repository<VolRole>,
    private readonly cache: TeamCacheService,
    private readonly allocService: TeamSupplyAllocationService,
    private readonly hierarchy: TeamRoleHierarchyService,
  ) {}

  /** v1.8: BFS-resolved role set → distinct non-null category set. Null for admin. */
  private async resolveActorScopedCategoryIds(
    actorRoleId: number | null,
  ): Promise<Set<number> | null> {
    if (actorRoleId === null) return null;
    const role = await this.roleRepo.findOne({ where: { id: actorRoleId } });
    if (!role) throw new ForbiddenException('Actor role not found');
    if (!role.is_leader_role) {
      throw new ForbiddenException('Actor is not a leader role');
    }
    const managedRoles = await this.hierarchy.resolveDescendantRoleIds(actorRoleId);
    if (managedRoles.size === 0) {
      throw new BadRequestException(
        'Leader role chưa được cấu hình quản lý role nào. Liên hệ admin cấu hình "Quản lý role" trong Role.',
      );
    }
    const roles = await this.roleRepo.find({
      where: { id: In(Array.from(managedRoles)) },
    });
    const categoryIds = new Set<number>();
    for (const r of roles) {
      if (r.category_id !== null && r.category_id !== undefined) {
        categoryIds.add(r.category_id);
      }
    }
    return categoryIds;
  }

  async listSupplementsForAllocation(
    allocationId: number,
  ): Promise<SupplementRowDto[]> {
    const rows = await this.supRepo.find({
      where: { allocation_id: allocationId },
      relations: { confirmed_by_registration: true },
      order: { round_number: 'ASC' },
    });
    return rows.map((r) => this.toDto(r));
  }

  /**
   * Create a new supplement round on an allocation. Leader gate: their
   * role must match the station's role (Q7). Allocation must be
   * is_locked=TRUE (round-1 done). Admin (actorRoleId=null) bypasses role
   * check but still needs allocation to be locked — we treat the admin
   * path as a same-day top-up, not an override for an un-confirmed alloc.
   */
  async createSupplement(
    allocationId: number,
    qty: number,
    note: string | null,
    actorRoleId: number | null,
  ): Promise<SupplementRowDto> {
    if (qty <= 0) {
      throw new BadRequestException('qty must be > 0');
    }
    const alloc = await this.allocRepo.findOne({
      where: { id: allocationId },
      relations: { station: true },
    });
    if (!alloc || !alloc.station) {
      throw new NotFoundException('Allocation not found');
    }
    if (!alloc.is_locked) {
      throw new ConflictException(
        'Cannot create supplement: round-1 allocation has not been confirmed yet',
      );
    }
    // v1.8: station.category_id must be in BFS-derived managed category set.
    const scopedCategoryIds = await this.resolveActorScopedCategoryIds(actorRoleId);
    if (scopedCategoryIds !== null && !scopedCategoryIds.has(alloc.station.category_id)) {
      throw new ForbiddenException(
        'Leader may only supplement allocations for stations within their managed hierarchy',
      );
    }

    const created = await this.dataSource.transaction(async (m) => {
      const supRepo = m.getRepository(VolSupplySupplement);
      // Lock the latest round row so we compute round_number safely.
      const latest = await supRepo
        .createQueryBuilder('s')
        .setLock('pessimistic_write')
        .where('s.allocation_id = :aid', { aid: allocationId })
        .orderBy('s.round_number', 'DESC')
        .getOne();
      const nextRound = (latest?.round_number ?? 0) + 1;
      return supRepo.save(
        supRepo.create({
          allocation_id: allocationId,
          round_number: nextRound,
          qty,
          note,
          created_by_role_id: actorRoleId,
        }),
      );
    });

    await this.cache.invalidateStationAllocations(
      alloc.station_id,
      alloc.station.event_id,
    );
    this.logger.log(
      `[SUPPLY] supplement.create alloc=${allocationId} round=${created.round_number} qty=${qty} by=${actorRoleId ?? 'admin'}`,
    );
    return this.toDto(created);
  }

  /**
   * Crew confirms a supplement row. Must be assignment_role==='crew' and
   * station matches the supplement's allocation.station_id.
   */
  async confirmSupplement(
    token: string,
    supplementId: number,
    confirmedQty: number,
    confirmationNote: string | null,
  ): Promise<SupplementRowDto> {
    if (confirmedQty < 0) {
      throw new BadRequestException('confirmed_qty must be >= 0');
    }
    const reg = await this.allocService.validateCrewToken(token);
    const assignment = await this.assignRepo.findOne({
      where: { registration_id: reg.id },
      relations: { registration: { role: true } },
    });
    if (!assignment) {
      throw new ForbiddenException('You are not assigned to a station');
    }
    // v1.8: assignment_role field dropped. Supervisor-vs-worker derived
    // from registration.role.is_leader_role — leaders cannot confirm supply.
    if (assignment.registration?.role?.is_leader_role === true) {
      throw new ForbiddenException(
        'Only crew can confirm supply (BR-SUP-09)',
      );
    }

    const sup = await this.supRepo.findOne({
      where: { id: supplementId },
      relations: { allocation: { station: true } },
    });
    if (!sup || !sup.allocation) {
      throw new NotFoundException('Supplement not found');
    }
    if (sup.allocation.station_id !== assignment.station_id) {
      throw new ForbiddenException(
        'Supplement belongs to a different station',
      );
    }
    if (sup.confirmed_qty !== null) {
      throw new ConflictException(
        'Supplement already confirmed — leader must create a new round',
      );
    }

    sup.confirmed_qty = confirmedQty;
    sup.confirmed_at = new Date();
    sup.confirmed_by_registration_id = reg.id;
    sup.confirmation_note = confirmationNote;
    const saved = await this.supRepo.save(sup);

    await this.cache.invalidateStationAllocations(
      assignment.station_id,
      sup.allocation.station?.event_id,
    );
    this.logger.log(
      `[AUDIT][SUPPLY] supplement.confirm id=${supplementId} round=${sup.round_number} by_reg=${reg.id}`,
    );
    // Reload with relations for the DTO.
    const fresh = await this.supRepo.findOne({
      where: { id: saved.id },
      relations: { confirmed_by_registration: true },
    });
    return this.toDto(fresh ?? saved);
  }

  private toDto(row: VolSupplySupplement): SupplementRowDto {
    return {
      id: row.id,
      allocation_id: row.allocation_id,
      round_number: row.round_number,
      qty: row.qty,
      note: row.note,
      confirmed_qty: row.confirmed_qty,
      shortage_qty: row.shortage_qty,
      confirmed_at: row.confirmed_at ? row.confirmed_at.toISOString() : null,
      confirmed_by_name: row.confirmed_by_registration?.full_name ?? null,
      confirmed_by_phone: row.confirmed_by_registration?.phone ?? null,
      confirmation_note: row.confirmation_note,
      created_at: row.created_at.toISOString(),
    };
  }
}
