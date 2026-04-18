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
  ) {}

  /**
   * v1.6 Option A: resolve leader actor → managed role id. Null for admin.
   * Item ownership follows the MANAGED role (not the leader's own role).
   */
  private async resolveActorScopedRoleId(
    actorRoleId: number | null,
  ): Promise<number | null> {
    if (actorRoleId === null) return null;
    const role = await this.roleRepo.findOne({ where: { id: actorRoleId } });
    if (!role) throw new ForbiddenException('Actor role not found');
    if (!role.is_leader_role) {
      throw new ForbiddenException('Actor is not a leader role');
    }
    if (role.manages_role_id == null) {
      throw new BadRequestException(
        'Leader role chưa được cấu hình quản lý role nào. Liên hệ admin cấu hình "Quản lý role" trong Role.',
      );
    }
    return role.manages_role_id;
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

    // v1.6 Option A — leader path: pin created_by_role_id to leader's
    // MANAGED role (so ownership follows the team the leader is running),
    // not the leader role itself. Admin path: honor whatever the DTO
    // provides (null or a role_id).
    const scopedRoleId = await this.resolveActorScopedRoleId(actorRoleId);
    const createdByRoleId =
      scopedRoleId !== null
        ? scopedRoleId
        : dto.created_by_role_id ?? null;

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

  /** Admin (actorRoleId === null) can edit any; leader only items owned
   * by the role they manage (v1.6 Option A). */
  async updateItem(
    id: number,
    dto: UpdateSupplyItemDto,
    actorRoleId: number | null,
  ): Promise<SupplyItemDto> {
    const row = await this.itemRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Supply item not found');
    const scopedRoleId = await this.resolveActorScopedRoleId(actorRoleId);
    this.assertOwnership(row, scopedRoleId);

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
    const scopedRoleId = await this.resolveActorScopedRoleId(actorRoleId);
    this.assertOwnership(row, scopedRoleId);

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
   * Q7 gate: if the item has an owning role, only that role's leader (or
   * any admin, actorRoleId === null) can edit. Admin-created items
   * (created_by_role_id === null) are editable by any admin; leaders
   * cannot edit admin-owned items.
   */
  private assertOwnership(
    row: VolSupplyItem,
    actorRoleId: number | null,
  ): void {
    if (actorRoleId === null) return; // admin
    if (row.created_by_role_id === null) {
      throw new ForbiddenException('This item is admin-owned');
    }
    if (row.created_by_role_id !== actorRoleId) {
      throw new ForbiddenException(
        'Leaders may only edit items they created',
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
