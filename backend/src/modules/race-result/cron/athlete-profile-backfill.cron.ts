/**
 * FEATURE-047 Phase 1B — Athlete Profile Backfill Cron.
 *
 * BR-47-22 — 30-min interval batch 1000 with SETNX lock + cursor resume.
 *
 * Pattern: F-018 medical SETNX 29-min lock prevents overlapping ticks.
 * Idempotent upsert: re-running on same race_result doesn't duplicate.
 *
 * Initial backfill (94K race_results first run) estimated 5-10 min.
 * Subsequent ticks process delta only (new race_results since last cursor).
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Model, Types } from 'mongoose';
import Redis from 'ioredis';

import { RaceResult, RaceResultDocument } from '../schemas/race-result.schema';
import {
  AthleteProfile,
  AthleteProfileDocument,
} from '../schemas/athlete-profile.schema';
import { AthleteIdentityMergeService } from '../services/athlete-identity-merge.service';
import { slugifyVN } from '../../../common/utils/slugify';

const BATCH_SIZE = 1000;
const LOCK_KEY = 'athlete:backfill-lock';
const LOCK_TTL_SEC = 1740; // 29 min (less than 30-min cron tick to prevent overlap)
const CURSOR_KEY = 'athlete:backfill-cursor';

interface ResultRow {
  _id: Types.ObjectId;
  raceId: string;
  bib: string;
  name?: string;
  email?: string;
  chipTime?: string;
  gender?: string;
  category?: string;
  nationality?: string;
  club?: string;
  avatarUrl?: string;
  finished?: number;
  started?: number;
  created_at?: Date;
}

@Injectable()
export class AthleteProfileBackfillCron {
  private readonly logger = new Logger(AthleteProfileBackfillCron.name);

  constructor(
    @InjectModel(RaceResult.name)
    private readonly resultModel: Model<RaceResultDocument>,
    @InjectModel(AthleteProfile.name)
    private readonly profileModel: Model<AthleteProfileDocument>,
    @InjectRedis() private readonly redis: Redis,
    private readonly identityMerge: AthleteIdentityMergeService,
  ) {}

  /** Runs every 30 minutes. Resume from last cursor. */
  @Cron('*/30 * * * *')
  async backfillAthleteProfiles(): Promise<void> {
    // SETNX lock prevents overlap if previous tick still running
    const lockAcquired = await this.acquireLock();
    if (!lockAcquired) {
      this.logger.log('[backfill] previous tick still running, skipping');
      return;
    }

    const startedAt = Date.now();
    let processed = 0;
    let failed = 0;

    try {
      let cursorId = await this.getCursor();

      while (true) {
        const query: Record<string, unknown> = {};
        if (cursorId) {
          query._id = { $gt: cursorId };
        }

        const batch = await this.resultModel
          .find(query)
          .sort({ _id: 1 })
          .limit(BATCH_SIZE)
          .lean<ResultRow[]>()
          .exec();

        if (batch.length === 0) {
          this.logger.log(
            `[backfill] complete — processed=${processed} failed=${failed} duration=${Date.now() - startedAt}ms`,
          );
          // Reset cursor for next cycle (start over to catch updates)
          await this.deleteCursor();
          break;
        }

        for (const row of batch) {
          try {
            await this.upsertAthleteProfile(row);
            processed++;
          } catch (err) {
            failed++;
            this.logger.warn(
              `[backfill] upsert failed bib=${row.bib} _id=${row._id}: ${(err as Error).message}`,
            );
          }
        }

        // Save cursor — resume from here next tick if budget exhausted
        const lastId = batch[batch.length - 1]._id;
        cursorId = lastId;
        await this.saveCursor(lastId);

        // Soft time budget — stop after 25min to leave room for lock release
        if (Date.now() - startedAt > 25 * 60 * 1000) {
          this.logger.log(
            `[backfill] time budget exhausted, resuming next tick. processed=${processed} cursor=${lastId}`,
          );
          break;
        }
      }
    } finally {
      await this.releaseLock();
    }
  }

  /**
   * Idempotent upsert: build slug from bib+name, compute aggregation,
   * upsert into athlete_profiles. SHA256-hash email if present (Adjustment #10).
   */
  async upsertAthleteProfile(row: ResultRow): Promise<void> {
    if (!row.name || !row.bib) return; // skip incomplete rows

    const nameSlug = slugifyVN(row.name);
    if (!nameSlug) return;

    const slug = `${row.bib}-${nameSlug}`;

    // Hash email if present
    let emailHash: string | undefined;
    if (row.email && row.email.trim()) {
      emailHash = this.identityMerge.hashEmail(row.email);
    }

    // Aggregate all results for this athlete (by bib + name slug match)
    const allResults = await this.resultModel
      .find({ bib: row.bib })
      .lean<ResultRow[]>()
      .exec();

    const matched = allResults.filter(
      (r) => r.name && slugifyVN(r.name) === nameSlug,
    );

    const totalRaces = matched.length;
    const totalFinished = matched.filter((r) => this.isFinisher(r)).length;
    const totalDNF = matched.filter(
      (r) => !this.isFinisher(r) && (r.started ?? 0) > 0,
    ).length;

    // Pick most recent for canonical fields
    matched.sort((a, b) => {
      const da = a.created_at ? new Date(a.created_at).getTime() : 0;
      const db = b.created_at ? new Date(b.created_at).getTime() : 0;
      return db - da;
    });
    const latest = matched[0] ?? row;

    const linkedRaceIds = Array.from(new Set(matched.map((r) => r.raceId)));
    const linkedBibs = [row.bib]; // Phase 1B Coder extension: identityMerge expands via email hash

    await this.profileModel.findOneAndUpdate(
      { slug },
      {
        $set: {
          slug,
          canonicalName: latest.name ?? row.name,
          primaryBib: row.bib,
          canonicalEmailHash: emailHash,
          linkedBibs,
          linkedRaceIds,
          gender: this.normalizeGender(latest.gender),
          nationality: latest.nationality,
          club: latest.club,
          ageGroupSnapshot: latest.category,
          totalRaces,
          totalFinished,
          totalDNF,
          avatarUrl: latest.avatarUrl,
          computedAt: new Date(),
        },
        $setOnInsert: {
          active: true, // BR-47-05 default opt-in
        },
      },
      { upsert: true, new: true },
    );
  }

  private isFinisher(r: ResultRow): boolean {
    if (!r.chipTime) return false;
    const t = r.chipTime.trim();
    if (!t || t === '0:00:00' || t === '00:00:00') return false;
    return true;
  }

  private normalizeGender(
    g: string | undefined,
  ): 'male' | 'female' | 'other' | null {
    if (!g) return null;
    const lower = g.toLowerCase().trim();
    if (lower === 'm' || lower === 'male' || lower === 'nam') return 'male';
    if (lower === 'f' || lower === 'female' || lower === 'nu' || lower === 'nữ')
      return 'female';
    return 'other';
  }

  // ─── Lock + cursor helpers ─────────────────────────────────────────────

  private async acquireLock(): Promise<boolean> {
    try {
      const res = await this.redis.set(LOCK_KEY, '1', 'EX', LOCK_TTL_SEC, 'NX');
      return res === 'OK';
    } catch (err) {
      this.logger.warn(`[acquireLock] failed: ${(err as Error).message}`);
      return false;
    }
  }

  private async releaseLock(): Promise<void> {
    try {
      await this.redis.del(LOCK_KEY);
    } catch (err) {
      this.logger.warn(`[releaseLock] failed: ${(err as Error).message}`);
    }
  }

  private async getCursor(): Promise<Types.ObjectId | null> {
    try {
      const v = await this.redis.get(CURSOR_KEY);
      if (!v) return null;
      return new Types.ObjectId(v);
    } catch {
      return null;
    }
  }

  private async saveCursor(id: Types.ObjectId): Promise<void> {
    try {
      await this.redis.set(CURSOR_KEY, String(id));
    } catch (err) {
      this.logger.warn(`[saveCursor] failed: ${(err as Error).message}`);
    }
  }

  private async deleteCursor(): Promise<void> {
    try {
      await this.redis.del(CURSOR_KEY);
    } catch {
      /* ignore */
    }
  }
}
