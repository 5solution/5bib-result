/**
 * FEATURE-048 Phase 1B — Ended-race 24h sync cron (BR-48-06).
 *
 * Tiered sync schedule:
 *   - Active races (pre_race/live): existing 30s tick in race-master-delta-sync.cron
 *   - Ended races: THIS cron — 24h interval, lower priority (data stable, just refresh PII)
 *   - Archived (ended >365d): admin-trigger only via bulk-sync endpoint
 *
 * Runs at 04:00 server time daily (after identity clustering at 03:00).
 * SETNX 23h lock prevents overlap.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type Redis from 'ioredis';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MoreThan, LessThanOrEqual } from 'typeorm';

import { RaceAthleteSyncService } from '../services/race-athlete-sync.service';
import { RaceReadonly } from '../../promo-hub/entities/race-readonly.entity';

const LOCK_KEY = 'athlete:ended-race-sync-lock';
const LOCK_TTL_SEC = 23 * 3600; // 23h
const ENDED_RACE_WINDOW_DAYS = 365; // races ended within 1 year (not archived)

@Injectable()
export class EndedRaceMasterSyncCron {
  private readonly logger = new Logger(EndedRaceMasterSyncCron.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    @InjectRepository(RaceReadonly, 'platform')
    private readonly mysqlRaceRepo: Repository<RaceReadonly>,
    private readonly syncService: RaceAthleteSyncService,
  ) {}

  /** Daily 04:00 — after clustering cron at 03:00 to give it priority. */
  @Cron('0 4 * * *', { name: 'ended-race-master-sync' })
  async tick(): Promise<void> {
    const acquired = await this.acquireLock();
    if (!acquired) {
      this.logger.log('[ended-cron] lock held — skip');
      return;
    }

    const startedAt = Date.now();
    let succeeded = 0;
    let failed = 0;

    try {
      const cutoff = new Date(
        Date.now() - ENDED_RACE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      );

      // Select races: ended within last 365d (cutoff < eventEndDate < now)
      // Active races skipped — separate 30s tick handles them
      const races = await this.mysqlRaceRepo.find({
        where: {
          eventEndDate: MoreThan(cutoff),
        },
        order: { eventEndDate: 'DESC' },
        take: 200, // safety cap per tick
      });

      const now = new Date();
      const endedRaces = races.filter(
        (r) => r.eventEndDate && r.eventEndDate < now,
      );

      this.logger.log(
        `[ended-cron] start total=${races.length} ended=${endedRaces.length} cutoff=${cutoff.toISOString()}`,
      );

      for (const race of endedRaces) {
        try {
          await this.syncService.deltaSyncRace(
            Number(race.raceId),
            'cron:ended-race-24h',
          );
          succeeded++;
        } catch (err) {
          failed++;
          this.logger.warn(
            `[ended-cron] race_id=${race.raceId} failed: ${(err as Error).message}`,
          );
        }
      }

      this.logger.log(
        `[ended-cron] done succeeded=${succeeded} failed=${failed} duration=${Date.now() - startedAt}ms`,
      );
    } catch (err) {
      this.logger.error(`[ended-cron] FAILED: ${(err as Error).message}`);
    } finally {
      await this.releaseLock();
    }
  }

  private async acquireLock(): Promise<boolean> {
    try {
      const res = await this.redis.set(LOCK_KEY, '1', 'EX', LOCK_TTL_SEC, 'NX');
      return res === 'OK';
    } catch {
      return false;
    }
  }

  private async releaseLock(): Promise<void> {
    try {
      await this.redis.del(LOCK_KEY);
    } catch {
      /* ignore */
    }
  }
}
