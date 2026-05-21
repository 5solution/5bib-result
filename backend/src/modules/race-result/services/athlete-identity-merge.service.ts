/**
 * FEATURE-047 RESUME (post-F-048 foundation) — Athlete Identity Merge via cluster lookup.
 *
 * **Background:** F-047 Phase 1B v1 querying `race_results.email` returned `[]`
 * forever because the field doesn't exist on the schema (Lesson #1 from defer
 * postmortem 06-defer-postmortem.md). NGUYỄN BÌNH MINH had 23 races on platform
 * but only 3 surfaced via slug-coincidence match.
 *
 * **F-048 foundation built `athlete_identity_clusters` collection** (offline cron,
 * 3-tier algorithm T1 email / T2 name+DOB+gender / T3 name+gender review / T4
 * anonymous). This service now reads cluster + joins linked race_results via
 * MySQL→MongoDB race id bridge (races.mysql_race_id, F-048 backfill).
 *
 * **Algorithm:**
 *   1. Anchor lookup: find race_result matching (bib, nameSlug) from URL slug.
 *   2. Cluster lookup: find AthleteIdentityCluster where any linkedAthleteRecord
 *      points to anchor (via mongoRaceId + mongoBib OR nameSlug fallback).
 *   3. Bridge: cluster.linkedAthleteRecords[].mysql_race_id → races.mysql_race_id
 *      → race._id (MongoDB ObjectId string) → join race_results by (raceId, bib).
 *   4. Fallback: if no cluster found (data not yet computed by F-048 cron OR T4
 *      anonymous), return anchor-only result. Caller (cron / profile service) can
 *      still surface 1 race via Phase 1A coincidence path.
 *
 * **Confidence tier handling (BR-47-CLUSTER-CONF-* from 07-resume-kickoff.md):**
 *   - T1 (email,  conf ≥0.9): expose all linked races, tier='high'.
 *   - T2 (name+dob, conf ≥0.8): expose all linked races, tier='medium'.
 *   - T3 (review_pending OR conf <0.8): expose anchor race only, tier='uncertain'.
 *   - No cluster: tier='anchor_only' (fallback coincidence path).
 *
 * **PII DEFENSE (carry-over Adjustment #10):**
 *   - SHA256 hashEmail() preserved for legacy backfill cron (canonicalEmailHash).
 *   - resolveByEmail() preserved as backward-compat shim (delegates to cluster lookup
 *     via emailHash anchor).
 *   - Raw email NEVER logged.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Model } from 'mongoose';
import Redis from 'ioredis';
import { createHash } from 'crypto';

import { RaceResult, RaceResultDocument } from '../schemas/race-result.schema';
import {
  AthleteIdentityCluster,
  AthleteIdentityClusterDocument,
} from '../../race-master-data/schemas/athlete-identity-cluster.schema';
import { Race, RaceDocument } from '../../races/schemas/race.schema';
import { slugifyVN } from '../../../common/utils/slugify';

export interface CanonicalIdentity {
  /** SHA256 hash — used as Redis cache key + legacy MongoDB index. May be empty when
   *  cluster was anchored on name+dob (T2) instead of email (T1). */
  canonicalEmailHash: string;
  /** Distinct bibs across all linked race_results. */
  linkedBibs: string[];
  /** Distinct MongoDB raceIds (ObjectId strings). */
  linkedRaceIds: string[];
  /** Linked race_result ObjectId strings (when caller wants direct join). */
  linkedRaceResultIds: string[];
  /** F-048 cluster reference — null when fallback path used (no cluster matched). */
  clusterId: string | null;
  /** F-048 source tag — 'email' | 'name+dob' | 'name+gender' | 'manual' | 'review_pending' | null */
  source:
    | 'email'
    | 'name+dob'
    | 'name+gender'
    | 'manual'
    | 'review_pending'
    | null;
  /** 0..1 from cluster, null when no cluster. */
  confidence: number | null;
  /** Display tier for frontend — see header doc. */
  tier: 'high' | 'medium' | 'uncertain' | 'anchor_only';
}

export interface ResolveBySlugInput {
  bib: string;
  nameSlug: string;
}

@Injectable()
export class AthleteIdentityMergeService {
  private readonly logger = new Logger(AthleteIdentityMergeService.name);

  private static readonly CACHE_TTL_SEC = 1800;
  private static readonly LOCK_TTL_SEC = 30;
  private static readonly CACHE_PREFIX = 'athlete:identity:';
  private static readonly LOCK_PREFIX = 'athlete:identity-lock:';

