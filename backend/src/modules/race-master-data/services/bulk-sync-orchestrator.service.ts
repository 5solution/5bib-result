/**
 * FEATURE-048 Phase 1B — Bulk Sync Orchestrator (BR-48-09).
 *
 * State machine for staged backfill 10 → 50 → 195 races. Each stage requires
 * previous DONE state. Full mode requires admin `reason` ≥10 chars (audit).
 *
 * State stored in Redis `athlete:bulksync-state` — survives restart.
 * Progress per run stored in `athlete:bulksync-progress:<runId>` (24h TTL).
 */

import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type Redis from 'ioredis';
import { randomUUID } from 'crypto';

import { RaceAthleteSyncService } from './race-athlete-sync.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RaceReadonly } from '../../promo-hub/entities/race-readonly.entity';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  RaceAthlete,
  RaceAthleteDocument,
} from '../schemas/race-athlete.schema';

export type BulkSyncMode = 'staged_10' | 'staged_50' | 'full';

export type BulkSyncStage =
  | 'idle'
  | 'staged_10_running'
  | 'staged_10_done'
  | 'staged_50_running'
  | 'staged_50_done'
  | 'full_running'
  | 'full_done'
  | 'failed';

export interface BulkSyncProgress {
  runId: string;
  mode: BulkSyncMode;
  status: 'running' | 'done' | 'failed';
  progress: {
    current: number;
    total: number;
    percent: number;
  };
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  triggeredBy: string;
  reason?: string;
  errors: string[];
  racesSucceeded: number;
  racesFailed: number;
}

const STATE_KEY = 'athlete:bulksync-state';
const RUN_PREFIX = 'athlete:bulksync-progress:';
const RUN_TTL_SEC = 86400; // 24h

@Injectable()
export class BulkSyncOrchestratorService {
  private readonly logger = new Logger(BulkSyncOrchestratorService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly syncService: RaceAthleteSyncService,
    @InjectRepository(RaceReadonly, 'platform')
    private readonly mysqlRaceRepo: Repository<RaceReadonly>,
    @InjectModel(RaceAthlete.name)
    private readonly raceAthleteModel: Model<RaceAthleteDocument>,
  ) {}

  /**
   * BR-48-09 — Trigger staged bulk sync. Returns runId for status polling.
   * Async — execution continues after return.
   */
  async triggerBulkSync(
    mode: BulkSyncMode,
    triggeredBy: string,
    reason?: string,
  ): Promise<{
    runId: string;
    mode: BulkSyncMode;
    racesQueued: number;
    estimatedDuration: string;
  }> {
    // BR-48-09 — reason required for full mode
    if (mode === 'full' && (!reason || reason.length < 10)) {
      throw new Error('reason ≥10 ký tự bắt buộc khi mode=full');
    }

    // Check state machine — prevent skip (e.g. cannot run staged_50 before staged_10_done)
    await this.validateStageTransition(mode);

    // Check no concurrent sync running
    const currentState = await this.getCurrentStage();
    if (currentState.endsWith('_running')) {
      throw new ConflictException(
        `Sync đang chạy (state=${currentState}). Đợi hoàn tất trước khi trigger sync mới.`,
      );
    }

    const races = await this.selectRacesForMode(mode);
    const runId = randomUUID();
    const newState: BulkSyncStage =
      mode === 'staged_10'
        ? 'staged_10_running'
        : mode === 'staged_50'
          ? 'staged_50_running'
          : 'full_running';

    await this.setStage(newState);

    const progress: BulkSyncProgress = {
      runId,
      mode,
      status: 'running',
      progress: { current: 0, total: races.length, percent: 0 },
      startedAt: new Date().toISOString(),
      triggeredBy,
      reason,
      errors: [],
      racesSucceeded: 0,
      racesFailed: 0,
    };

    await this.saveProgress(runId, progress);

    // Fire-and-forget async execution
    void this.executeSync(runId, mode, races, triggeredBy);

    this.logger.log(
      `[bulksync] triggered runId=${runId} mode=${mode} races=${races.length} by=${triggeredBy} reason="${reason ?? '<none>'}"`,
    );

    return {
      runId,
      mode,
      racesQueued: races.length,
      estimatedDuration: this.estimateDuration(races.length),
    };
  }

