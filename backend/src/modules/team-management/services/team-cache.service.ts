import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

const TTL = {
  roleSlots: 300,
  eventStats: 120,
  publicEvents: 120,
} as const;

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
