import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import {
  RACE_MASTER_CACHE_TTL_SECONDS,
  RACE_MASTER_CRON_LOCK_TTL_SECONDS,
  RACE_MASTER_LOOKUP_LOCK_TTL_SECONDS,
  RACE_MASTER_SYNC_LOCK_TTL_SECONDS,
  RaceMasterRedisKeys,
} from '../utils/redis-keys';
import { RaceAthletePublicDto } from '../dto/race-athlete-public.dto';

/**
 * Tier 1 cache (Redis) — hot path athlete lookup. Driven by sync service
 * (warmup on full sync) + lookup service (write-through on miss).
 */
@Injectable()
export class RaceMasterCacheService {
  private readonly logger = new Logger(RaceMasterCacheService.name);

  constructor(@InjectRedis() private readonly redis: Redis) {}

  // ─────────── HOT PATH ───────────

  async getByBib(
    raceId: number,
    bibNumber: string,
  ): Promise<RaceAthletePublicDto | null> {
    const raw = await this.redis.hget(
      RaceMasterRedisKeys.athleteByBib(raceId),
      bibNumber,
    );
    if (!raw) return null;
    try {
      return JSON.parse(raw) as RaceAthletePublicDto;
    } catch {
      return null;
    }
  }

  async getManyByBibs(
    raceId: number,
    bibs: string[],
  ): Promise<Map<string, RaceAthletePublicDto>> {
    if (bibs.length === 0) return new Map();
    const values = await this.redis.hmget(
      RaceMasterRedisKeys.athleteByBib(raceId),
      ...bibs,
    );
    const map = new Map<string, RaceAthletePublicDto>();
    bibs.forEach((bib, i) => {
      const v = values[i];
      if (!v) return;
      try {
        map.set(bib, JSON.parse(v) as RaceAthletePublicDto);
      } catch {
        // skip corrupt entry
      }
    });
    return map;
  }

  /** Single write-through. Used by lookup service on Mongo/MySQL fallback. */
  async setByBib(
    raceId: number,
    bibNumber: string,
    payload: RaceAthletePublicDto,
  ): Promise<void> {
    const key = RaceMasterRedisKeys.athleteByBib(raceId);
    const pipe = this.redis.pipeline();
    pipe.hset(key, bibNumber, JSON.stringify(payload));
    pipe.expire(key, RACE_MASTER_CACHE_TTL_SECONDS);
    if (payload.athletes_id) {
      pipe.hset(
        RaceMasterRedisKeys.athleteIdToBib(raceId),
        String(payload.athletes_id),
        bibNumber,
      );
      pipe.expire(
        RaceMasterRedisKeys.athleteIdToBib(raceId),
        RACE_MASTER_CACHE_TTL_SECONDS,
      );
    }
    await pipe.exec();
  }

  // ─────────── BULK WARMUP (full sync) ───────────

  async bulkWarmup(
    raceId: number,
    payloads: RaceAthletePublicDto[],
  ): Promise<{ cached: number }> {
    const bibKey = RaceMasterRedisKeys.athleteByBib(raceId);
    const idKey = RaceMasterRedisKeys.athleteIdToBib(raceId);

    const pipe = this.redis.pipeline();
    // Wipe stale entries — full sync is source of truth.
    pipe.del(bibKey);
    pipe.del(idKey);

    let cached = 0;
    const bibArgs: string[] = [];
    const idArgs: string[] = [];
    for (const p of payloads) {
      if (!p.bib_number) continue;
      bibArgs.push(p.bib_number, JSON.stringify(p));
      idArgs.push(String(p.athletes_id), p.bib_number);
      cached += 1;
    }

    if (bibArgs.length > 0) {
      pipe.hset(bibKey, ...(bibArgs as [string, ...string[]]));
      pipe.expire(bibKey, RACE_MASTER_CACHE_TTL_SECONDS);
    }
    if (idArgs.length > 0) {
      pipe.hset(idKey, ...(idArgs as [string, ...string[]]));
      pipe.expire(idKey, RACE_MASTER_CACHE_TTL_SECONDS);
    }
    await pipe.exec();
    return { cached };
  }

