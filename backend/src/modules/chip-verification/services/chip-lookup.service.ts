import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Model } from 'mongoose';
import Redis from 'ioredis';
import {
  ChipVerification,
  ChipVerificationDocument,
  ChipVerificationResult,
} from '../schemas/chip-verification.schema';
import { ChipMappingService } from './chip-mapping.service';
import {
  CachedAthletePayload,
  ChipCacheService,
} from './chip-cache.service';
import {
  CHIP_LOOKUP_LOCK_TTL_SECONDS,
  ChipRedisKeys,
} from '../utils/redis-keys';
import { ChipLookupResponseDto } from '../dto/chip-lookup.dto';
import { normalizeChipId } from '../utils/normalize';

/**
 * Core lookup service. Orchestrates:
 *   1. Redis HGET cache (fast path)
 *   2. SETNX lookup-lock anti-stampede (MUST-DO #3) → on-demand MySQL fallback
 *   3. SETNX is_first_verify atomic (MUST-DO #3)
 *   4. Insert ChipVerification audit log with denormalized snapshots
 *
 * BR-08: query MUST always use (mysql_race_id, chip_id) — never just chip_id.
 */
@Injectable()
export class ChipLookupService {
  private readonly logger = new Logger(ChipLookupService.name);

  constructor(
    @InjectModel(ChipVerification.name)
    private readonly verificationModel: Model<ChipVerificationDocument>,
    @InjectRedis() private readonly redis: Redis,
    private readonly mappingService: ChipMappingService,
    private readonly cacheService: ChipCacheService,
  ) {}

  async lookup(
    raceId: number,
    rawChipId: string,
    deviceLabel: string | undefined,
    ipAddress: string | undefined,
  ): Promise<ChipLookupResponseDto> {
    const chipId = normalizeChipId(rawChipId);

    // 1. Resolve chip → BIB via Mongoose mapping (BR-08 race-scoped query)
    const mapping = await this.mappingService.findByChipId(raceId, chipId);

    if (!mapping) {
      return this.recordAndReturn({
        raceId,
        chipId,
        bibNumber: null,
        athletesId: null,
        result: 'CHIP_NOT_FOUND',
        deviceLabel,
        ipAddress,
        athleteSnapshot: null,
        courseSnapshot: null,
      });
    }

    if (mapping.status === 'DISABLED') {
      return this.recordAndReturn({
        raceId,
        chipId,
        bibNumber: mapping.bib_number,
        athletesId: null,
        result: 'DISABLED',
        deviceLabel,
        ipAddress,
        athleteSnapshot: null,
        courseSnapshot: null,
      });
    }

    // 2. Resolve BIB → athlete: cache-first, then on-demand MySQL fallback.
    let athlete = await this.cacheService.getAthleteFromCache(
      raceId,
      mapping.bib_number,
    );

    if (!athlete) {
      athlete = await this.resolveWithLock(raceId, mapping.bib_number);
    }

    if (!athlete) {
      // Mapping exists but no athlete with this BIB yet → BIB_UNASSIGNED
      return this.recordAndReturn({
        raceId,
        chipId,
        bibNumber: mapping.bib_number,
        athletesId: null,
        result: 'BIB_UNASSIGNED',
        deviceLabel,
        ipAddress,
        athleteSnapshot: null,
        courseSnapshot: null,
      });
    }

    // 3. is_first_verify atomic SETNX (MUST-DO #3) — independent dimension
    //    from racekit_received. Tracks "first time chip verify system saw this
    //    athlete" for stats/audit only.
    const firstKey = ChipRedisKeys.firstVerify(raceId, athlete.athletes_id);
    const firstResult = await this.redis.set(firstKey, '1', 'NX');
    const isFirst = firstResult === 'OK';

    // 4. Result classification — racekit_received from MySQL is the SOURCE
    //    OF TRUTH (BUG #1 fix). If athlete already picked up at Bàn 1 legacy,
    //    Bàn 2 must show ALREADY_PICKED_UP regardless of whether this is the
    //    first chip verify or a duplicate. Otherwise BTC would hand a second
    //    racekit on first chip scan.
    let result: ChipVerificationResult = 'FOUND';
    if (athlete.racekit_received) {
      result = 'ALREADY_PICKED_UP';
    }

    return this.recordAndReturn({
      raceId,
      chipId,
      bibNumber: mapping.bib_number,
      athletesId: athlete.athletes_id,
      result,
      isFirst,
      deviceLabel,
      ipAddress,
      athleteSnapshot: athlete,
      courseSnapshot: athlete.course_name,
    });
  }

