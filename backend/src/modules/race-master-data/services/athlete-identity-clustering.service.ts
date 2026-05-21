/**
 * FEATURE-048 Phase 2 — Athlete Identity Clustering 3-tier algorithm.
 *
 * BR-48-11/12: Pre-computed offline cron builds athlete_identity_clusters
 * collection. F-047 reads cluster lookup instead of bib+slug coincidence match.
 *
 * Algorithm tiers (PRD spec):
 *   T1 emailHash exact      → 1.0 auto-merge (strongest signal)
 *   T2 nameSlug+dobYear+gender → 0.85 auto-merge (rare collision)
 *   T3 nameSlug+gender only → 0.6 manual review queue
 *   T4 anonymous            → 0.0 single-race scope (no cross-race merge)
 *
 * PII DEFENSE (BR-48-15):
 *   - emailHash SHA256 only — raw email NEVER stored in cluster doc
 *   - Logger output `[emailHash:abc12345]` proxy (NO raw `@` chars)
 *   - moderatedBy is admin Logto sub (NOT email)
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type Redis from 'ioredis';
import { Model, Types } from 'mongoose';
import { createHash, randomUUID } from 'crypto';

import {
  AthleteIdentityCluster,
  AthleteIdentityClusterDocument,
  LinkedAthleteRecord,
} from '../schemas/athlete-identity-cluster.schema';
import {
  RaceAthlete,
  RaceAthleteDocument,
} from '../schemas/race-athlete.schema';
import { Race, RaceDocument } from '../../races/schemas/race.schema';

/**
 * F-049 — Enriched linked record with raceName + bibNumber.
 * Optional fields: undefined when lookup miss (orphan record, race deleted, etc).
 */
export interface EnrichedLinkedAthleteRecord extends LinkedAthleteRecord {
  raceName?: string;
  bibNumber?: string;
}

/**
 * F-049 — Plain (lean) cluster shape accepted by enrichment helper.
 * Mirrors the lean() return — KHÔNG dùng HydratedDocument để tránh as-cast.
 */
export interface LeanClusterForEnrichment {
  clusterId: string;
  emailHash?: string | null;
  nameSlug?: string | null;
  dobYear?: number | null;
  genderNormalized?: 'male' | 'female' | 'other' | null;
  confidence: number;
  source: string;
  linkedAthleteRecords: LinkedAthleteRecord[];
  moderatedBy?: string | null;
  moderatedAt?: Date | null;
  splitFromClusterId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  /** Allow passthrough for Mongo `_id` / `__v` (controllers may strip later). */
  [extra: string]: unknown;
}

/** F-049 — Cluster view enriched at service-return layer (NO schema change). */
export interface EnrichedClusterView
  extends Omit<LeanClusterForEnrichment, 'linkedAthleteRecords'> {
  linkedAthleteRecords: EnrichedLinkedAthleteRecord[];
}

export interface ClusteringRunReport {
  athletesProcessed: number;
  clustersCreated: number;
  clustersUpdated: number;
  tierBreakdown: {
    t1_email: number;
    t2_name_dob_gender: number;
    t3_name_gender: number;
    t4_anonymous: number;
  };
  durationMs: number;
  errors: number;
}

interface AthleteRowWithPii {
  _id: Types.ObjectId;
  mysql_race_id: number;
  athletes_id: number;
  bib_number: string | null;
  full_name: string | null;
  email: string | null;
  ageOnRaceDay: number | null;
  gender: string | null;
}

@Injectable()
export class AthleteIdentityClusteringService {
  private readonly logger = new Logger(AthleteIdentityClusteringService.name);

  constructor(
    @InjectModel(AthleteIdentityCluster.name)
    private readonly clusterModel: Model<AthleteIdentityClusterDocument>,
    @InjectModel(RaceAthlete.name)
    private readonly athleteModel: Model<RaceAthleteDocument>,
    // F-049 — optional Race model + Redis for race-name enrichment.
    // @Optional so unit tests not requiring enrichment can skip these deps.
    @Optional()
    @InjectModel(Race.name)
    private readonly raceModel?: Model<RaceDocument>,
    @Optional()
    @InjectRedis()
    private readonly redis?: Redis,
  ) {}

