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
    } catch (err) {
      this.logger.warn(`Cache invalidate failed for event ${eventId}: ${(err as Error).message}`);
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