  constructor(
    @InjectModel(RaceResult.name)
    private readonly resultModel: Model<RaceResultDocument>,
    @InjectModel(AthleteIdentityCluster.name)
    private readonly clusterModel: Model<AthleteIdentityClusterDocument>,
    @InjectModel(Race.name)
    private readonly raceModel: Model<RaceDocument>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  /**
   * Carry-over from v1 — SHA256 hash for canonicalEmailHash field on
   * athlete_profiles. Backfill cron still uses this for legacy emailHash key.
   * Deterministic: same email → same hash. No salt.
   */
  hashEmail(email: string): string {
    return createHash('sha256')
      .update(email.trim().toLowerCase())
      .digest('hex');
  }

  /** Log-safe email proxy: `[emailHash:abc12345]`. */
  private emailLogProxy(emailOrHash: string): string {
    const hash =
      emailOrHash.length === 64 ? emailOrHash : this.hashEmail(emailOrHash);
    return `[emailHash:${hash.substring(0, 8)}]`;
  }

  /**
   * Backward-compat shim — resolve by email via cluster lookup using emailHash
   * anchor. Called by AthleteProfileBackfillCron when row.email is populated.
   *
   * Returns null when email empty, when no cluster matches, OR when cluster has
   * empty linkedAthleteRecords. Caller should still surface anchor-only path.
   */
  async resolveByEmail(
    email: string | null | undefined,
  ): Promise<CanonicalIdentity | null> {
    if (!email || !email.trim()) return null;

    const emailHash = this.hashEmail(email);
    const cacheKey = `${AthleteIdentityMergeService.CACHE_PREFIX}${emailHash}`;

    const cached = await this.safeRedisGet(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as CanonicalIdentity;
      } catch {
        /* fall through to compute */
      }
    }

    // SETNX lock anti-stampede
    const lockKey = `${AthleteIdentityMergeService.LOCK_PREFIX}${emailHash}`;
    const lockAcquired = await this.safeRedisSetNx(
      lockKey,
      AthleteIdentityMergeService.LOCK_TTL_SEC,
    );
    if (!lockAcquired) {
      await this.sleep(200);
      const retry = await this.safeRedisGet(cacheKey);
      if (retry) {
        try {
          return JSON.parse(retry) as CanonicalIdentity;
        } catch {
          /* compute anyway */
        }
      }
    }

    try {
      const cluster = await this.clusterModel
        .findOne({ emailHash })
        .lean<AthleteIdentityCluster>()
        .exec();
      if (!cluster) {
        this.logger.log(
          `[resolveByEmail] no cluster ${this.emailLogProxy(emailHash)}`,
        );
        return null;
      }
      const identity = await this.buildIdentityFromCluster(cluster, emailHash);
      await this.safeRedisSetEx(
        cacheKey,
        AthleteIdentityMergeService.CACHE_TTL_SEC,
        JSON.stringify(identity),
      );
      return identity;
    } catch (err) {
      this.logger.warn(
        `[resolveByEmail] failed ${this.emailLogProxy(emailHash)}: ${(err as Error).message}`,
      );
      return null;
    } finally {
      await this.safeRedisDel(lockKey);
    }
  }

  /**
   * Primary entry from F-047 profile service.
   *
   * Resolve canonical identity from URL slug (e.g. `9897-nguyen-binh-minh`).
   * Always returns a CanonicalIdentity — never null — so caller can surface
   * the anchor race even when no cluster exists yet (T4 anonymous or pre-cron
   * data). When no anchor found at all (404 path), caller should NotFoundException.
   *
   * Returns null only when no anchor race_result matches the slug (true 404).
   */
  async resolveBySlug(
    input: ResolveBySlugInput,
  ): Promise<CanonicalIdentity | null> {
    const { bib, nameSlug } = input;
    if (!bib || !nameSlug) return null;

    // Step 1 — Find anchor race_result. Bib is indexed, then filter by nameSlug.
    const candidates = await this.resultModel
      .find({ bib })
      .select({ _id: 1, raceId: 1, bib: 1, name: 1 })
      .lean<
        Array<{
          _id: { toString(): string };
          raceId: string;
          bib: string;
          name?: string;
        }>
      >()
      .exec();

    const anchors = candidates.filter(
      (r) => r.name && slugifyVN(r.name) === nameSlug,
    );

    if (anchors.length === 0) {
      return null; // true 404 — no athlete matches this slug
    }

    const anchorIds = anchors.map((a) => String(a._id));
    const anchorRaceIds = Array.from(new Set(anchors.map((a) => a.raceId)));

    // Step 2 — Cluster lookup. Strategy:
    //   Path A: any linkedAthleteRecord has (mongoRaceId, mongoBib) matching an
    //           anchor row. This is the most precise but mongoRaceId may be null
    //           when clustering cron ran before race-mysql-id-backfill.
    //   Path B: cluster.nameSlug === parsed nameSlug. Less precise but cheap.
    //   We try Path A first via direct $elemMatch then Path B fallback. Returns
    //   the first cluster found.

    const cluster = await this.findClusterForAnchor({
      anchorRaceIds,
      anchorBib: bib,
      nameSlug,
    });

    if (!cluster) {
      // Fallback — return anchor-only identity (Phase 1A behavior).
      return this.buildAnchorOnlyIdentity(anchors, anchorIds, anchorRaceIds);
    }

    return this.buildIdentityFromCluster(cluster, cluster.emailHash ?? '');
  }