  /**
   * F-049 — TTL for races:title:byMysqlId:<id> cache. 1h = race title rarely changes.
   */
  private readonly RACE_TITLE_TTL_SEC = 3600;

  /**
   * BR-48-15 Adjustment #10 — SHA256 hash email. Deterministic, case-insensitive.
   */
  hashEmail(email: string): string {
    return createHash('sha256')
      .update(email.trim().toLowerCase())
      .digest('hex');
  }

  /** Log-safe email proxy: `[emailHash:abc12345]` (8-char prefix only). */
  private emailLogProxy(emailOrHash: string): string {
    const hash =
      emailOrHash.length === 64 ? emailOrHash : this.hashEmail(emailOrHash);
    return `[emailHash:${hash.substring(0, 8)}]`;
  }

  /** Slugify VN name for clustering — lowercase + diacritic strip + hyphen. */
  slugifyName(name: string): string {
    return name
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');
  }

  /** Normalize gender from VN/EN variants to canonical 'male' | 'female' | 'other' | null. */
  normalizeGender(g: string | null): 'male' | 'female' | 'other' | null {
    if (!g) return null;
    const lower = g.toLowerCase().trim();
    if (lower === 'm' || lower === 'male' || lower === 'nam') return 'male';
    if (lower === 'f' || lower === 'female' || lower === 'nu' || lower === 'nữ')
      return 'female';
    return 'other';
  }

  /**
   * 3-tier algorithm: classify one athlete row → cluster anchor + confidence.
   * Returns null when no anchor available (T4 anonymous handled by caller).
   */
  classifyAthlete(row: AthleteRowWithPii): {
    tier: 't1_email' | 't2_name_dob_gender' | 't3_name_gender' | 't4_anonymous';
    confidence: number;
    source: 'email' | 'name+dob' | 'name+gender' | 'review_pending';
    anchors: {
      emailHash?: string;
      nameSlug?: string;
      dobYear?: number;
      genderNormalized?: 'male' | 'female' | 'other' | null;
    };
  } {
    const gender = this.normalizeGender(row.gender);
    const nameSlug = row.full_name
      ? this.slugifyName(row.full_name)
      : undefined;

    // T1 — email exact (strongest)
    if (row.email && row.email.trim()) {
      return {
        tier: 't1_email',
        confidence: 1.0,
        source: 'email',
        anchors: {
          emailHash: this.hashEmail(row.email),
          nameSlug,
          dobYear: row.ageOnRaceDay ? this.estimateDobYear(row) : undefined,
          genderNormalized: gender,
        },
      };
    }

    // T2 — name + dobYear + gender
    if (nameSlug && row.ageOnRaceDay && gender) {
      return {
        tier: 't2_name_dob_gender',
        confidence: 0.85,
        source: 'name+dob',
        anchors: {
          nameSlug,
          dobYear: this.estimateDobYear(row),
          genderNormalized: gender,
        },
      };
    }

    // T3 — name + gender (weakest auto, → review queue)
    if (nameSlug && gender) {
      return {
        tier: 't3_name_gender',
        confidence: 0.6,
        source: 'review_pending',
        anchors: { nameSlug, genderNormalized: gender },
      };
    }

    // T4 — anonymous (no anchors strong enough for cross-race merge)
    return {
      tier: 't4_anonymous',
      confidence: 0.0,
      source: 'review_pending',
      anchors: {},
    };
  }

  /**
   * F-019 v2 privacy pattern — derive dobYear from ageOnRaceDay (already computed).
   * race_athletes.ageOnRaceDay is integer years. Assume race day ~ now() ± 1 year.
   */
  private estimateDobYear(row: AthleteRowWithPii): number {
    const nowYear = new Date().getFullYear();
    return nowYear - (row.ageOnRaceDay ?? 0);
  }

