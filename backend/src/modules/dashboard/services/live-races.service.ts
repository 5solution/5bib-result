import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Model } from 'mongoose';
import Redis from 'ioredis';
import { Race, RaceDocument } from '../../races/schemas/race.schema';
import {
  LiveRaceCardDto,
  LiveRacesResponseDto,
} from '../dto/dashboard-response.dto';

/**
 * F-023 BR-DASH-06/07/08/09 — Live Races highlight section.
 *
 * Race "live" = `race.status='live'`. Mỗi race lấy thêm:
 *  - progressPercent: ước lượng từ snapshot timing-alert
 *    (`master:rr-snapshot:<raceId>`) nếu có; default 0.
 *  - runnersOnCourse: started - finished từ stats RaceMasterData
 *    (`master:stats:<raceId>`) nếu có; default 0.
 *  - alertsCount: số medical sev≥4 mở + timing offline (best-effort).
 *  - hasCriticalAlert: true khi alert > 0.
 *
 * KHÔNG block khi Redis fail — fallback về 0/false.
 */
@Injectable()
export class DashboardLiveRacesService {
  private readonly logger = new Logger(DashboardLiveRacesService.name);

  constructor(
    @InjectModel(Race.name) private readonly raceModel: Model<RaceDocument>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async getLiveRaces(): Promise<LiveRacesResponseDto> {
    const races = await this.raceModel
      .find({ status: 'live' })
      .select('_id title slug province courses')
      .lean();

    const cards: LiveRaceCardDto[] = [];
    for (const r of races) {
      const raceId = String((r as { _id: unknown })._id);
      const stats = await this.readStats(raceId);
      const alerts = await this.readAlerts(raceId);
      const activeCourse = Array.isArray(r.courses) && r.courses.length > 0
        ? r.courses[0]?.name
        : undefined;
      cards.push({
        raceId,
        title: r.title,
        slug: r.slug,
        province: r.province,
        activeCourseName: activeCourse,
        progressPercent: stats.progressPercent,
        runnersOnCourse: stats.runnersOnCourse,
        alertsCount: alerts,
        hasCriticalAlert: alerts > 0,
      });
    }

    return { races: cards };
  }

  /**
   * Đọc snapshot timing-alert hoặc master:stats để lấy số runner / progress.
   * Snapshot key chung: `master:rr-snapshot:<raceId>` (15s TTL từ TimingAlert).
   * Nếu fail / miss → trả 0/0 (graceful).
   */
  private async readStats(
    raceId: string,
  ): Promise<{ progressPercent: number; runnersOnCourse: number }> {
    try {
      const raw = await this.redis.get(`master:rr-snapshot:${raceId}`);
      if (!raw) return { progressPercent: 0, runnersOnCourse: 0 };
      const parsed = JSON.parse(raw) as {
        progressPercent?: number;
        runnersOnCourse?: number;
        started?: number;
        finished?: number;
      };
      const progressPercent =
        typeof parsed.progressPercent === 'number'
          ? Math.max(0, Math.min(100, parsed.progressPercent))
          : 0;
      const runnersOnCourse =
        typeof parsed.runnersOnCourse === 'number'
          ? parsed.runnersOnCourse
          : Math.max(
              0,
              (parsed.started ?? 0) - (parsed.finished ?? 0),
            );
      return { progressPercent, runnersOnCourse };
    } catch (e) {
      this.logger.warn(
        `live-races stats fail race=${raceId} err=${(e as Error).message}`,
      );
      return { progressPercent: 0, runnersOnCourse: 0 };
    }
  }

  /**
   * Đếm alert critical: dùng key `medical:race:<raceId>:active-count` (F-018) +
   * placeholder timing offline (sẽ refine khi Command Center expose key chuẩn).
   */
  private async readAlerts(raceId: string): Promise<number> {
    try {
      const medical = await this.redis.get(`medical:race:${raceId}:active-count`);
      const medicalCount = medical ? Number(medical) || 0 : 0;
      return medicalCount;
    } catch {
      return 0;
    }
  }
}
