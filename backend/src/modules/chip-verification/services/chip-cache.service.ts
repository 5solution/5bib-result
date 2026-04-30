import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { In, MoreThan, Repository } from 'typeorm';
import { AthleteReadonly } from '../entities/athlete-readonly.entity';
import {
  CHIP_CACHE_TTL_SECONDS,
  CHIP_CRON_LOCK_TTL_SECONDS,
  ChipRedisKeys,
} from '../utils/redis-keys';
import { ChipMappingService } from './chip-mapping.service';
import { ChipConfigService } from './chip-config.service';

/**
 * Athlete cache payload stored in Redis HSET.
 * Key:  chip:athlete:{raceId}
 * Field: bib_number
 * Value: JSON of CachedAthletePayload
 */
export interface CachedAthletePayload {
  athletes_id: number;
  bib_number: string;
  name: string | null;
  course_name: string | null;
  /** Giới tính từ subinfo.gender (varchar 16): 'MALE' | 'FEMALE' | 'OTHER' | null */
  gender: string | null;
  team: string | null;
  last_status: string | null;
  racekit_received: boolean;
  cached_at: number; // ms epoch
}

@Injectable()
export class ChipCacheService {
  private readonly logger = new Logger(ChipCacheService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    @InjectRepository(AthleteReadonly, 'platform')
    private readonly athleteRepo: Repository<AthleteReadonly>,
    private readonly mappingService: ChipMappingService,
    private readonly configService: ChipConfigService,
  ) {}

  // ─────────── PRELOAD (on enable) ───────────

  /**
   * Bulk SELECT JOIN MySQL → bulk HSET Redis.
   * Memory: ~3.5MB / 7K athletes (estimated). Single shot, blocking caller
   * (admin will wait — show progress on UI).
   */
  async preload(
    raceId: number,
  ): Promise<{ cached_count: number; mappings_count: number }> {
    const t0 = Date.now();

    const mappings = await this.mappingService.listAllActive(raceId);
    if (mappings.length === 0) {
      this.logger.log(`[preload] race=${raceId} no mappings — skip`);
      await this.redis.set(
        ChipRedisKeys.cacheReady(raceId),
        '1',
        'EX',
        CHIP_CACHE_TTL_SECONDS,
      );
      await this.configService.setPreloadCompleted(raceId, 0);
      return { cached_count: 0, mappings_count: 0 };
    }

    const bibSet = Array.from(new Set(mappings.map((m) => m.bib_number)));

    // JOIN 4 cấp: athletes → subinfo → order_line_item → ticket_type → race_course
    const athletes = await this.athleteRepo.find({
      where: {
        race_id: raceId,
        deleted: false,
        bib_number: In(bibSet),
      },
      relations: {
        subinfo: { orderLineItem: { ticketType: { raceCourse: true } } },
        code: { raceCourse: true },
      },
      take: 10000, // safety cap (race max 7K)
    });

    const byBib = new Map(
      athletes
        .filter((a): a is AthleteReadonly & { bib_number: string } =>
          Boolean(a.bib_number),
        )
        .map((a) => [a.bib_number, a]),
    );

    // Build HSET payload
    const hsetArgs: string[] = [];
    let cachedCount = 0;
    for (const m of mappings) {
      const a = byBib.get(m.bib_number);
      if (!a) continue; // BIB not yet assigned in athletes table — skip preload, fallback handles
      const payload = this.buildPayload(a);
      hsetArgs.push(m.bib_number, JSON.stringify(payload));
      cachedCount += 1;
    }

    if (hsetArgs.length > 0) {
      const cacheKey = ChipRedisKeys.athleteCache(raceId);
      // Pipeline: DEL old + HSET fresh + EXPIRE
      const pipe = this.redis.pipeline();
      pipe.del(cacheKey);
      // ioredis hset accepts variadic
      pipe.hset(cacheKey, ...(hsetArgs as [string, ...string[]]));
      pipe.expire(cacheKey, CHIP_CACHE_TTL_SECONDS);
      await pipe.exec();
    }

    await this.redis.set(
      ChipRedisKeys.cacheReady(raceId),
      '1',
      'EX',
      CHIP_CACHE_TTL_SECONDS,
    );
    await this.configService.setPreloadCompleted(raceId, mappings.length);

    const ms = Date.now() - t0;
    this.logger.log(
      `[preload] race=${raceId} mappings=${mappings.length} cached=${cachedCount} ms=${ms}`,
    );

    return { cached_count: cachedCount, mappings_count: mappings.length };
  }

  async clearCache(raceId: number): Promise<void> {
    await this.redis.del(ChipRedisKeys.athleteCache(raceId));
    await this.redis.del(ChipRedisKeys.cacheReady(raceId));
    this.logger.log(`[clearCache] race=${raceId}`);
  }

  // ─────────── DELTA PATCH (cron) ───────────