  /**
   * Find existing cluster matching anchors. Returns null if none → caller creates new.
   * Anchor priority: emailHash > (nameSlug + dobYear + gender) > (nameSlug + gender).
   */
  async findExistingCluster(anchors: {
    emailHash?: string;
    nameSlug?: string;
    dobYear?: number;
    genderNormalized?: 'male' | 'female' | 'other' | null;
  }): Promise<AthleteIdentityClusterDocument | null> {
    if (anchors.emailHash) {
      const byEmail = await this.clusterModel
        .findOne({ emailHash: anchors.emailHash })
        .exec();
      if (byEmail) return byEmail;
    }
    if (anchors.nameSlug && anchors.dobYear && anchors.genderNormalized) {
      const byNameDob = await this.clusterModel
        .findOne({
          nameSlug: anchors.nameSlug,
          dobYear: anchors.dobYear,
          genderNormalized: anchors.genderNormalized,
          // Exclude clusters that already have emailHash to prevent overriding T1
          emailHash: null,
        })
        .exec();
      if (byNameDob) return byNameDob;
    }
    return null;
  }

  /**
   * Process single athlete row → upsert cluster + append linkedAthleteRecord.
   * Idempotent — same athlete row processed twice doesn't duplicate.
   */
  async upsertAthleteIntoCluster(
    row: AthleteRowWithPii,
  ): Promise<{ clusterId: string; created: boolean; tier: string }> {
    const classification = this.classifyAthlete(row);
    const linkedRecord: LinkedAthleteRecord = {
      mysql_race_id: row.mysql_race_id,
      athletes_id: row.athletes_id,
      bib_number: row.bib_number,
      mongoRaceId: null, // populated when race-master-data has mongo mapping
      mongoBib: row.bib_number,
      fullName: row.full_name,
    };

    // T4 anonymous — create single-record cluster (no merge possible)
    if (classification.tier === 't4_anonymous') {
      const newClusterId = randomUUID();
      await this.clusterModel.create({
        clusterId: newClusterId,
        emailHash: null,
        nameSlug: null,
        dobYear: null,
        genderNormalized: null,
        linkedAthleteRecords: [linkedRecord],
        confidence: 0.0,
        source: 'review_pending',
      });
      return { clusterId: newClusterId, created: true, tier: 't4_anonymous' };
    }

    // Lookup existing cluster matching anchors
    const existing = await this.findExistingCluster(classification.anchors);

    if (existing) {
      // Append linked record if not already present (idempotent)
      const dupeIndex = existing.linkedAthleteRecords.findIndex(
        (r) =>
          r.mysql_race_id === row.mysql_race_id &&
          r.athletes_id === row.athletes_id,
      );
      if (dupeIndex >= 0) {
        // Already present — update fullName/bib in case changed
        existing.linkedAthleteRecords[dupeIndex] = linkedRecord;
      } else {
        existing.linkedAthleteRecords.push(linkedRecord);
      }
      await existing.save();
      return {
        clusterId: existing.clusterId,
        created: false,
        tier: classification.tier,
      };
    }

    // Create new cluster
    const newClusterId = randomUUID();
    await this.clusterModel.create({
      clusterId: newClusterId,
      emailHash: classification.anchors.emailHash ?? null,
      nameSlug: classification.anchors.nameSlug ?? null,
      dobYear: classification.anchors.dobYear ?? null,
      genderNormalized: classification.anchors.genderNormalized ?? null,
      linkedAthleteRecords: [linkedRecord],
      confidence: classification.confidence,
      source: classification.source,
    });

    if (classification.anchors.emailHash) {
      this.logger.log(
        `[cluster.create] tier=${classification.tier} ${this.emailLogProxy(classification.anchors.emailHash)} clusterId=${newClusterId}`,
      );
    }

    return {
      clusterId: newClusterId,
      created: true,
      tier: classification.tier,
    };
  }

