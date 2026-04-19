import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VolRole } from '../entities/vol-role.entity';
import { VolSupplyItem } from '../entities/vol-supply-item.entity';
import { VolSupplyPlan } from '../entities/vol-supply-plan.entity';
import { VolSupplyAllocation } from '../entities/vol-supply-allocation.entity';
import {
  CreateSupplyItemDto,
  SupplyItemDto,
  UpdateSupplyItemDto,
} from '../dto/supply.dto';
import { TeamCacheService, CACHE_TTL } from './team-cache.service';
import { TeamRoleHierarchyService } from './team-role-hierarchy.service';

/**
 * v1.6 Supply Items service.
 *
 * Ownership model (Danny Q4 + Q7):
 *  - created_by_role_id = null   → admin-owned, any admin can edit.
 *  - created_by_role_id = <roleId> → owned by that role's leader. Only
 *    that leader (or any admin) can edit/delete.
 *
 * All mutations invalidate `supply-items` + `supply-overview` cache for
 * the event.
 */
@Injectable()
export class TeamSupplyItemService {
  private readonly logger = new Logger(TeamSupplyItemService.name);

  constructor(
    @InjectRepository(VolSupplyItem, 'volunteer')
    private readonly itemRepo: Repository<VolSupplyItem>,
    @InjectRepository(VolSupplyPlan, 'volunteer')
    private readonly planRepo: Repository<VolSupplyPlan>,
    @InjectRepository(VolSupplyAllocation, 'volunteer')
    private readonly allocRepo: Repository<VolSupplyAllocation>,
    @InjectRepository(VolRole, 'volunteer')
    private readonly roleRepo: Repository<VolRole>,
    private readonly cache: TeamCacheService,
    private readonly hierarchy: TeamRoleHierarchyService,
  ) {}

  /**
   * v1.6 Option B2: validate the actor is a leader + has ≥1 managed role.
   * Unlike allocation/plan/supplement, the item service needs BOTH:
   *   - the leader's own role_id (for `created_by_role_id` ownership), and
   *   - the managed set (for edit gate — leader A can edit items created by
   *     leader B if B is in A's descendants).
   * Returns { ownerRoleId, managed } for leader, or null for admin.
   */
  private async resolveActorContext(
    actorRoleId: number | null,
  ): Promise<{ ownerRoleId: number; managed: Set<number> } | null> {
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
    return { ownerRoleId: actorRoleId, managed };
  }

  /** Admin + leader both see the same list. TTL 300s. */
  async listItems(eventId: number): Promise<SupplyItemDto[]> {
    const key = TeamCacheService.keySupplyItems(eventId);
    const hit = await this.cache.getJson<SupplyItemDto[]>(key);
    if (hit) return hit;

    const rows = await this.itemRepo.find({
      where: { event_id: eventId },
      order: { sort_order: 'ASC', id: 'ASC' },
    });
    const dtos = rows.map((r) => this.toDto(r));
    await this.cache.setJson(key, dtos, CACHE_TTL.supplyItems);
    return dtos;
  }

  /**
   * Create an item. `actorRoleId` is the role_id of the leader making the
   * call (or null for admin). The admin path MAY set `created_by_role_id`
   * explicitly (eg. to preassign ownership), leader path ALWAYS pins to
   * actorRoleId to prevent spoofing.
   */
  async createItem(
    eventId: number,
    dto: CreateSupplyItemDto,
    actorRoleId: number | null,
  ): Promise<SupplyItemDto> {
    const itemName = dto.item_name.trim();
    if (!itemName) {
      throw new BadRequestException('item_name is required');
    }
    // Detect duplicates up front — UNIQUE(event_id, item_name) would
    // otherwise surface as a cryptic DB error.
    const existing = await this.itemRepo.findOne({
      where: { event_id: eventId, item_name: itemName },
    });
    if (existing) {
      throw new ConflictException(`Item "${itemName}" already exists for this event`);
    }

    // v1.6 Option B2 — leader path: ownership is the LEADER's own role_id
    // (not a managed role, because multi-select means there's no single
    // "managed" choice). Admin path: honor the DTO.
    const ctx = await this.resolveActorContext(actorRoleId);
    const createdByRoleId =
      ctx !== null ? ctx.ownerRoleId : dto.created_by_role_id ?? null;

    const row = this.itemRepo.create({
      event_id: eventId,
      item_name: itemName,
      unit: dto.unit.trim(),
      sort_order: dto.sort_order ?? 0,
      created_by_role_id: createdByRoleId,
    });
    const saved = await this.itemRepo.save(row);
    await this.cache.invalidateSupplyItems(eventId);
    this.logger.log(
      `[SUPPLY] item.create event=${eventId} id=${saved.id} name="${itemName}" by=${actorRoleId ?? 'admin'}`,
    );
    return this.toDto(saved);
  }