  /** Async sync execution — updates progress in Redis as it goes. */
  private async executeSync(
    runId: string,
    mode: BulkSyncMode,
    races: RaceReadonly[],
    triggeredBy: string,
  ): Promise<void> {
    const startTime = Date.now();
    const errors: string[] = [];
    let succeeded = 0;
    let failed = 0;

    try {
      for (let i = 0; i < races.length; i++) {
        const race = races[i];
        try {
          await this.syncService.fullSyncRace(Number(race.raceId), `bulksync:${runId}`);
          succeeded++;
        } catch (err) {
          failed++;
          const msg = `race_id=${race.raceId}: ${(err as Error).message}`;
          errors.push(msg);
          this.logger.warn(`[bulksync] ${msg}`);
        }

        // Update progress every race
        const progress: Partial<BulkSyncProgress> = {
          progress: {
            current: i + 1,
            total: races.length,
            percent: Math.round(((i + 1) / races.length) * 100),
          },
          racesSucceeded: succeeded,
          racesFailed: failed,
          errors,
        };
        await this.updateProgress(runId, progress);
      }

      // Mark done state
      const doneState: BulkSyncStage =
        mode === 'staged_10'
          ? 'staged_10_done'
          : mode === 'staged_50'
            ? 'staged_50_done'
            : 'full_done';

      await this.setStage(doneState);
      await this.updateProgress(runId, {
        status: 'done',
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      });

      this.logger.log(
        `[bulksync] done runId=${runId} succeeded=${succeeded} failed=${failed} duration=${Date.now() - startTime}ms`,
      );
    } catch (err) {
      await this.setStage('failed');
      await this.updateProgress(runId, {
        status: 'failed',
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        errors: [...errors, `FATAL: ${(err as Error).message}`],
      });
      this.logger.error(`[bulksync] FAILED runId=${runId}: ${(err as Error).message}`);
    }
  }

  /** BR-48-09 — Get sync status by runId. */
  async getSyncStatus(runId: string): Promise<BulkSyncProgress | null> {
    try {
      const raw = await this.redis.get(`${RUN_PREFIX}${runId}`);
      if (!raw) return null;
      return JSON.parse(raw) as BulkSyncProgress;
    } catch (err) {
      this.logger.warn(`[bulksync] getSyncStatus failed: ${(err as Error).message}`);
      return null;
    }
  }

  /** BR-48-19 helper — current state + race coverage stats. */
  async getOverallStatus(): Promise<{
    stage: BulkSyncStage;
    raceCoverage: { synced: number; total: number; percent: number };
  }> {
    const stage = await this.getCurrentStage();
    const total = await this.mysqlRaceRepo.count();

    // Count distinct synced races via race_athletes.mysql_race_id distinct
    let synced = 0;
    try {
      const distinctRaces = await this.raceAthleteModel.distinct('mysql_race_id');
      synced = distinctRaces.length;
    } catch (err) {
      this.logger.warn(`[coverage] distinct count failed: ${(err as Error).message}`);
    }

    return {
      stage,
      raceCoverage: {
        synced,
        total,
        percent: total > 0 ? Math.round((synced / total) * 100) : 0,
      },
    };
  }

  // ─── Internal helpers ──────────────────────────────────────────────

  async getCurrentStage(): Promise<BulkSyncStage> {
    try {
      const v = await this.redis.get(STATE_KEY);
      return (v as BulkSyncStage) ?? 'idle';
    } catch {
      return 'idle';
    }
  }

  private async setStage(stage: BulkSyncStage): Promise<void> {
    try {
      await this.redis.set(STATE_KEY, stage);
    } catch (err) {
      this.logger.warn(`[stage.set] failed: ${(err as Error).message}`);
    }
  }

  /** BR-48-09 — State machine: cannot skip stages. */
  private async validateStageTransition(mode: BulkSyncMode): Promise<void> {
    const current = await this.getCurrentStage();

    if (mode === 'staged_10') {
      // Always allowed (can re-run pilot)
      return;
    }
    if (mode === 'staged_50') {
      if (
        current !== 'staged_10_done' &&
        current !== 'staged_50_done' &&
        current !== 'full_done'
      ) {
        throw new Error(
          'staged_50 requires staged_10 to be done first (state machine)',
        );
      }
      return;
    }
    if (mode === 'full') {
      if (current !== 'staged_50_done' && current !== 'full_done') {
        throw new Error(
          'full mode requires staged_50 to be done first (state machine)',
        );
      }
    }
  }

  /** Select races for given mode. */
  private async selectRacesForMode(
    mode: BulkSyncMode,
  ): Promise<RaceReadonly[]> {
    // Phase 1B simplification — order by recent endDate DESC, take N
    // Production may use status filter + active-races prioritization
    const all = await this.mysqlRaceRepo.find({
      order: { eventEndDate: 'DESC' },
      take: mode === 'staged_10' ? 10 : mode === 'staged_50' ? 50 : 500,
    });
    return all;
  }

  private estimateDuration(raceCount: number): string {
    // Rough: 10-30s per race
    const minMin = Math.ceil((raceCount * 10) / 60);
    const maxMin = Math.ceil((raceCount * 30) / 60);
    return `${minMin}-${maxMin} phút`;
  }

  private async saveProgress(
    runId: string,
    progress: BulkSyncProgress,
  ): Promise<void> {
    try {
      await this.redis.setex(
        `${RUN_PREFIX}${runId}`,
        RUN_TTL_SEC,
        JSON.stringify(progress),
      );
    } catch (err) {
      this.logger.warn(`[progress.save] failed: ${(err as Error).message}`);
    }
  }

  private async updateProgress(
    runId: string,
    patch: Partial<BulkSyncProgress>,
  ): Promise<void> {
    const existing = await this.getSyncStatus(runId);
    if (!existing) return;
    const updated = { ...existing, ...patch } as BulkSyncProgress;
    await this.saveProgress(runId, updated);
  }
}
