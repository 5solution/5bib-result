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

    if (races.length === 0) return { races: [] };

    const raceIds = races.map((r) => String((r as { _id: unknown })._id));

    // Pipeline: 1 round-trip cho 2N keys
    const pipeline = this.redis.pipeline();
    for (const id of raceIds) {
      pipeline.get(`master:rr-snapshot:${id}`);
      pipeline.get(`medical:race:${id}:active-count`);
    }
    let results: Array<[Error | null, unknown]> | null = null;
    try {
      results = (await pipeline.exec()) as Array<[Error | null, unknown]> | null;
    } catch (e) {
      this.logger.warn(
        `live-races pipeline fail err=${(e as Error).message}`,
      );
    }

    const cards: LiveRaceCardDto[] = races.map((r, i) => {
      const raceId = raceIds[i];
      const snapshotRaw = results?.[i * 2]?.[1] as string | null | undefined;
      const medicalRaw = results?.[i * 2 + 1]?.[1] as string | null | undefined;

      let progressPercent = 0;
      let runnersOnCourse = 0;
      if (snapshotRaw) {
        try {
          const parsed = JSON.parse(snapshotRaw) as {
            progressPercent?: number;
            runnersOnCourse?: number;
            started?: number;
            finished?: number;
          };
          progressPercent =
            typeof parsed.progressPercent === 'number'
              ? Math.max(0, Math.min(100, parsed.progressPercent))
              : 0;
          runnersOnCourse =
            typeof parsed.runnersOnCourse === 'number'
              ? parsed.runnersOnCourse
              : Math.max(0, (parsed.started ?? 0) - (parsed.finished ?? 0));
        } catch {
          /* swallow — graceful */
        }
      }
      const alerts = medicalRaw ? Number(medicalRaw) || 0 : 0;
      const activeCourse =
        Array.isArray(r.courses) && r.courses.length > 0
          ? r.courses[0]?.name
          : undefined;

      return {
        raceId,
        title: r.title,
        slug: r.slug,
        province: r.province,
        activeCourseName: activeCourse,
        progressPercent,
        runnersOnCourse,
        alertsCount: alerts,
        hasCriticalAlert: alerts > 0,
      };
    });

    return { races: cards };
  }
}