  /** Patch incremental — used by delta sync. */
  async patchMany(
    raceId: number,
    payloads: RaceAthletePublicDto[],
  ): Promise<{ patched: number }> {
    const bibKey = RaceMasterRedisKeys.athleteByBib(raceId);
    const idKey = RaceMasterRedisKeys.athleteIdToBib(raceId);
    const pipe = this.redis.pipeline();
    let patched = 0;
    for (const p of payloads) {
      if (!p.bib_number) continue;
      pipe.hset(bibKey, p.bib_number, JSON.stringify(p));
      pipe.hset(
        idKey,
        String(p.athletes_id),
        p.bib_number,
      );
      patched += 1;
    }
    if (patched > 0) {
      pipe.expire(bibKey, RACE_MASTER_CACHE_TTL_SECONDS);
      pipe.expire(idKey, RACE_MASTER_CACHE_TTL_SECONDS);
    }
    await pipe.exec();
    return { patched };
  }

  /**
   * Bib reassignment cleanup. Khi athlete có bib X ở cache → DB cập nhật bib
   * thành Y → cache key X phải DEL trước khi set Y, tránh stale.
   */
  async invalidateBib(raceId: number, oldBib: string): Promise<void> {
    await this.redis.hdel(RaceMasterRedisKeys.athleteByBib(raceId), oldBib);
  }

  /** Lấy bib hiện đang cached cho athletes_id (để detect bib đổi). */
  async getCachedBibForAthlete(
    raceId: number,
    athletesId: number,
  ): Promise<string | null> {
    return this.redis.hget(
      RaceMasterRedisKeys.athleteIdToBib(raceId),
      String(athletesId),
    );
  }

  async clearRace(raceId: number): Promise<void> {
    await this.redis.del(RaceMasterRedisKeys.athleteByBib(raceId));
    await this.redis.del(RaceMasterRedisKeys.athleteIdToBib(raceId));
    await this.redis.del(RaceMasterRedisKeys.stats(raceId));
    this.logger.log(`[clearRace] race=${raceId}`);
  }

  // ─────────── LOCKS ───────────

  /** Returns true if acquired. Caller must release on finally. */
  async tryAcquireSyncLock(raceId: number): Promise<boolean> {
    const r = await this.redis.set(
      RaceMasterRedisKeys.syncLock(raceId),
      '1',
      'EX',
      RACE_MASTER_SYNC_LOCK_TTL_SECONDS,
      'NX',
    );
    return r === 'OK';
  }

  async releaseSyncLock(raceId: number): Promise<void> {
    await this.redis.del(RaceMasterRedisKeys.syncLock(raceId));
  }

  async tryAcquireCronLock(raceId: number): Promise<boolean> {
    const r = await this.redis.set(
      RaceMasterRedisKeys.cronLock(raceId),
      '1',
      'EX',
      RACE_MASTER_CRON_LOCK_TTL_SECONDS,
      'NX',
    );
    return r === 'OK';
  }

  async releaseCronLock(raceId: number): Promise<void> {
    await this.redis.del(RaceMasterRedisKeys.cronLock(raceId));
  }

  async tryAcquireLookupLock(
    raceId: number,
    bibNumber: string,
  ): Promise<boolean> {
    const r = await this.redis.set(
      RaceMasterRedisKeys.lookupLock(raceId, bibNumber),
      '1',
      'EX',
      RACE_MASTER_LOOKUP_LOCK_TTL_SECONDS,
      'NX',
    );
    return r === 'OK';
  }

  async releaseLookupLock(
    raceId: number,
    bibNumber: string,
  ): Promise<void> {
    await this.redis.del(RaceMasterRedisKeys.lookupLock(raceId, bibNumber));
  }

  // ─────────── STATS ───────────

  async getStats(raceId: number): Promise<unknown | null> {
    const raw = await this.redis.get(RaceMasterRedisKeys.stats(raceId));
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async setStats(raceId: number, stats: unknown, ttlSeconds: number): Promise<void> {
    await this.redis.set(
      RaceMasterRedisKeys.stats(raceId),
      JSON.stringify(stats),
      'EX',
      ttlSeconds,
    );
  }

  async invalidateStats(raceId: number): Promise<void> {
    await this.redis.del(RaceMasterRedisKeys.stats(raceId));
  }
}
