import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { VolEvent } from '../entities/vol-event.entity';
import { VolRole } from '../entities/vol-role.entity';
import { CreateEventDto } from '../dto/create-event.dto';
import { UpdateEventDto } from '../dto/update-event.dto';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { TeamCacheService } from './team-cache.service';
import { TeamRoleHierarchyService } from './team-role-hierarchy.service';
import { TeamContractNumberService } from './team-contract-number.service';

// v1.6 Option B2 — response shape augmenting the VolRole entity with the
// materialized list of direct children (id + name) plus a flat id[] helper.
// Not a class DTO because the admin controller returns the entity directly
// and TypeORM's plain-object serialization already respects these fields.
// We Omit<> the entity's `managed_roles` relation because we narrow its
// shape to the minimal `{id, role_name}` tuple for network response.
export type VolRoleWithManaged = Omit<VolRole, 'managed_roles'> & {
  managed_role_ids: number[];
  managed_roles: Array<{ id: number; role_name: string }>;
  // v1.8 — category display fields for admin UI team column
  category_name: string | null;
  category_color: string | null;
};

/**
 * v1.5: Normalize a user-provided chat group URL.
 * - undefined → undefined (caller treats as "no patch")
 * - null or empty/whitespace-only string → null (stored as "no link")
 * - Existing protocol (http/https/tel/mailto/zalo/etc) → returned as-is, trimmed
 * - Bare "zalo.me/g/xxx" or "t.me/foo" → "https://" prepended
 */
