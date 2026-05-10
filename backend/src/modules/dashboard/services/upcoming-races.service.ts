import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Model } from 'mongoose';
import Redis from 'ioredis';
import { Race, RaceDocument } from '../../races/schemas/race.schema';
import {
  UpcomingRaceCardDto,
  UpcomingRacesResponseDto,
} from '../dto/dashboard-response.dto';

/**
 * F-023 BR-DASH-10/11/12 — Upcoming Races trong 30 ngày tới.
 *
 * Race "upcoming" = `status='pre_race'` AND `today < startDate ≤ today+30d`.
 * Sắp xếp ASC theo startDate. Tối đa 6 cards.
 *
 * Readiness % (4 mục đơn giản hoá MVP):
 *  1. master data sync OK (key `master:athlete:bib:<raceId>` tồn tại + có entries)
 *  2. chip pair > 80% (placeholder — chưa có endpoint expose, default false ở MVP)
 *  3. venue confirm flag (race document chưa có flag → coi false)
 *  4. team briefed flag (chưa có flag → false)
 *
 * Race chưa cấu hình readiness → readinessPercent = NULL ("—" trên UI).
 * Ở MVP chỉ check (1) — nếu chỉ có (1) thì coi 25%; còn lại false.
 * Khi tất cả 4 flag chưa có (kể cả master data) → trả NULL.
 */
const MAX_UPCOMING = 6;

@Injectable()
export class DashboardUpcomingRacesService {
  private readonly logger = new Logger(DashboardUpcomingRacesService.name);

  constructor(
    @InjectModel(Race.name) private readonly raceModel: Model<RaceDocument>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async getUpcomingRaces(): Promise<UpcomingRacesResponseDto> {
    const now = new Date();
    const horizon = new Date(now.getTime() + 30 * 86400000);

    const races = await this.raceModel
      .find({
        status: 'pre_race',
        startDate: { $gt: now, $lte: horizon },
      })
      .sort({ startDate: 1 })
      .limit(MAX_UPCOMING)
      .select('_id title slug province startDate')
      .lean();

    const cards: UpcomingRaceCardDto[] = [];
    for (const r of races) {
      const raceId = String((r as { _id: unknown })._id);
      const startDate = r.startDate ? new Date(r.startDate) : undefined;
      const daysRemaining = startDate
        ? Math.max(
            0,
            Math.ceil((startDate.getTime() - now.getTime()) / 86400000),
          )
        : undefined;
      const athleteCount = await this.readAthleteCount(raceId);
      const readinessPercent = await this.computeReadiness(raceId);
      cards.push({
        raceId,
        title: r.title,
        slug: r.slug,
        province: r.province,
        startDate: startDate?.toISOString(),
        daysRemaining,
        athleteCount,
        readinessPercent,
      });
    }

    return { races: cards };
  }

  /**
   * Đếm số bib trong `master:athlete:bib:<raceId>` HSET. Trả 0 nếu key không có.
   */
  private async readAthleteCount(raceId: string): Promise<number> {
    try {
      const len = await this.redis.hlen(`master:athlete:bib:${raceId}`);
      return Number(len ?? 0);
    } catch (e) {
      this.logger.warn(
        `upcoming athleteCount fail race=${raceId} err=${(e as Error).message}`,
      );
      return 0;
    }
  }

  /**
   * MVP heuristic — chỉ kiểm tra master data sync. 4 flag còn lại
   * (chip pair / venue / team briefed) chưa có nguồn truth ổn định, defer.
   * Trả NULL khi master data cũng chưa có (để UI hiển thị "—").
   */
  private async computeReadiness(raceId: string): Promise<number | null> {
    const athletes = await this.readAthleteCount(raceId);
    if (athletes === 0) return null;
    // Chỉ duy nhất master data sync OK = 1/4 = 25%.
    return 25;
  }
}