  /**
   * Delta sync for a single race. Caller wraps in per-race lock to prevent
   * tick overlap (MUST-DO #5). Window 90s overlaps with cron interval 30s
   * so transient clock skew won't lose rows.
   */
  async patchDelta(raceId: number): Promise<{ patched: number }> {
    const cutoff = new Date(Date.now() - 90 * 1000);

    const recent = await this.athleteRepo.find({
      where: {
        race_id: raceId,
        modified_on: MoreThan(cutoff),
        deleted: false,
      },
      relations: {
        subinfo: { orderLineItem: { ticketType: { raceCourse: true } } },
        code: { raceCourse: true },
      },
      take: 500,
    });

    if (recent.length === 0) return { patched: 0 };

    // Filter only rows whose bib has a chip mapping
    const bibsWithChip = new Set(
      (await this.mappingService.listAllActive(raceId)).map((m) => m.bib_number),
    );

    const cacheKey = ChipRedisKeys.athleteCache(raceId);
    const pipe = this.redis.pipeline();
    let patched = 0;

    for (const a of recent) {
      if (!a.bib_number || !bibsWithChip.has(a.bib_number)) continue;
      const payload = this.buildPayload(a);
      pipe.hset(cacheKey, a.bib_number, JSON.stringify(payload));
      patched += 1;
    }
    pipe.expire(cacheKey, CHIP_CACHE_TTL_SECONDS);
    await pipe.exec();

    if (patched > 0) {
      this.logger.log(`[delta] race=${raceId} patched=${patched}`);
    }
    return { patched };
  }

  // ─────────── ON-DEMAND FALLBACK (lookup miss) ───────────

  /**
   * Called by ChipLookupService on Redis miss.
   * Caller MUST hold lookup-lock (SETNX EX 5s) — anti-stampede MUST-DO #3.
   * Returns null if athlete not found (CHIP_NOT_FOUND or BIB_UNASSIGNED).
   */
  async resolveAthleteOnDemand(
    raceId: number,
    bibNumber: string,
  ): Promise<CachedAthletePayload | null> {
    const a = await this.athleteRepo.findOne({
      where: { race_id: raceId, bib_number: bibNumber, deleted: false },
      relations: {
        subinfo: { orderLineItem: { ticketType: { raceCourse: true } } },
        code: { raceCourse: true },
      },
    });
    if (!a) return null;

    const payload = this.buildPayload(a);
    // Write-through cache
    await this.redis.hset(
      ChipRedisKeys.athleteCache(raceId),
      bibNumber,
      JSON.stringify(payload),
    );
    await this.redis.expire(
      ChipRedisKeys.athleteCache(raceId),
      CHIP_CACHE_TTL_SECONDS,
    );

    return payload;
  }

  /** HGET lookup. */
  async getAthleteFromCache(
    raceId: number,
    bibNumber: string,
  ): Promise<CachedAthletePayload | null> {
    const raw = await this.redis.hget(
      ChipRedisKeys.athleteCache(raceId),
      bibNumber,
    );
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CachedAthletePayload;
    } catch {
      return null;
    }
  }

  // ─────────── LOCK HELPERS (MUST-DO #3) ───────────

  /** SETNX EX — returns true if acquired. Used for cron + lookup. */
  async tryLockCron(raceId: number): Promise<boolean> {
    const result = await this.redis.set(
      ChipRedisKeys.cronLock(raceId),
      '1',
      'EX',
      CHIP_CRON_LOCK_TTL_SECONDS,
      'NX',
    );
    return result === 'OK';
  }

  async releaseCronLock(raceId: number): Promise<void> {
    await this.redis.del(ChipRedisKeys.cronLock(raceId));
  }

  // ─────────── HELPERS ───────────

  private buildPayload(a: AthleteReadonly): CachedAthletePayload {
    const nameOnBib = a.subinfo?.name_on_bib ?? null;
    const displayName = (nameOnBib && nameOnBib.trim()) || a.name || null;
    // Course name resolution với 2 path:
    //   1. PRIMARY: athlete → subinfo → order_line_item → ticket_type → race_course
    //      (athletes mua vé qua order)
    //   2. FALLBACK: athlete → code → race_course
    //      (athletes import qua code, không có order — race 192 có 63% nhóm này)
    const courseName =
      a.subinfo?.orderLineItem?.ticketType?.raceCourse?.name ??
      a.code?.raceCourse?.name ??
      null;
    const gender = normalizeGender(a.subinfo?.gender ?? null);
    const team = a.subinfo?.club ?? null;
    return {
      athletes_id: Number(a.athletes_id),
      bib_number: a.bib_number ?? '',
      name: displayName,
      course_name: courseName,
      gender,
      team,
      last_status: a.last_status,
      racekit_received: Number(a.racekit_recieved ?? 0) === 1,
      cached_at: Date.now(),
    };
  }
}

/**
 * Normalize gender value từ MySQL (varchar 16) sang label tiếng Việt.
 * MySQL có thể chứa: 'MALE' | 'FEMALE' | 'OTHER' | 'M' | 'F' | null.
 */
function normalizeGender(raw: string | null): string | null {
  if (!raw) return null;
  const v = raw.trim().toUpperCase();
  if (v === 'MALE' || v === 'M' || v === 'NAM') return 'Nam';
  if (v === 'FEMALE' || v === 'F' || v === 'NỮ' || v === 'NU') return 'Nữ';
  if (v === 'OTHER' || v === 'O') return 'Khác';
  return raw;
}
