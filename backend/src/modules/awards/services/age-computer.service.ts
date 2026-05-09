import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { Model } from 'mongoose';
import { AthleteReadonly } from '../../race-master-data/entities/athlete-readonly.entity';
import {
  RaceAthlete,
  RaceAthleteDocument,
} from '../../race-master-data/schemas/race-athlete.schema';
import { Race, RaceDocument } from '../../races/schemas/race.schema';

/**
 * F-019 v2 — Age computer service.
 *
 * Đọc DOB từ MySQL `'platform'` connection (`AthleteReadonly.dob` field) →
 * compute `ageOnRaceDay` → persist vào MongoDB `race_athletes.ageOnRaceDay`.
 *
 * Source: `athletes.dob` DATE column (1-hop, coverage ~95% trên toàn DB
 * platform_live). KHÔNG go qua `athlete_subinfo` vì table đó không có
 * race_id linkage trực tiếp (cần JOIN qua subinfo_id 2-hop).
 *
 * **PRIVACY (BR-03 PII strict allowlist preserved):**
 *   - DOB raw KHÔNG bao giờ persist vào MongoDB.
 *   - DOB raw KHÔNG bao giờ trả về public API.
 *   - Persist CHỈ `ageOnRaceDay: number` (derived).
 *
 * **TRIGGER points:**
 *   1. Cron `@Cron(EVERY_DAY_AT_MIDNIGHT)` — pre-race T-1 batch sync cho
 *      tất cả races có `status ∈ ['pre_race', 'live']`.
 *   2. On-demand từ `AwardsService.recompute()` — lazy compute athlete chưa
 *      có `ageOnRaceDay` field.
 *
 * **FALLBACK strategy:**
 *   - MySQL down → log warn + return null → `AwardsService` dùng Path B
 *     vendor `Category` thay thế.
 *   - DOB null trong MySQL → return null (athlete không cung cấp DOB).
 *   - DOB > raceDay (data corrupt) → return null + log error.
 */
@Injectable()
export class AgeComputerService {
  private readonly logger = new Logger(AgeComputerService.name);

  constructor(
    @InjectRepository(AthleteReadonly, 'platform')
    private readonly athleteRepo: Repository<AthleteReadonly>,
    @InjectModel(RaceAthlete.name)
    private readonly raceAthleteModel: Model<RaceAthleteDocument>,
    @InjectModel(Race.name)
    private readonly raceModel: Model<RaceDocument>,
  ) {}

  /**
   * Compute age years between DOB and raceDay (UTC math, WA-style).
   * KHÔNG dùng `Math.floor(diff/365.25)` — boundary issue 29/02 leap year.
   */
  computeAge(dob: Date, raceDay: Date): number {
    let age = raceDay.getUTCFullYear() - dob.getUTCFullYear();
    const dobMonth = dob.getUTCMonth();
    const dobDay = dob.getUTCDate();
    const raceMonth = raceDay.getUTCMonth();
    const raceDay_ = raceDay.getUTCDate();
    if (raceMonth < dobMonth || (raceMonth === dobMonth && raceDay_ < dobDay)) {
      age -= 1;
    }
    return age;
  }