function normalizeChatGroupUrl(input: string | null | undefined): string | null | undefined {
  if (input === undefined) return undefined;
  if (input === null) return null;
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

@Injectable()
export class TeamEventService {
  constructor(
    @InjectDataSource('volunteer')
    private readonly dataSource: DataSource,
    @InjectRepository(VolEvent, 'volunteer')
    private readonly eventRepo: Repository<VolEvent>,
    @InjectRepository(VolRole, 'volunteer')
    private readonly roleRepo: Repository<VolRole>,
    private readonly cache: TeamCacheService,
    private readonly hierarchy: TeamRoleHierarchyService,
    private readonly contractNumbers: TeamContractNumberService,
  ) {}

  /**
   * v1.6 Option B2 — replace the junction rows for a leader role. Called
   * from create + update; always runs inside a transaction. Ignores NULL /
   * undefined (caller decides whether "no patch" vs "clear").
   */
  private async syncManagedRoles(
    leaderRoleId: number,
    managedRoleIds: number[],
    eventId: number,
  ): Promise<void> {
    // Self-management guard — UI blocks this but defense-in-depth here too.
    if (managedRoleIds.includes(leaderRoleId)) {
      throw new BadRequestException(
        'Role không thể tự quản lý chính nó (manages_role_ids contains self)',
      );
    }

    if (managedRoleIds.length > 0) {
      // Managed role IDs must all exist AND belong to the same event —
      // cross-event linking would break the supply scope gates.
      const unique = Array.from(new Set(managedRoleIds));
      const rows = await this.roleRepo.find({ where: { id: In(unique) } });
      if (rows.length !== unique.length) {
        throw new BadRequestException(
          'Một số role trong manages_role_ids không tồn tại',
        );
      }
      for (const r of rows) {
        if (r.event_id !== eventId) {
          throw new BadRequestException(
            `Role ${r.id} thuộc event khác — không thể liên kết cross-event`,
          );
        }
      }

      // Cycle detection BEFORE we write. Simulate the new edge set and
      // walk the existing graph: if we revisit leaderRoleId → reject.
      const cycle = await this.hierarchy.wouldCreateCycle(
        leaderRoleId,
        unique,
      );
      if (cycle) {
        throw new BadRequestException(
          'Cấu hình này sẽ tạo vòng lặp (cycle) trong hierarchy — không cho phép',
        );
      }
    }

    await this.dataSource.transaction(async (m) => {
      // Raw-SQL delete+insert is simpler than loading the full ManyToMany
      // relation, and matches the junction PK (leader, managed).
      await m.query(
        'DELETE FROM vol_role_manages WHERE leader_role_id = ?',
        [leaderRoleId],
      );
      if (managedRoleIds.length > 0) {
        const dedup = Array.from(new Set(managedRoleIds));
        const values = dedup.map(() => '(?, ?)').join(', ');
        const params: number[] = [];
        for (const mid of dedup) {
          params.push(leaderRoleId, mid);
        }
        await m.query(
          `INSERT INTO vol_role_manages (leader_role_id, managed_role_id) VALUES ${values}`,
          params,
        );
      }
    });

    // Invalidate this leader's BFS result AND any ancestor that transitively
    // includes us (broad flush is simpler than tree-walking upward).
    await this.hierarchy.invalidateHierarchy();
  }

  /**
   * v1.6 Option B2 — load the direct children (id + name) for a role.
   * Returned on role list/detail so admin UI can render chips without an
   * extra round-trip.
   */
  private async loadManagedForRole(
    roleId: number,
  ): Promise<Array<{ id: number; role_name: string }>> {
    return this.roleRepo
      .createQueryBuilder('r')
      .innerJoin('vol_role_manages', 'rm', 'rm.managed_role_id = r.id')
      .where('rm.leader_role_id = :id', { id: roleId })
      .select(['r.id AS id', 'r.role_name AS role_name'])
      .orderBy('r.sort_order', 'ASC')
      .addOrderBy('r.id', 'ASC')
      .getRawMany<{ id: number; role_name: string }>()
      .then((rows) =>
        rows.map((r) => ({ id: Number(r.id), role_name: r.role_name })),
      );
  }

  /**
   * Bulk variant — single query per event (avoids N+1 when listing roles).
   * Returns a Map keyed by leader role id → list of { id, role_name }.
   */
  private async loadManagedForRoles(
    roleIds: number[],
  ): Promise<Map<number, Array<{ id: number; role_name: string }>>> {
    const result = new Map<number, Array<{ id: number; role_name: string }>>();
    if (roleIds.length === 0) return result;
    const rows = await this.roleRepo
      .createQueryBuilder('r')
      .innerJoin('vol_role_manages', 'rm', 'rm.managed_role_id = r.id')
      .where('rm.leader_role_id IN (:...ids)', { ids: roleIds })
      .select([
        'rm.leader_role_id AS leader_role_id',
        'r.id AS id',
        'r.role_name AS role_name',
        'r.sort_order AS sort_order',
      ])
      .orderBy('r.sort_order', 'ASC')
      .addOrderBy('r.id', 'ASC')
      .getRawMany<{
        leader_role_id: number;
        id: number;
        role_name: string;
        sort_order: number;
      }>();
    for (const row of rows) {
      const leaderId = Number(row.leader_role_id);
      const bucket = result.get(leaderId) ?? [];
      bucket.push({ id: Number(row.id), role_name: row.role_name });
      result.set(leaderId, bucket);
    }
    return result;
  }

  /** Shape a raw VolRole into the admin-facing augmented response. */
  private shapeRole(
    role: VolRole,
    managed: Array<{ id: number; role_name: string }>,
  ): VolRoleWithManaged {
    return {
      ...role,
      managed_roles: managed,
      managed_role_ids: managed.map((m) => m.id),
      category_name: role.category?.name ?? null,
      category_color: role.category?.color ?? null,
    };
  }

  async createEvent(dto: CreateEventDto): Promise<VolEvent> {
    if (new Date(dto.event_end_date) < new Date(dto.event_start_date)) {
      throw new BadRequestException('event_end_date before event_start_date');
    }
    if (new Date(dto.registration_close) <= new Date(dto.registration_open)) {
      throw new BadRequestException('registration_close must be after registration_open');
    }
    const entity = this.eventRepo.create({
      ...dto,
      location_lat: dto.location_lat ?? null,
      location_lng: dto.location_lng ?? null,
      registration_open: new Date(dto.registration_open),
      registration_close: new Date(dto.registration_close),
    });
    const saved = await this.eventRepo.save(entity);
    await this.cache.invalidateEvent(saved.id);
    return saved;
  }

  async listEvents(params: {
    status?: string;
    page: number;
    limit: number;
  }): Promise<{ data: VolEvent[]; total: number; page: number }> {
    const qb = this.eventRepo
      .createQueryBuilder('e')
      .orderBy('e.event_start_date', 'DESC')
      .skip((params.page - 1) * params.limit)
      .take(params.limit);
    if (params.status) qb.andWhere('e.status = :status', { status: params.status });
    const [data, total] = await qb.getManyAndCount();
    return { data, total, page: params.page };
  }

  async getEvent(
    id: number,
  ): Promise<VolEvent & { roles: VolRoleWithManaged[] }> {
    const event = await this.eventRepo.findOne({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    const roles = await this.roleRepo.find({
      where: { event_id: id },
      relations: { category: true },
      order: { sort_order: 'ASC', id: 'ASC' },
    });
    const managedMap = await this.loadManagedForRoles(roles.map((r) => r.id));
    const shaped = roles.map((r) =>
      this.shapeRole(r, managedMap.get(r.id) ?? []),
    );
    return { ...event, roles: shaped };
  }

  async updateEvent(id: number, dto: UpdateEventDto): Promise<VolEvent> {
    const event = await this.eventRepo.findOne({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.status === 'completed') {
      throw new BadRequestException('Cannot edit event in completed status');
    }

    // v2.0 QC F-1: if the admin tries to edit contract_code_prefix after
    // contracts have been issued, reject. The prefix is baked into every
    // issued contract_number — editing it mid-event would break the 1:1
    // map between issued contracts and the letter-code on the document.
    //
    // contract_code_prefix is NOT yet in UpdateEventDto (Phase C adds the
    // admin form field). Read via index-access to handle forward compat
    // when the DTO field lands — the guard is already wired.
    const rawPrefix = (dto as Record<string, unknown>).contract_code_prefix;
    if (rawPrefix !== undefined && rawPrefix !== event.contract_code_prefix) {
      await this.contractNumbers.assertPrefixEditable(id);
    }

    // v1.8 QC fix: cross-field validation on the merged effective values so
    // partial updates (e.g. only reg_close sent) are still checked against
    // the stored counterpart. `undefined` = no change; `null` is rejected
    // by the DTO above for required date fields, so only valid ISO / Date.
    // VolEvent.event_start_date / event_end_date are string YYYY-MM-DD;
    // new Date('YYYY-MM-DD') parses as UTC midnight, safe for same-tz compare.
    const nextStart = new Date(
      dto.event_start_date ?? event.event_start_date,
    );
    const nextEnd = new Date(dto.event_end_date ?? event.event_end_date);
    if (nextEnd < nextStart) {
      throw new BadRequestException(
        'event_end_date must be on or after event_start_date',
      );
    }

    const nextRegOpen =
      dto.registration_open !== undefined
        ? new Date(dto.registration_open)
        : event.registration_open;
    const nextRegClose =
      dto.registration_close !== undefined
        ? new Date(dto.registration_close)
        : event.registration_close;
    if (nextRegClose <= nextRegOpen) {
      throw new BadRequestException(
        'registration_close must be after registration_open',
      );
    }

    // v1.8 QC fix: coord pairing — cannot have only one of lat/lng set.
    // Compute next values honoring `null = clear`, `undefined = keep`.
    const nextLat =
      dto.location_lat === undefined ? event.location_lat : dto.location_lat;
    const nextLng =
      dto.location_lng === undefined ? event.location_lng : dto.location_lng;
    if ((nextLat == null) !== (nextLng == null)) {
      throw new BadRequestException(
        'location_lat and location_lng must both be set or both null',
      );
    }

    // v1.8 QC fix: explicit field-by-field assignment so that `null` values
    // in the DTO actually wipe the stored value (Object.assign copies null
    // which we want — but the previous lat/lng fallback silently ignored
    // null-as-clear. Normalize here).
    Object.assign(event, {
      ...dto,
      location_lat: nextLat,
      location_lng: nextLng,
      registration_open: nextRegOpen,
      registration_close: nextRegClose,
    });
    const saved = await this.eventRepo.save(event);
    await this.cache.invalidateEvent(id);
    return saved;
  }

  async deleteEvent(id: number): Promise<void> {
    const event = await this.eventRepo.findOne({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.status !== 'draft') {
      throw new BadRequestException('Only draft events can be deleted');
    }
    await this.eventRepo.remove(event);
    await this.cache.invalidateEvent(id);
  }

  async createRole(
    eventId: number,
    dto: CreateRoleDto,
  ): Promise<VolRoleWithManaged> {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    const normalizedChatUrl = normalizeChatGroupUrl(dto.chat_group_url);
    // Strip manages_role_ids from the base insert — it's a junction field,
    // written separately after the role exists.
    const { manages_role_ids, ...roleFields } = dto;
    const role = this.roleRepo.create({
      ...roleFields,
      event_id: eventId,
      daily_rate: String(dto.daily_rate),
      filled_slots: 0,
      chat_platform: dto.chat_platform ?? null,
      // normalizedChatUrl can be undefined (user didn't pass) — coerce to null
      // so the column is populated correctly on INSERT.
      chat_group_url: normalizedChatUrl === undefined ? null : normalizedChatUrl,
    });
    const saved = await this.roleRepo.save(role);

    // v1.6 Option B2: sync junction rows. Only meaningful for leader roles;
    // we still honor the array if passed (empty array = explicit "manages
    // nothing").
    if (Array.isArray(manages_role_ids) && dto.is_leader_role) {
      await this.syncManagedRoles(saved.id, manages_role_ids, eventId);
    }

    await this.cache.invalidateEvent(eventId, [saved.id]);
    const managed = await this.loadManagedForRole(saved.id);
    return this.shapeRole(saved, managed);
  }

  async listRoles(eventId: number): Promise<VolRoleWithManaged[]> {
    const roles = await this.roleRepo.find({
      where: { event_id: eventId },
      relations: { category: true },
      order: { sort_order: 'ASC', id: 'ASC' },
    });
    const managedMap = await this.loadManagedForRoles(roles.map((r) => r.id));
    return roles.map((r) => this.shapeRole(r, managedMap.get(r.id) ?? []));
  }

  async updateRole(
    roleId: number,
    dto: UpdateRoleDto,
  ): Promise<VolRoleWithManaged> {
    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');
    if (dto.max_slots != null && dto.max_slots < role.filled_slots) {
      throw new BadRequestException(
        `max_slots (${dto.max_slots}) cannot be smaller than filled_slots (${role.filled_slots})`,
      );
    }
    // v1.5 chat fields: honor explicit null ("clear"), undefined means "leave
    // unchanged", non-empty string gets normalized to https:// + kept.
    // Strip chat fields from the spread first so undefined doesn't clobber
    // the persisted value via Object.assign.
    // v1.6 Option B2: also strip manages_role_ids — junction-table field,
    // handled separately via syncManagedRoles so Object.assign doesn't try
    // to write it onto the entity (the entity has no scalar column for it).
    const {
      chat_platform: chatPlatformIn,
      chat_group_url: chatGroupUrlIn,
      manages_role_ids: managesIn,
      ...restDto
    } = dto;
    Object.assign(role, {
      ...restDto,
      daily_rate: dto.daily_rate != null ? String(dto.daily_rate) : role.daily_rate,
    });
    if ('chat_platform' in dto) {
      role.chat_platform = chatPlatformIn ?? null;
    }
    if ('chat_group_url' in dto) {
      const normalized = normalizeChatGroupUrl(chatGroupUrlIn);
      if (normalized !== undefined) role.chat_group_url = normalized;
    }
    const saved = await this.roleRepo.save(role);

    // v1.6 Option B2: sync junction. Semantics match the v1.5 chat fields —
    // `undefined` means "leave unchanged"; an explicit array (even empty)
    // means "replace". If the role is being flipped to non-leader, we also
    // clear the junction defensively (stale edges would confuse resolver).
    if (managesIn !== undefined) {
      // Explicit admin write — respect it, EXCEPT when non-leader: if caller
      // passed IDs while flipping to non-leader, normalize to [] to keep the
      // invariant "only leaders have managed_roles".
      const effectiveIds =
        saved.is_leader_role === false ? [] : managesIn;
      await this.syncManagedRoles(roleId, effectiveIds, saved.event_id);
    } else if (
      'is_leader_role' in dto &&
      dto.is_leader_role === false
    ) {
      // Flipping to non-leader without touching manages_role_ids → clear
      // stale junction rows so the resolver doesn't return ghost IDs.
      await this.syncManagedRoles(roleId, [], saved.event_id);
    }

    await this.cache.invalidateEvent(role.event_id, [roleId]);
    const managed = await this.loadManagedForRole(roleId);
    return this.shapeRole(saved, managed);
  }

  async deleteRole(roleId: number): Promise<void> {
    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.filled_slots > 0) {
      throw new BadRequestException('Cannot delete role with existing registrations');
    }
    await this.roleRepo.remove(role);
    await this.cache.invalidateEvent(role.event_id, [roleId]);
  }

  /**
   * Public event listing — only events whose registration window is open now.
   */
  async listPublicEvents(): Promise<VolEvent[]> {
    const now = new Date();
    return this.eventRepo
      .createQueryBuilder('e')
      .where('e.status = :status', { status: 'open' })
      .andWhere('e.registration_open <= :now', { now })
      .andWhere('e.registration_close >= :now', { now })
      .orderBy('e.event_start_date', 'ASC')
      .getMany();
  }

  /**
   * Public event detail — 404 for drafts / closed / completed events OR
   * events whose registration window is not currently active. Draft events
   * must not leak through the public endpoint.
   */
  async getPublicEvent(
    id: number,
  ): Promise<VolEvent & { roles: VolRole[] }> {
    const event = await this.eventRepo.findOne({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    const now = new Date();
    const isVisible =
      event.status === 'open' &&
      event.registration_open <= now &&
      event.registration_close >= now;
    if (!isVisible) {
      throw new NotFoundException('Event not found');
    }
    const roles = await this.roleRepo.find({
      where: { event_id: id },
      order: { sort_order: 'ASC', id: 'ASC' },
    });
    return { ...event, roles };
  }
}