  /**
   * Full clustering run — process all race_athletes batch by batch.
   * Uses cursor for resume (BR-48-13 — Phase 1B cron will wrap with SETNX lock).
   *
   * @param batchSize default 1000
   * @param resumeCursor MongoDB ObjectId — skip rows ≤ cursor
   * @param maxBatches safety cap to prevent runaway
   */
  async runFullClustering(
    options: {
      batchSize?: number;
      resumeCursor?: string;
      maxBatches?: number;
    } = {},
  ): Promise<ClusteringRunReport> {
    const t0 = Date.now();
    const batchSize = options.batchSize ?? 1000;
    const maxBatches = options.maxBatches ?? 200; // cap 200K athletes per run

    const report: ClusteringRunReport = {
      athletesProcessed: 0,
      clustersCreated: 0,
      clustersUpdated: 0,
      tierBreakdown: {
        t1_email: 0,
        t2_name_dob_gender: 0,
        t3_name_gender: 0,
        t4_anonymous: 0,
      },
      durationMs: 0,
      errors: 0,
    };

    let cursor: Types.ObjectId | null = options.resumeCursor
      ? new Types.ObjectId(options.resumeCursor)
      : null;
    let batchCount = 0;

    while (batchCount < maxBatches) {
      const query: Record<string, unknown> = {};
      if (cursor) query._id = { $gt: cursor };

      // .select('+email +contact_phone +id_number') — PII admin context
      const batch = await this.athleteModel
        .find(query)
        .select('+email +contact_phone +id_number')
        .sort({ _id: 1 })
        .limit(batchSize)
        .lean<AthleteRowWithPii[]>()
        .exec();

      if (batch.length === 0) break;

      for (const row of batch) {
        try {
          const result = await this.upsertAthleteIntoCluster(row);
          report.athletesProcessed++;
          if (result.created) report.clustersCreated++;
          else report.clustersUpdated++;
          const tierKey = result.tier as keyof typeof report.tierBreakdown;
          report.tierBreakdown[tierKey]++;
        } catch (err) {
          report.errors++;
          this.logger.warn(
            `[clustering] row failed athletes_id=${row.athletes_id}: ${(err as Error).message}`,
          );
        }
      }

      cursor = batch[batch.length - 1]._id;
      batchCount++;
    }

    report.durationMs = Date.now() - t0;
    this.logger.log(
      `[clustering] complete processed=${report.athletesProcessed} created=${report.clustersCreated} updated=${report.clustersUpdated} errors=${report.errors} duration=${report.durationMs}ms`,
    );
    return report;
  }

  /**
   * BR-48-16/17/18 — Admin operations
   */