  /**
   * Find cluster for an anchor.
   * Path A — match via (mongoRaceId, mongoBib) elemMatch.
   * Path B — match via nameSlug.
   */
  private async findClusterForAnchor(args: {
    anchorRaceIds: string[];
    anchorBib: string;
    nameSlug: string;
  }): Promise<AthleteIdentityCluster | null> {
    // Path A
    try {
      const byMongo = await this.clusterModel
        .findOne({
          linkedAthleteRecords: {
            $elemMatch: {
              mongoRaceId: { $in: args.anchorRaceIds },
              mongoBib: args.anchorBib,
            },
          },
        })
        .lean<AthleteIdentityCluster>()
        .exec();
      if (byMongo) return byMongo;
    } catch (err) {
      this.logger.warn(
        `[findClusterForAnchor] Path A failed: ${(err as Error).message}`,
      );
    }

    // Path B — nameSlug
    try {
      const byNameSlug = await this.clusterModel
        .findOne({ nameSlug: args.nameSlug })
        .sort({ confidence: -1 }) // prefer T1>T2>T3 when multiple
        .lean<AthleteIdentityCluster>()
        .exec();
      if (byNameSlug) return byNameSlug;
    } catch (err) {
      this.logger.warn(
        `[findClusterForAnchor] Path B failed: ${(err as Error).message}`,
      );
    }

    return null;
  }

  /**
   * Translate cluster.linkedAthleteRecords[] → MongoDB race_results.
   *
   * Steps:
   *   1. For each record, if mongoRaceId is set use it directly. Else look up
   *      via races.find({ mysql_race_id }) to bridge.
   *   2. Build (raceId, bib) pair list.
   *   3. race_results.find({ $or: pairs }) → return _ids + raceIds + bibs.
   */
  private async buildIdentityFromCluster(
    cluster: AthleteIdentityCluster,
    emailHash: string,
  ): Promise<CanonicalIdentity> {
    const linked = cluster.linkedAthleteRecords ?? [];

    // Step 1 — collect pairs (mongoRaceId, mongoBib)
    const pairs: Array<{ raceId: string; bib: string }> = [];
    const mysqlIdsToResolve = new Set<number>();

    for (const r of linked) {
      if (r.mongoRaceId && r.mongoBib) {
        pairs.push({ raceId: String(r.mongoRaceId), bib: String(r.mongoBib) });
      } else if (r.mysql_race_id && r.bib_number) {
        mysqlIdsToResolve.add(r.mysql_race_id);
      }
    }

    // Step 1b — bridge mysql_race_id → mongo race._id when needed
    if (mysqlIdsToResolve.size > 0) {
      try {
        const races = await this.raceModel
          .find({ mysql_race_id: { $in: Array.from(mysqlIdsToResolve) } })
          .select({ _id: 1, mysql_race_id: 1 })
          .lean<Array<{ _id: { toString(): string }; mysql_race_id: number }>>()
          .exec();
        const mysqlToMongoMap = new Map<number, string>();
        for (const race of races) {
          mysqlToMongoMap.set(race.mysql_race_id, String(race._id));
        }
        for (const r of linked) {
          if (
            (!r.mongoRaceId || !r.mongoBib) &&
            r.mysql_race_id &&
            r.bib_number
          ) {
            const mongoRaceId = mysqlToMongoMap.get(r.mysql_race_id);
            if (mongoRaceId) {
              pairs.push({ raceId: mongoRaceId, bib: String(r.bib_number) });
            } else {
              this.logger.warn(
                `[buildIdentityFromCluster] no race found for mysql_race_id=${r.mysql_race_id} cluster=${cluster.clusterId}`,
              );
            }
          }
        }
      } catch (err) {
        this.logger.warn(
          `[buildIdentityFromCluster] race bridge failed: ${(err as Error).message}`,
        );
      }
    }

    // Step 2 — fetch race_results by (raceId, bib) $or
    let results: Array<{
      _id: { toString(): string };
      raceId: string;
      bib: string;
    }> = [];
    if (pairs.length > 0) {
      try {
        results = await this.resultModel
          .find({ $or: pairs })
          .select({ _id: 1, raceId: 1, bib: 1 })
          .lean<
            Array<{
              _id: { toString(): string };
              raceId: string;
              bib: string;
            }>
          >()
          .exec();
      } catch (err) {
        this.logger.warn(
          `[buildIdentityFromCluster] race_results join failed: ${(err as Error).message}`,
        );
      }
    }

    const bibSet = new Set<string>();
    const raceIdSet = new Set<string>();
    const resultIdSet = new Set<string>();
    for (const r of results) {
      if (r.bib) bibSet.add(r.bib);
      if (r.raceId) raceIdSet.add(r.raceId);
      resultIdSet.add(String(r._id));
    }

    const tier = this.classifyTier(cluster);

    return {
      canonicalEmailHash: emailHash ?? cluster.emailHash ?? '',
      linkedBibs: Array.from(bibSet),
      linkedRaceIds: Array.from(raceIdSet),
      linkedRaceResultIds: Array.from(resultIdSet),
      clusterId: cluster.clusterId,
      source: cluster.source ?? null,
      confidence: cluster.confidence ?? null,
      tier,
    };
  }