  /**
   * Compute `ageOnRaceDay` cho 1 athlete (on-demand).
   * Returns null khi:
   *   - athlete không tồn tại trong MySQL
   *   - DOB null trong MySQL (athlete không cung cấp khi đăng ký)
   *   - DOB > raceDay (data corrupt)
   *   - MySQL down (catch all errors → null fallback)
   */
  async computeAgeForAthlete(
    athletesId: number,
    raceDay: Date,
  ): Promise<number | null> {
    try {
      // 1-hop direct: lookup DOB qua athletes table (column `dob` DATE).
      // Field này được service layer treat as PII isolated — KHÔNG persist
      // raw vào MongoDB, chỉ persist age number derived.
      const athlete = await this.athleteRepo.findOne({
        where: { athletes_id: athletesId },
        select: ['athletes_id', 'dob'],
      });
      if (!athlete?.dob) {
        return null;
      }

      const dob = athlete.dob instanceof Date ? athlete.dob : new Date(athlete.dob);
      if (Number.isNaN(dob.getTime())) {
        this.logger.warn(
          `[age-computer] DOB parse fail athletes_id=${athletesId} raw=${String(athlete.dob)}`,
        );
        return null;
      }
      if (dob.getTime() > raceDay.getTime()) {
        this.logger.error(
          `[age-computer] DOB > raceDay (corrupt) athletes_id=${athletesId} dob=${dob.toISOString()}`,
        );
        return null;
      }

      const age = this.computeAge(dob, raceDay);
      if (age < 0 || age > 120) {
        this.logger.error(
          `[age-computer] age out of range athletes_id=${athletesId} age=${age}`,
        );
        return null;
      }
      return age;
    } catch (e) {
      this.logger.warn(
        `[age-computer] MySQL fallback null athletes_id=${athletesId} err=${(e as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Sync `ageOnRaceDay` cho TẤT CẢ athletes của 1 race.
   *
   * Idempotent — bulkWrite `$set ageOnRaceDay`. Re-run safe.
   * Logs coverage stats.
   */
  async syncAgeForRace(
    mysqlRaceId: number,
    raceDay: Date,
  ): Promise<{
    total: number;
    computed: number;
    nullCount: number;
  }> {
    const athletes = await this.raceAthleteModel
      .find({ mysql_race_id: mysqlRaceId })
      .select('athletes_id')
      .lean();

    let computed = 0;
    let nullCount = 0;
    const ops: Array<{
      updateOne: {
        filter: { mysql_race_id: number; athletes_id: number };
        update: { $set: { ageOnRaceDay: number | null } };
      };
    }> = [];

    for (const a of athletes) {
      const age = await this.computeAgeForAthlete(a.athletes_id, raceDay);
      if (age != null) {
        computed += 1;
      } else {
        nullCount += 1;
      }
      ops.push({
        updateOne: {
          filter: { mysql_race_id: mysqlRaceId, athletes_id: a.athletes_id },
          update: { $set: { ageOnRaceDay: age } },
        },
      });
    }

    if (ops.length > 0) {
      await this.raceAthleteModel.bulkWrite(ops, { ordered: false });
    }

    this.logger.log(
      `[age-computer] sync race=${mysqlRaceId} total=${athletes.length} computed=${computed} null=${nullCount}`,
    );
    return { total: athletes.length, computed, nullCount };
  }

  /**
   * Cron T-1 pre-race: sync age cho tất cả races status ∈ ['pre_race', 'live'].
   * Mỗi race process độc lập — failure 1 race không block races khác.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'awards.age-sync-prerace',
  })
  async cronSyncPreRaceAges(): Promise<void> {
    try {
      const races = await this.raceModel
        .find({ status: { $in: ['pre_race', 'live'] } })
        .select('_id startDate status')
        .lean();
      this.logger.log(
        `[age-computer] cron pre-race sync starts — ${races.length} races`,
      );
      for (const r of races) {
        const raceAny = r as unknown as {
          _id: { toString(): string };
          startDate?: Date;
        };
        const raceId = raceAny._id.toString();
        const raceDay = raceAny.startDate ? new Date(raceAny.startDate) : null;
        if (!raceDay) continue;

        // Resolve mysql_race_id qua chip_race_configs (legacy bridge).
        const linkDoc = await this.raceModel.db
          .collection('chip_race_configs')
          .findOne({ mongo_race_id: raceId });
        const mysqlRaceId =
          (linkDoc?.mysql_race_id as number | undefined) ?? null;
        if (!mysqlRaceId) continue;

        try {
          await this.syncAgeForRace(mysqlRaceId, raceDay);
        } catch (e) {
          this.logger.error(
            `[age-computer] cron sync fail mysqlRaceId=${mysqlRaceId} err=${(e as Error).message}`,
          );
        }
      }
    } catch (e) {
      this.logger.error(
        `[age-computer] cron outer fail err=${(e as Error).message}`,
      );
    }
  }
}
