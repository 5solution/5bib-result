/**
 * FEATURE-048 BR-48-01..04 — Backfill `races.mysql_race_id` via hybrid 2-tier matching.
 *
 * **CRITICAL PAUSE POINT #1 (Manager Plan):** Coder MUST run dry-run mode FIRST,
 * output CSV report → Danny + Manager review → only then `--apply` flag.
 *
 * Algorithm (Manager Adjustment #3 — Option A: import RaceReadonly from promo-hub):
 *   - **Tier 1:** MongoDB `races.slug` ↔ MySQL `races.url_name` exact match
 *     → confidence 1.0, auto-populate
 *   - **Tier 2:** Fuzzy slug similarity ≥0.85 + endDate ±7 days
 *     → confidence 0.85, auto-populate
 *   - **Tier 3:** Below 0.85 confidence → manual review queue (returned in response)
 *
 * Target coverage: ≥52/54 MongoDB races mapped (>96%, BR-48-04).
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRepository } from '@nestjs/typeorm';
import { Model } from 'mongoose';
import { Repository } from 'typeorm';

import { Race, RaceDocument } from '../../races/schemas/race.schema';
import { RaceReadonly } from '../../promo-hub/entities/race-readonly.entity';

export type MatchTier = 'tier1_exact' | 'tier2_fuzzy' | 'tier3_manual' | 'no_match';

export interface RaceMatchResult {
  mongoRaceId: string;
  mongoSlug: string;
  mongoTitle: string;
  mongoEndDate?: Date;
  mysqlRaceId?: number;
  mysqlUrlName?: string;
  mysqlEventEndDate?: Date;
  mysqlTitle?: string;
  tier: MatchTier;
  confidence: number;
  reason: string;
}

export interface BackfillReport {
  totalMongoRaces: number;
  totalMysqlRaces: number;
  tier1Matched: number;
  tier2Matched: number;
  tier3Manual: number;
  noMatch: number;
  appliedUpdates: number;
  dryRun: boolean;
  results: RaceMatchResult[];
}

@Injectable()
export class RaceMysqlIdBackfillService {
  private readonly logger = new Logger(RaceMysqlIdBackfillService.name);

  private static readonly FUZZY_SIMILARITY_THRESHOLD = 0.85;
  private static readonly END_DATE_TOLERANCE_DAYS = 7;

  constructor(
    @InjectModel(Race.name)
    private readonly raceModel: Model<RaceDocument>,
    @InjectRepository(RaceReadonly, 'platform')
    private readonly mysqlRaceRepo: Repository<RaceReadonly>,
  ) {}

  /**
   * BR-48-02 — Hybrid 2-tier matching migration.
   *
   * @param dryRun true = compute matches only, NO MongoDB writes (PAUSE point review)
   *              false = apply matches to MongoDB races.mysql_race_id
   */
  async runBackfill(dryRun: boolean): Promise<BackfillReport> {
    const startedAt = Date.now();
    this.logger.log(`[backfill] starting dryRun=${dryRun}`);

    // Load all MongoDB races (54 estimated)
    const mongoRaces = await this.raceModel
      .find({
        // Already mapped + soft-deleted excluded
        $or: [{ mysql_race_id: { $exists: false } }, { mysql_race_id: null }],
        deletedAt: { $exists: false },
      })
      .select({ _id: 1, slug: 1, title: 1, endDate: 1, mysql_race_id: 1 })
      .lean()
      .exec();

    // Load all MySQL races with url_name + event_end_date
    const mysqlRaces = await this.mysqlRaceRepo.find({
      // TypeORM select uses entity property names (not column names)
      where: {},
      take: 500,
    });

    this.logger.log(
      `[backfill] mongo=${mongoRaces.length} mysql=${mysqlRaces.length}`,
    );

    // Build lookup maps
    // F-048 fix 2026-05-20 — PROD verify: url_name often NULL in MySQL (96% NULL).
    // Title match works 96.6% exact (58/60 PROD races). Prioritize title over url_name.
    const mysqlByUrlName = new Map<string, RaceReadonly>();
    const mysqlByTitle = new Map<string, RaceReadonly>();
    for (const m of mysqlRaces) {
      if (m.urlName) {
        mysqlByUrlName.set(m.urlName.trim().toLowerCase(), m);
      }
      if (m.title) {
        mysqlByTitle.set(m.title.trim().toLowerCase(), m);
      }
    }

    const results: RaceMatchResult[] = [];
    let tier1Matched = 0;
    let tier2Matched = 0;
    let tier3Manual = 0;
    let noMatch = 0;
    let appliedUpdates = 0;

    for (const mongo of mongoRaces) {
      const slug = (mongo.slug ?? '').trim().toLowerCase();
      const title = (mongo.title ?? '').trim().toLowerCase();

      // ── Tier 1a: exact title ↔ MySQL title match (PRIMARY — PROD verified 96.6% coverage) ──
      if (title) {
        const titleMatch = mysqlByTitle.get(title);
        if (titleMatch) {
          const result: RaceMatchResult = {
            mongoRaceId: String(mongo._id),
            mongoSlug: slug,
            mongoTitle: mongo.title ?? '',
            mongoEndDate: mongo.endDate,
            mysqlRaceId: Number(titleMatch.raceId),
            mysqlUrlName: titleMatch.urlName ?? undefined,
            mysqlEventEndDate: titleMatch.eventEndDate ?? undefined,
            mysqlTitle: titleMatch.title ?? undefined,
            tier: 'tier1_exact',
            confidence: 1.0,
            reason: `title exact match (url_name often NULL in MySQL)`,
          };
          results.push(result);
          tier1Matched++;

          if (!dryRun) {
            await this.raceModel.updateOne(
              { _id: mongo._id },
              { $set: { mysql_race_id: Number(titleMatch.raceId) } },
            );
            appliedUpdates++;
          }
          continue;
        }
      }

      if (!slug) {
        results.push({
          mongoRaceId: String(mongo._id),
          mongoSlug: '',
          mongoTitle: mongo.title ?? '',
          mongoEndDate: mongo.endDate,
          tier: 'no_match',
          confidence: 0,
          reason: 'MongoDB race has empty slug and no title match',
        });
        noMatch++;
        continue;
      }

      // ── Tier 1b: exact slug ↔ url_name match (fallback when url_name populated) ──
      const exactMatch = mysqlByUrlName.get(slug);
      if (exactMatch) {
        const result: RaceMatchResult = {
          mongoRaceId: String(mongo._id),
          mongoSlug: slug,
          mongoTitle: mongo.title ?? '',
          mongoEndDate: mongo.endDate,
          mysqlRaceId: Number(exactMatch.raceId),
          mysqlUrlName: exactMatch.urlName ?? undefined,
          mysqlEventEndDate: exactMatch.eventEndDate ?? undefined,
          mysqlTitle: exactMatch.title ?? undefined,
          tier: 'tier1_exact',
          confidence: 1.0,
          reason: `slug='${slug}' exact match url_name`,
        };
        results.push(result);
        tier1Matched++;

        if (!dryRun) {
          await this.raceModel.updateOne(
            { _id: mongo._id },
            { $set: { mysql_race_id: Number(exactMatch.raceId) } },
          );
          appliedUpdates++;
        }
        continue;
      }

      // ── Tier 2: fuzzy slug similarity ≥0.85 + endDate ±7d ─────────────
      const tier2 = this.findTier2Match(slug, mongo.endDate, mysqlRaces);
      if (tier2) {
        const result: RaceMatchResult = {
          mongoRaceId: String(mongo._id),
          mongoSlug: slug,
          mongoTitle: mongo.title ?? '',
          mongoEndDate: mongo.endDate,
          mysqlRaceId: Number(tier2.mysql.raceId),
          mysqlUrlName: tier2.mysql.urlName ?? undefined,
          mysqlEventEndDate: tier2.mysql.eventEndDate ?? undefined,
          mysqlTitle: tier2.mysql.title ?? undefined,
          tier: 'tier2_fuzzy',
          confidence: 0.85,
          reason: `slug similarity=${tier2.similarity.toFixed(3)} + endDate diff=${tier2.endDateDiffDays}d`,
        };
        results.push(result);
        tier2Matched++;

        if (!dryRun) {
          await this.raceModel.updateOne(
            { _id: mongo._id },
            { $set: { mysql_race_id: Number(tier2.mysql.raceId) } },
          );
          appliedUpdates++;
        }
        continue;
      }

      // ── Tier 3: manual review queue ───────────────────────────────────
      const candidates = this.findTier3Candidates(slug, mongo.endDate, mysqlRaces);
      if (candidates.length > 0) {
        results.push({
          mongoRaceId: String(mongo._id),
          mongoSlug: slug,
          mongoTitle: mongo.title ?? '',
          mongoEndDate: mongo.endDate,
          tier: 'tier3_manual',
          confidence: candidates[0].similarity,
          reason: `${candidates.length} fuzzy candidates — needs admin review (top: '${candidates[0].mysql.urlName}' sim=${candidates[0].similarity.toFixed(3)})`,
        });
        tier3Manual++;
      } else {
        results.push({
          mongoRaceId: String(mongo._id),
          mongoSlug: slug,
          mongoTitle: mongo.title ?? '',
          mongoEndDate: mongo.endDate,
          tier: 'no_match',
          confidence: 0,
          reason: 'No MySQL race candidate found',
        });
        noMatch++;
      }
    }

    const duration = Date.now() - startedAt;
    this.logger.log(
      `[backfill] complete dryRun=${dryRun} t1=${tier1Matched} t2=${tier2Matched} t3=${tier3Manual} none=${noMatch} applied=${appliedUpdates} duration=${duration}ms`,
    );

    return {
      totalMongoRaces: mongoRaces.length,
      totalMysqlRaces: mysqlRaces.length,
      tier1Matched,
      tier2Matched,
      tier3Manual,
      noMatch,
      appliedUpdates,
      dryRun,
      results,
    };
  }

  /**
   * Find single best Tier 2 match: similarity ≥0.85 AND endDate within ±7 days.
   */
  private findTier2Match(
    slug: string,
    mongoEndDate: Date | undefined,
    mysqlRaces: RaceReadonly[],
  ): { mysql: RaceReadonly; similarity: number; endDateDiffDays: number } | null {
    if (!mongoEndDate) return null;
    const mongoTime = new Date(mongoEndDate).getTime();
    const tolMs = RaceMysqlIdBackfillService.END_DATE_TOLERANCE_DAYS * 24 * 60 * 60 * 1000;

    let best: { mysql: RaceReadonly; similarity: number; endDateDiffDays: number } | null = null;
    for (const m of mysqlRaces) {
      if (!m.urlName || !m.eventEndDate) continue;
      const dateDiff = Math.abs(new Date(m.eventEndDate).getTime() - mongoTime);
      if (dateDiff > tolMs) continue;

      const sim = this.slugSimilarity(slug, m.urlName.trim().toLowerCase());
      if (sim < RaceMysqlIdBackfillService.FUZZY_SIMILARITY_THRESHOLD) continue;

      if (!best || sim > best.similarity) {
        best = {
          mysql: m,
          similarity: sim,
          endDateDiffDays: Math.round(dateDiff / (24 * 60 * 60 * 1000)),
        };
      }
    }
    return best;
  }

  /**
   * Find candidate list for manual review queue (similarity ≥0.6 OR endDate within ±30d).
   */
  private findTier3Candidates(
    slug: string,
    mongoEndDate: Date | undefined,
    mysqlRaces: RaceReadonly[],
  ): Array<{ mysql: RaceReadonly; similarity: number }> {
    const candidates: Array<{ mysql: RaceReadonly; similarity: number }> = [];
    const mongoTime = mongoEndDate ? new Date(mongoEndDate).getTime() : null;
    const tolMs = 30 * 24 * 60 * 60 * 1000; // ±30 days for tier 3

    for (const m of mysqlRaces) {
      if (!m.urlName) continue;
      const sim = this.slugSimilarity(slug, m.urlName.trim().toLowerCase());
      const dateOk = mongoTime && m.eventEndDate
        ? Math.abs(new Date(m.eventEndDate).getTime() - mongoTime) <= tolMs
        : false;
      if (sim >= 0.6 || dateOk) {
        candidates.push({ mysql: m, similarity: sim });
      }
    }
    candidates.sort((a, b) => b.similarity - a.similarity);
    return candidates.slice(0, 5); // top 5 only
  }

  /**
   * Jaccard similarity on character bigrams — fast + good for slug matching.
   * Examples:
   *   - "mu-cang-chai-2025" vs "mucangchai-mt-2025" → ~0.75 (likely Tier 2 fail)
   *   - "vmm-2025" vs "vmm-2025" → 1.0 (Tier 1)
   *   - "cat-ba-heritage-2024" vs "cat-ba-heritage-2025" → ~0.88 (Tier 2 with endDate check)
   */
  slugSimilarity(a: string, b: string): number {
    if (!a || !b) return 0;
    if (a === b) return 1;

    const bigrams = (s: string): Set<string> => {
      const set = new Set<string>();
      const normalized = s.replace(/[-_\s]+/g, '');
      for (let i = 0; i < normalized.length - 1; i++) {
        set.add(normalized.substring(i, i + 2));
      }
      return set;
    };

    const setA = bigrams(a);
    const setB = bigrams(b);
    if (setA.size === 0 || setB.size === 0) return 0;

    let intersection = 0;
    for (const bg of setA) {
      if (setB.has(bg)) intersection++;
    }
    const union = setA.size + setB.size - intersection;
    return union > 0 ? intersection / union : 0;
  }
}
