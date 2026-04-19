import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

const TTL = {
  roleSlots: 300,
  eventStats: 120,
  publicEvents: 120,
  // v1.6 supply module
  supplyItems: 300,
  supplyOverview: 30,
  supplyPlan: 60,
  stationAllocations: 30,
} as const;

export const CACHE_TTL = TTL;

/**
 * Redis cache keys for team-management. Keep all key names here so they can
 * be invalidated from a single helper.
 */
@Injectable()
export class TeamCacheService {
  private readonly logger = new Logger(TeamCacheService.name);

  constructor(@InjectRedis() private readonly redis: Redis) {}

  static keyRoleSlots(roleId: number): string {
    return `team:role:${roleId}:slots`;
  }

  static keyEventStats(eventId: number): string {
    return `team:event:${eventId}:stats`;
  }

  static keyDashboardPrefix(eventId: number): string {
    return `team:event:${eventId}:dashboard:`;
  }

  // v1.5: emergency contacts per event, shared by every member viewing
  // the portal. TTL 300s — ít thay đổi.
  static keyEventContacts(eventId: number): string {
    return `team:event:${eventId}:contacts`;
  }

  // v1.5: per-registration team directory. TTL 60s — race-day data changes
  // constantly (check-ins). Stored per-registration because the response
  // shape depends on leader vs member, so we can't share one snapshot.
  static keyDirectoryPrefix(eventId: number): string {
    return `team:event:${eventId}:directory:`;
  }

  static keyDirectory(eventId: number, registrationId: number): string {
    return `${TeamCacheService.keyDirectoryPrefix(eventId)}${registrationId}`;
  }

  static readonly keyPublicEvents = 'team:public:events';

  // v1.8 Stations — admin-side list per (event, category).
  // Prefix unchanged from v1.6 (`team:event:{id}:stations:*`) so existing
  // SCAN-based event invalidation keeps working.
  static keyStationsPrefix(eventId: number): string {
    return `team:event:${eventId}:stations:`;
  }

  static keyStations(eventId: number, categoryId: number): string {
    return `${TeamCacheService.keyStationsPrefix(eventId)}${categoryId}`;
  }

  // v1.6 Stations — public portal "my station" view per (station, registration).
  static keyStationMyViewPrefix(stationId: number): string {
    return `team:station:${stationId}:my-view:`;
  }

  static keyStationMyView(stationId: number, registrationId: number): string {
    return `${TeamCacheService.keyStationMyViewPrefix(stationId)}${registrationId}`;
  }

  // v1.6 Supply — per-event item list (admin + leader)
  static keySupplyItems(eventId: number): string {
    return `team:event:${eventId}:supply-items`;
  }

  // v1.6 Supply — event-wide admin matrix overview
  static keySupplyOverview(eventId: number): string {
    return `team:event:${eventId}:supply-overview`;
  }

  // v1.8 Supply — per-category plan (admin + leader)
  static keySupplyPlan(eventId: number, categoryId: number): string {
    return `team:event:${eventId}:supply-plan:${categoryId}`;
  }

  // v1.6 Supply — per-station allocations list
  static keyStationAllocations(stationId: number): string {
    return `team:station:${stationId}:allocations`;
  }