  /**
   * SETNX lookup-lock + on-demand MySQL fallback (write-through).
   * If lock not acquired, wait briefly and retry cache (another thread filled).
   */
  private async resolveWithLock(
    raceId: number,
    bibNumber: string,
  ): Promise<CachedAthletePayload | null> {
    const lockKey = ChipRedisKeys.lookupLock(raceId, bibNumber);
    const acquired = await this.redis.set(
      lockKey,
      '1',
      'EX',
      CHIP_LOOKUP_LOCK_TTL_SECONDS,
      'NX',
    );

    if (acquired === 'OK') {
      try {
        return await this.cacheService.resolveAthleteOnDemand(raceId, bibNumber);
      } finally {
        await this.redis.del(lockKey);
      }
    }

    // Another thread is resolving — wait 100ms then re-check cache
    await new Promise((r) => setTimeout(r, 100));
    const cached = await this.cacheService.getAthleteFromCache(raceId, bibNumber);
    if (cached) return cached;
    // Last resort — fallback ourselves (lock holder may have failed)
    return this.cacheService.resolveAthleteOnDemand(raceId, bibNumber);
  }

  /** Insert audit doc + return DTO. */
  private async recordAndReturn(input: {
    raceId: number;
    chipId: string;
    bibNumber: string | null;
    athletesId: number | null;
    result: ChipVerificationResult;
    isFirst?: boolean;
    deviceLabel?: string;
    ipAddress?: string;
    athleteSnapshot: CachedAthletePayload | null;
    courseSnapshot: string | null;
  }): Promise<ChipLookupResponseDto> {
    const verifiedAt = new Date();
    const isFirst = input.isFirst ?? false;

    await this.verificationModel.create({
      mysql_race_id: input.raceId,
      chip_id: input.chipId,
      bib_number: input.bibNumber,
      athletes_id: input.athletesId,
      result: input.result,
      is_first_verify: isFirst && input.result === 'FOUND',
      device_label: input.deviceLabel,
      ip_address: input.ipAddress,
      athlete_name_snapshot: input.athleteSnapshot?.name ?? null,
      bib_number_snapshot: input.bibNumber,
      course_name_snapshot: input.courseSnapshot,
    });

    return {
      result: input.result,
      bib_number: input.bibNumber,
      name: input.athleteSnapshot?.name ?? null,
      course_name: input.courseSnapshot,
      gender: input.athleteSnapshot?.gender ?? null,
      team: input.athleteSnapshot?.team ?? null,
      last_status: input.athleteSnapshot?.last_status ?? null,
      racekit_received: input.athleteSnapshot?.racekit_received ?? false,
      is_first_verify: isFirst && input.result === 'FOUND',
      verified_at: verifiedAt,
    };
  }

  /** Recent N verifications for kiosk history list. */
  async recent(
    raceId: number,
    limit: number,
  ): Promise<{
    items: {
      bib_number: string | null;
      name: string | null;
      course_name: string | null;
      result: ChipVerificationResult;
      verified_at: Date;
      device_label: string | null;
      is_first_verify: boolean;
    }[];
  }> {
    const cap = Math.min(Math.max(1, limit), 50);
    const docs = await this.verificationModel
      .find({ mysql_race_id: raceId })
      .sort({ verified_at: -1 })
      .limit(cap)
      .lean<
        (ChipVerification & { verified_at: Date })[]
      >()
      .exec();

    return {
      items: docs.map((d) => ({
        bib_number: d.bib_number_snapshot ?? d.bib_number ?? null,
        name: d.athlete_name_snapshot ?? null,
        course_name: d.course_name_snapshot ?? null,
        result: d.result,
        verified_at: d.verified_at,
        device_label: d.device_label ?? null,
        is_first_verify: d.is_first_verify,
      })),
    };
  }
}