  /** Admin (actorRoleId === null) can edit any; leader may edit items
   * created by themselves OR by any descendant leader in their managed
   * hierarchy (v1.6 Option B2 — nested ownership). */
  async updateItem(
    id: number,
    dto: UpdateSupplyItemDto,
    actorRoleId: number | null,
  ): Promise<SupplyItemDto> {
    const row = await this.itemRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Supply item not found');
    const ctx = await this.resolveActorContext(actorRoleId);
    this.assertOwnership(row, ctx);

    if (dto.item_name !== undefined) {
      const next = dto.item_name.trim();
      if (!next) throw new BadRequestException('item_name cannot be empty');
      if (next !== row.item_name) {
        const dup = await this.itemRepo.findOne({
          where: { event_id: row.event_id, item_name: next },
        });
        if (dup && dup.id !== id) {
          throw new ConflictException(`Item "${next}" already exists for this event`);
        }
        row.item_name = next;
      }
    }
    if (dto.unit !== undefined) row.unit = dto.unit.trim();
    if (dto.sort_order !== undefined) row.sort_order = dto.sort_order;
    // Leader cannot reassign ownership — only admin (actorRoleId === null) may.
    if (actorRoleId === null && dto.created_by_role_id !== undefined) {
      row.created_by_role_id = dto.created_by_role_id;
    }

    const saved = await this.itemRepo.save(row);
    await this.cache.invalidateSupplyItems(saved.event_id);
    return this.toDto(saved);
  }

  async deleteItem(id: number, actorRoleId: number | null): Promise<void> {
    const row = await this.itemRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Supply item not found');
    const ctx = await this.resolveActorContext(actorRoleId);
    this.assertOwnership(row, ctx);

    // Refuse delete if any plan/allocation references it — avoid cascade
    // orphans. Frontend should switch to soft-delete if needed.
    const [planCount, allocCount] = await Promise.all([
      this.planRepo.count({ where: { item_id: id } }),
      this.allocRepo.count({ where: { item_id: id } }),
    ]);
    if (planCount > 0 || allocCount > 0) {
      throw new ConflictException(
        `Cannot delete item: referenced by ${planCount} plan row(s) and ${allocCount} allocation(s)`,
      );
    }

    await this.itemRepo.delete({ id });
    await this.cache.invalidateSupplyItems(row.event_id);
    this.logger.log(
      `[SUPPLY] item.delete event=${row.event_id} id=${id} by=${actorRoleId ?? 'admin'}`,
    );
  }

  /**
   * v1.6 Option B2 ownership gate:
   *  - Admin (ctx === null): always allowed.
   *  - Admin-owned item (created_by_role_id === null): leaders cannot edit.
   *  - Leader-owned item: the actor's role_id OR any role in the actor's
   *    BFS-managed set (so a top-level leader can edit items created by a
   *    nested sub-leader they manage).
   */
  private assertOwnership(
    row: VolSupplyItem,
    ctx: { ownerRoleId: number; managed: Set<number> } | null,
  ): void {
    if (ctx === null) return; // admin
    if (row.created_by_role_id === null) {
      throw new ForbiddenException('This item is admin-owned');
    }
    const allowed =
      row.created_by_role_id === ctx.ownerRoleId ||
      ctx.managed.has(row.created_by_role_id);
    if (!allowed) {
      throw new ForbiddenException(
        'Leaders may only edit items they created or items owned by roles within their managed hierarchy',
      );
    }
  }

  private toDto(row: VolSupplyItem): SupplyItemDto {
    return {
      id: row.id,
      event_id: row.event_id,
      item_name: row.item_name,
      unit: row.unit,
      created_by_role_id: row.created_by_role_id,
      sort_order: row.sort_order,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    };
  }
}