  // Prefix used for bulk SCAN invalidation.
  static keySupplyEventPrefix(eventId: number): string {
    return `team:event:${eventId}:supply-`;
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setJson<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async setRoleSlots(roleId: number, payload: unknown): Promise<void> {
    await this.setJson(TeamCacheService.keyRoleSlots(roleId), payload, TTL.roleSlots);
  }

  async setEventStats(eventId: number, payload: unknown): Promise<void> {
    await this.setJson(TeamCacheService.keyEventStats(eventId), payload, TTL.eventStats);
  }

  async setPublicEvents(payload: unknown): Promise<void> {
    await this.setJson(TeamCacheService.keyPublicEvents, payload, TTL.publicEvents);
  }

  /**
   * Nuke every cache entry that depends on this event. Called after any
   * registration mutation, shirt-stock write, role edit, or event status change.
   *
   * Dashboard keys are paginated (`team:event:{id}:dashboard:p{n}:l{m}`) so
   * we SCAN the prefix before deleting. SCAN count stays small per event
   * (admin rarely paginates past page 1).
   */
  async invalidateEvent(eventId: number, affectedRoleIds: number[] = []): Promise<void> {
    const fixedKeys = [
      TeamCacheService.keyEventStats(eventId),
      TeamCacheService.keyPublicEvents,
      // v1.5: emergency-contact list is a single key per event, so we can
      // include it in the fixed-delete pass.
      TeamCacheService.keyEventContacts(eventId),
      ...affectedRoleIds.map((rid) => TeamCacheService.keyRoleSlots(rid)),
    ];
    try {
      await this.redis.del(...fixedKeys);
      const dashboardKeys = await this.scanKeys(
        `${TeamCacheService.keyDashboardPrefix(eventId)}*`,
      );
      if (dashboardKeys.length > 0) {
        await this.redis.del(...dashboardKeys);
      }
      // v1.5: directory is sharded per-registration — SCAN+DEL wildcard.
      const directoryKeys = await this.scanKeys(
        `${TeamCacheService.keyDirectoryPrefix(eventId)}*`,
      );
      if (directoryKeys.length > 0) {
        await this.redis.del(...directoryKeys);
      }
      // v1.6: stations list keys live under `team:event:{id}:stations:*`
      // and each station's "my view" caches live under
      // `team:station:*:my-view:*`. Any station-level write on this event
      // invalidates all of them; we broadly nuke my-view across stations
      // because admins rarely care about per-station granularity at the
      // event-invalidation level (Danny BR-STN: conservative invalidation).
      const stationListKeys = await this.scanKeys(
        `${TeamCacheService.keyStationsPrefix(eventId)}*`,
      );
      if (stationListKeys.length > 0) {
        await this.redis.del(...stationListKeys);
      }
      const stationMyViewKeys = await this.scanKeys(
        `team:station:*:my-view:*`,
      );
      if (stationMyViewKeys.length > 0) {
        await this.redis.del(...stationMyViewKeys);
      }
      // v1.6 Supply — drop items/overview/plan for this event + all
      // station-level allocation caches (we don't know which stations belong
      // to this event without a DB hit, so we nuke the global allocation
      // prefix — cheap and safe).
      const supplyEventKeys = await this.scanKeys(
        `${TeamCacheService.keySupplyEventPrefix(eventId)}*`,
      );
      if (supplyEventKeys.length > 0) {
        await this.redis.del(...supplyEventKeys);
      }
      const stationAllocKeys = await this.scanKeys(
        `team:station:*:allocations`,
      );
      if (stationAllocKeys.length > 0) {
        await this.redis.del(...stationAllocKeys);
      }
      // v1.6 Option B2: role hierarchy memoization. Any role edit at the
      // event-invalidation level might reshape ancestor resolution, so we
      // wipe the whole pattern. Per-leader targeted invalidation happens
      // in TeamRoleHierarchyService.invalidateHierarchy when the role
      // service knows exactly which leader was touched.
      const leaderDescKeys = await this.scanKeys(`team:leader:*:descendants`);
      if (leaderDescKeys.length > 0) {
        await this.redis.del(...leaderDescKeys);
      }
    } catch (err) {
      this.logger.warn(`Cache invalidate failed for event ${eventId}: ${(err as Error).message}`);
    }
  }

  /**
   * v1.5: targeted invalidation after a CRUD on vol_event_contact.
   * Only the single contacts key needs to be dropped — directory and dashboard
   * are independent.
   */
  async invalidateEventContacts(eventId: number): Promise<void> {
    try {
      await this.redis.del(TeamCacheService.keyEventContacts(eventId));
    } catch (err) {
      this.logger.warn(
        `Contacts cache invalidate failed for event ${eventId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * v1.8: Drop the admin "list stations" cache for one event. Optionally
   * narrow to a single Team (category); otherwise nukes every category under
   * that event. (v1.6 used roleId; renamed for semantic accuracy.)
   */
  async invalidateStations(
    eventId: number,
    categoryId?: number,
  ): Promise<void> {
    try {
      if (categoryId !== undefined) {
        await this.redis.del(
          TeamCacheService.keyStations(eventId, categoryId),
        );
      } else {
        const keys = await this.scanKeys(
          `${TeamCacheService.keyStationsPrefix(eventId)}*`,
        );
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }
    } catch (err) {
      this.logger.warn(
        `Stations cache invalidate failed for event ${eventId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * v1.6: Drop every "my-station" portal view cached for a station. Called
   * whenever a station field or any of its assignments changes.
   */
  async invalidateStation(stationId: number): Promise<void> {
    try {
      const keys = await this.scanKeys(
        `${TeamCacheService.keyStationMyViewPrefix(stationId)}*`,
      );
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (err) {
      this.logger.warn(
        `Station cache invalidate failed for station ${stationId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * v1.6 Supply — targeted invalidators. Cheaper than `invalidateEvent`
   * when only the supply slice changed.
   */
  async invalidateSupplyItems(eventId: number): Promise<void> {
    try {
      await this.redis.del(
        TeamCacheService.keySupplyItems(eventId),
        TeamCacheService.keySupplyOverview(eventId),
      );
    } catch (err) {
      this.logger.warn(
        `Supply-items cache invalidate failed for event ${eventId}: ${(err as Error).message}`,
      );
    }
  }

  async invalidateSupplyPlan(
    eventId: number,
    categoryId: number,
  ): Promise<void> {
    try {
      await this.redis.del(
        TeamCacheService.keySupplyPlan(eventId, categoryId),
        TeamCacheService.keySupplyOverview(eventId),
      );
    } catch (err) {
      this.logger.warn(
        `Supply-plan cache invalidate failed (event=${eventId}, category=${categoryId}): ${(err as Error).message}`,
      );
    }
  }

  async invalidateStationAllocations(
    stationId: number,
    eventId?: number,
  ): Promise<void> {
    try {
      const keys: string[] = [TeamCacheService.keyStationAllocations(stationId)];
      if (eventId !== undefined) {
        keys.push(TeamCacheService.keySupplyOverview(eventId));
      }
      await this.redis.del(...keys);
    } catch (err) {
      this.logger.warn(
        `Station-allocations cache invalidate failed for station ${stationId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * v1.6 Option B2 — generic helpers used by TeamRoleHierarchyService to
   * manage the leader-descendants cache. Kept deliberately narrow (single
   * key / pattern) to discourage ad-hoc wildcard flushes from other services.
   */
  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (err) {
      this.logger.warn(`del(${key}) failed: ${(err as Error).message}`);
    }
  }

  async scanDel(pattern: string): Promise<void> {
    try {
      const keys = await this.scanKeys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (err) {
      this.logger.warn(`scanDel(${pattern}) failed: ${(err as Error).message}`);
    }
  }

  /** Cursor-based SCAN to avoid blocking Redis on large keyspaces. */
  private async scanKeys(pattern: string): Promise<string[]> {
    const found: string[] = [];
    let cursor = '0';
    do {
      const [next, batch] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        200,
      );
      cursor = next;
      if (batch.length > 0) found.push(...batch);
    } while (cursor !== '0');
    return found;
  }
}