  /**
   * No cluster — anchor-only fallback (Phase 1A behavior). 13% coverage but
   * surfaces at least the URL'd race instead of empty.
   */
  private buildAnchorOnlyIdentity(
    anchors: Array<{ raceId: string; bib: string }>,
    anchorIds: string[],
    anchorRaceIds: string[],
  ): CanonicalIdentity {
    const bibSet = new Set<string>();
    for (const a of anchors) if (a.bib) bibSet.add(a.bib);
    return {
      canonicalEmailHash: '',
      linkedBibs: Array.from(bibSet),
      linkedRaceIds: anchorRaceIds,
      linkedRaceResultIds: anchorIds,
      clusterId: null,
      source: null,
      confidence: null,
      tier: 'anchor_only',
    };
  }

  /**
   * Map F-048 cluster source/confidence → F-047 display tier.
   * BR-47-CLUSTER-CONF-* (kickoff 07).
   */
  private classifyTier(
    cluster: AthleteIdentityCluster,
  ): 'high' | 'medium' | 'uncertain' {
    const conf = cluster.confidence ?? 0;
    if (cluster.source === 'email' || conf >= 0.9) return 'high';
    if (cluster.source === 'name+dob' || conf >= 0.8) return 'medium';
    return 'uncertain';
  }

  /** Invalidate identity cache (called after admin moderation or active toggle). */
  async invalidateIdentityCache(emailHash: string): Promise<void> {
    try {
      await this.redis.del(
        `${AthleteIdentityMergeService.CACHE_PREFIX}${emailHash}`,
      );
    } catch (err) {
      this.logger.warn(
        `[invalidateIdentityCache] failed: ${(err as Error).message}`,
      );
    }
  }

  // ─── Redis safe wrappers ──────────────────────────────────────────────

  private async safeRedisGet(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (err) {
      this.logger.warn(`[redis.get] failed: ${(err as Error).message}`);
      return null;
    }
  }

  private async safeRedisSetEx(
    key: string,
    ttl: number,
    value: string,
  ): Promise<void> {
    try {
      await this.redis.setex(key, ttl, value);
    } catch (err) {
      this.logger.warn(`[redis.setex] failed: ${(err as Error).message}`);
    }
  }

  private async safeRedisSetNx(key: string, ttl: number): Promise<boolean> {
    try {
      const res = await this.redis.set(key, '1', 'EX', ttl, 'NX');
      return res === 'OK';
    } catch (err) {
      this.logger.warn(`[redis.setnx] failed: ${(err as Error).message}`);
      return false;
    }
  }

  private async safeRedisDel(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (err) {
      this.logger.warn(`[redis.del] failed: ${(err as Error).message}`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