  async listClusters(opts: {
    page?: number;
    limit?: number;
    source?: string;
    maxConfidence?: number;
    minLinkedRaces?: number;
    q?: string; // nameSlug search
  }): Promise<{ items: EnrichedClusterView[]; total: number }> {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const filter: Record<string, unknown> = {};
    if (opts.source) filter.source = opts.source;
    if (opts.maxConfidence !== undefined)
      filter.confidence = { $lte: opts.maxConfidence };
    if (opts.minLinkedRaces !== undefined && opts.minLinkedRaces > 0) {
      filter[`linkedAthleteRecords.${opts.minLinkedRaces - 1}`] = {
        $exists: true,
      };
    }
    if (opts.q) filter.nameSlug = { $regex: opts.q, $options: 'i' };

    const [items, total] = await Promise.all([
      this.clusterModel
        .find(filter)
        .sort({ confidence: 1, updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<LeanClusterForEnrichment[]>()
        .exec(),
      this.clusterModel.countDocuments(filter),
    ]);
    // F-049 — enrich with raceName + bibNumber (single $in aggregation per page)
    const enriched = await this.enrichClustersWithRaceContext(items);
    return { items: enriched, total };
  }

  async getCluster(clusterId: string): Promise<EnrichedClusterView | null> {
    const cluster = await this.clusterModel
      .findOne({ clusterId })
      .lean<LeanClusterForEnrichment>()
      .exec();
    if (!cluster) return null;
    // F-049 — enrich single cluster
    const [enriched] = await this.enrichClustersWithRaceContext([cluster]);
    return enriched ?? null;
  }

  /**
   * F-049 — Enrich clusters with `raceName` + `bibNumber` via single `$in`
   * aggregation per page (NOT N+1 per linked record).
   *
   * Race title: Redis cache `races:title:byMysqlId:<id>` TTL 3600s → fallback MongoDB.
   * Bib number: composite key (mysql_race_id, athletes_id) → MongoDB race_athletes.
   *
   * Performance contract (BR-49-13):
   *   - cold cache: 1 raceModel.find() + 1 athleteModel.find() per page
   *   - warm cache: 0 raceModel.find() + 1 athleteModel.find() per page
   *
   * Graceful degrade (BR-49-07 + TC-49-03): if lookup misses, raceName/bibNumber
   * stay undefined — NO throw, NO 500.
   */
  async enrichClustersWithRaceContext(
    clusters: LeanClusterForEnrichment[],
  ): Promise<EnrichedClusterView[]> {
    if (clusters.length === 0) return [];

    // Collect unique mysql_race_ids + composite keys
    const allMysqlRaceIds: number[] = [];
    const seenRaceIds = new Set<number>();
    const compositeKeys: Array<{
      mysql_race_id: number;
      athletes_id: number;
    }> = [];

    for (const c of clusters) {
      for (const r of c.linkedAthleteRecords ?? []) {
        if (!seenRaceIds.has(r.mysql_race_id)) {
          seenRaceIds.add(r.mysql_race_id);
          allMysqlRaceIds.push(r.mysql_race_id);
        }
        compositeKeys.push({
          mysql_race_id: r.mysql_race_id,
          athletes_id: r.athletes_id,
        });
      }
    }

    // Parallel: race-title lookup + bib lookup
    const [raceTitleMap, bibMap] = await Promise.all([
      this.getRaceTitlesByMysqlIds(allMysqlRaceIds),
      this.getBibsByCompositeKeys(compositeKeys),
    ]);

    // Spread pattern to preserve all existing fields (CLAUDE.md hand-pick audit safety)
    return clusters.map<EnrichedClusterView>((c) => ({
      ...c,
      linkedAthleteRecords: (c.linkedAthleteRecords ?? []).map(
        (r): EnrichedLinkedAthleteRecord => ({
          ...r,
          raceName: raceTitleMap.get(r.mysql_race_id),
          bibNumber:
            bibMap.get(`${r.mysql_race_id}:${r.athletes_id}`) ??
            r.bib_number ??
            undefined,
        }),
      ),
    }));
  }

  /**
   * F-049 — Batch race-title lookup with Redis cache layer.
   *
   * Cache key: `races:title:byMysqlId:<mysql_race_id>` TTL 3600s.
   * Try/catch Redis fail → fallback MongoDB query (graceful).
   */
  async getRaceTitlesByMysqlIds(
    mysqlRaceIds: number[],
  ): Promise<Map<number, string>> {
    const result = new Map<number, string>();
    if (mysqlRaceIds.length === 0) return result;
    if (!this.raceModel) return result; // no race model wired → graceful empty

    const uncached: number[] = [];

    // Phase 1: try Redis cache (mget for batch)
    if (this.redis) {
      try {
        const cacheKeys = mysqlRaceIds.map(
          (id) => `races:title:byMysqlId:${id}`,
        );
        const cached = await this.redis.mget(...cacheKeys);
        cached.forEach((val, idx) => {
          const id = mysqlRaceIds[idx];
          if (val) {
            result.set(id, val);
          } else {
            uncached.push(id);
          }
        });
      } catch (err) {
        // Redis down → all uncached
        this.logger.warn(
          `[F-049 cache] Redis mget fail: ${(err as Error).message} — fallback Mongo`,
        );
        uncached.push(...mysqlRaceIds);
      }
    } else {
      uncached.push(...mysqlRaceIds);
    }

    // Phase 2: MongoDB single $in query for cache-miss IDs
    if (uncached.length > 0) {
      const races = await this.raceModel
        .find({ mysql_race_id: { $in: uncached } })
        .select('mysql_race_id title')
        .lean()
        .exec();

      // Populate result + write-back to Redis (best-effort)
      const writePromises: Promise<unknown>[] = [];
      for (const race of races) {
        if (race.mysql_race_id == null) continue;
        const title = race.title;
        result.set(race.mysql_race_id, title);
        if (this.redis) {
          writePromises.push(
            this.redis
              .setex(
                `races:title:byMysqlId:${race.mysql_race_id}`,
                this.RACE_TITLE_TTL_SEC,
                title,
              )
              .catch((err: Error) => {
                this.logger.warn(
                  `[F-049 cache] Redis setex fail for ${race.mysql_race_id}: ${err.message}`,
                );
              }),
          );
        }
      }
      // Log missing (orphan) ids — TC-49-03
      const foundIds = new Set(races.map((r) => r.mysql_race_id));
      for (const id of uncached) {
        if (!foundIds.has(id)) {
          this.logger.warn(
            `[F-049] Race not found for mysql_race_id=${id} — raceName undefined`,
          );
        }
      }
      // Fire and forget — don't block response on Redis writes
      await Promise.allSettled(writePromises);
    }

    return result;
  }

  /**
   * F-049 — Batch bib-number lookup by (mysql_race_id, athletes_id) composite.
   *
   * Single `$or` MongoDB query on race_athletes. Returns Map keyed
   * `${mysql_race_id}:${athletes_id}` → bib_number string.
   *
   * No cache layer (bib_number changes rarely but race_athletes already cached
   * by RaceMasterCacheService; admin read path acceptable direct query).
   */
  async getBibsByCompositeKeys(
    keys: Array<{ mysql_race_id: number; athletes_id: number }>,
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (keys.length === 0) return result;

    // Dedupe composite keys before query
    const uniqueKeys = new Map<
      string,
      { mysql_race_id: number; athletes_id: number }
    >();
    for (const k of keys) {
      uniqueKeys.set(`${k.mysql_race_id}:${k.athletes_id}`, k);
    }

    // Group athletes_ids by mysql_race_id for narrower $in queries
    const byRaceId = new Map<number, number[]>();
    for (const k of uniqueKeys.values()) {
      const arr = byRaceId.get(k.mysql_race_id) ?? [];
      arr.push(k.athletes_id);
      byRaceId.set(k.mysql_race_id, arr);
    }

    // Single $or aggregation: each clause is (mysql_race_id, athletes_id $in [...])
    const orClauses = Array.from(byRaceId.entries()).map(
      ([mysql_race_id, athletes_ids]) => ({
        mysql_race_id,
        athletes_id: { $in: athletes_ids },
      }),
    );

    const docs = await this.athleteModel
      .find({ $or: orClauses })
      .select('mysql_race_id athletes_id bib_number')
      .lean()
      .exec();

    for (const d of docs) {
      if (d.bib_number) {
        result.set(`${d.mysql_race_id}:${d.athletes_id}`, d.bib_number);
      }
    }

    return result;
  }

  /**
   * BR-48-17 Admin merge — combine N clusters into target.
   * Atomic via `findOneAndUpdate` precondition check.
   */
  async mergeClusters(
    targetClusterId: string,
    additionalClusterIds: string[],
    reason: string,
    adminSub: string,
  ): Promise<AthleteIdentityClusterDocument> {
    const target = await this.clusterModel
      .findOne({ clusterId: targetClusterId })
      .exec();
    if (!target) throw new Error('Target cluster not found');

    const additional = await this.clusterModel
      .find({ clusterId: { $in: additionalClusterIds } })
      .exec();
    if (additional.length !== additionalClusterIds.length) {
      throw new Error('One or more additional clusters not found');
    }

    // Merge linkedAthleteRecords with dedupe by (mysql_race_id, athletes_id)
    const seen = new Set<string>();
    for (const r of target.linkedAthleteRecords) {
      seen.add(`${r.mysql_race_id}|${r.athletes_id}`);
    }
    for (const c of additional) {
      for (const r of c.linkedAthleteRecords) {
        const k = `${r.mysql_race_id}|${r.athletes_id}`;
        if (!seen.has(k)) {
          target.linkedAthleteRecords.push(r);
          seen.add(k);
        }
      }
    }
    target.source = 'manual';
    target.confidence = Math.max(target.confidence, 0.95); // manual merge confidence boost
    target.moderatedBy = adminSub;
    target.moderatedAt = new Date();
    await target.save();

    // Delete merged clusters
    await this.clusterModel.deleteMany({
      clusterId: { $in: additionalClusterIds },
    });

    this.logger.log(
      `[cluster.merge] target=${targetClusterId} mergedCount=${additionalClusterIds.length} admin=${adminSub} reason="${reason}"`,
    );
    return target;
  }

  /**
   * BR-48-18 Admin split — extract athletes_ids to NEW cluster.
   */
  async splitCluster(
    sourceClusterId: string,
    extractAthleteIds: number[],
    reason: string,
    adminSub: string,
  ): Promise<{
    sourceClusterId: string;
    newClusterId: string;
    extractedCount: number;
    remainingCount: number;
  }> {
    const source = await this.clusterModel
      .findOne({ clusterId: sourceClusterId })
      .exec();
    if (!source) throw new Error('Source cluster not found');

    const extracted: LinkedAthleteRecord[] = [];
    const remaining: LinkedAthleteRecord[] = [];
    for (const r of source.linkedAthleteRecords) {
      if (extractAthleteIds.includes(r.athletes_id)) {
        extracted.push(r);
      } else {
        remaining.push(r);
      }
    }

    if (extracted.length === 0) {
      throw new Error('No athletes_ids matched in source cluster');
    }

    const newClusterId = randomUUID();
    await this.clusterModel.create({
      clusterId: newClusterId,
      emailHash: null, // split clusters lose anchor (admin re-classifies)
      nameSlug: source.nameSlug,
      dobYear: source.dobYear,
      genderNormalized: source.genderNormalized,
      linkedAthleteRecords: extracted,
      confidence: 0.9, // manual split confidence
      source: 'manual',
      moderatedBy: adminSub,
      moderatedAt: new Date(),
      splitFromClusterId: sourceClusterId,
    });

    source.linkedAthleteRecords = remaining;
    source.moderatedBy = adminSub;
    source.moderatedAt = new Date();
    await source.save();

    this.logger.log(
      `[cluster.split] source=${sourceClusterId} new=${newClusterId} extracted=${extracted.length} admin=${adminSub} reason="${reason}"`,
    );

    return {
      sourceClusterId,
      newClusterId,
      extractedCount: extracted.length,
      remainingCount: remaining.length,
    };
  }

  /**
   * BR-48-19 Coverage stats endpoint.
   */
  async getCoverageStats(): Promise<{
    totalClusters: number;
    byTier: {
      t1_email: number;
      t2_name_dob_gender: number;
      t3_name_gender: number;
      t4_anonymous: number;
    };
    reviewQueueDepth: number;
    avgRacesPerCluster: number;
    lastClusteringRun: Date | null;
  }> {
    const [totalClusters, t1, t2, t3, t4, reviewQueue, latestCluster] =
      await Promise.all([
        this.clusterModel.countDocuments({}),
        this.clusterModel.countDocuments({ source: 'email' }),
        this.clusterModel.countDocuments({ source: 'name+dob' }),
        this.clusterModel.countDocuments({
          source: 'name+gender',
        }),
        this.clusterModel.countDocuments({
          source: 'review_pending',
          confidence: 0,
        }),
        this.clusterModel.countDocuments({ source: 'review_pending' }),
        this.clusterModel
          .findOne({})
          .sort({ updatedAt: -1 })
          .select('updatedAt')
          .lean()
          .exec(),
      ]);

    // Avg races per cluster — small dataset acceptable to load all
    const all = await this.clusterModel
      .find({})
      .select('linkedAthleteRecords')
      .lean()
      .exec();
    const totalRecords = all.reduce(
      (sum, c) => sum + (c.linkedAthleteRecords?.length ?? 0),
      0,
    );
    const avgRacesPerCluster =
      totalClusters > 0 ? totalRecords / totalClusters : 0;

    return {
      totalClusters,
      byTier: {
        t1_email: t1,
        t2_name_dob_gender: t2,
        t3_name_gender: t3,
        t4_anonymous: t4,
      },
      reviewQueueDepth: reviewQueue,
      avgRacesPerCluster: Number(avgRacesPerCluster.toFixed(2)),
      lastClusteringRun: latestCluster?.updatedAt ?? null,
    };
  }
}
