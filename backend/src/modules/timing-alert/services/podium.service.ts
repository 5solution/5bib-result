import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Model } from 'mongoose';
import { Race, RaceDocument } from '../../races/schemas/race.schema';
import {
  RaceResult,
  RaceResultDocument,
} from '../../race-result/schemas/race-result.schema';
import {
  PodiumResponseDto,
  PodiumCourseDto,
  PodiumEntryDto,
} from '../dto/podium.dto';

/**
 * Top 10 per course — actual finishers theo overallRankNumeric ASC.
 *
 * **Use case:** BTC chuẩn bị trao giải khi race gần kết thúc. Tab "Trao giải"
 * hiển thị Top 10 dự kiến, cập nhật realtime khi athlete finish.
 *
 * **Data source:** `race_results` collection — RaceSyncCron đã sync rank fields
 * (`overallRankNumeric`, `categoryRankNumeric`, `chipTime`) từ RR API.
 *
 * **Ranking semantics:**
 * - DNF/DNS/DSQ athletes có `overallRankNumeric ≥ 900000` (vendor sentinel) →
 *   filter `< 900000` để tránh leak vào podium (lesson L2 từ memory).
 * - Sort ASC theo `overallRankNumeric` (1 = nhất). Compound index
 *   `{ courseId, timingPoint, overallRankNumeric }` đã có (race-result schema).
 *
 * **Cache:** Redis 30s TTL — race day BTC tab Podium ít refresh hơn cockpit.
 */
@Injectable()
export class PodiumService {
  private readonly logger = new Logger(PodiumService.name);
  private static readonly TOP_N = 10;
  private static readonly CACHE_TTL_SECONDS = 30;
  /** Vendor sentinel: rank >= này = DNF/DNS/DSQ. Lesson L2 từ codebase memory. */
  private static readonly DNF_RANK_THRESHOLD = 900000;

  constructor(
    @InjectModel(Race.name)
    private readonly raceModel: Model<RaceDocument>,
    @InjectModel(RaceResult.name)
    private readonly resultModel: Model<RaceResultDocument>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async getPodium(raceId: string): Promise<PodiumResponseDto> {
    const cacheKey = `podium:${raceId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as PodiumResponseDto;
      } catch {
        // recompute
      }
    }

    const race = await this.raceModel.findById(raceId).lean<RaceDocument>().exec();
    if (!race) {
      throw new NotFoundException(`Race ${raceId} not found`);
    }
    const courses = race.courses ?? [];

    const podiumCourses: PodiumCourseDto[] = await Promise.all(
      courses.map(async (course) => {
        // Query race_results với compound index `(courseId, timingPoint, overallRankNumeric)`.
        // Filter timingPoint case-insensitive (vendor "Finish" / "FINISH").
        const top = await this.resultModel
          .find({
            raceId,
            courseId: course.courseId,
            timingPoint: { $regex: /^finish$/i },
            overallRankNumeric: { $lt: PodiumService.DNF_RANK_THRESHOLD, $gt: 0 },
          })
          .sort({ overallRankNumeric: 1 })
          .limit(PodiumService.TOP_N)
          .select({
            bib: 1,
            name: 1,
            chipTime: 1,
            gunTime: 1,
            pace: 1,
            overallRankNumeric: 1,
            categoryRankNumeric: 1,
            category: 1,
            gender: 1,
            nationality: 1,
            club: 1,
          })
          .lean<RaceResultDocument[]>()
          .exec();

        const entries: PodiumEntryDto[] = top.map((row, idx) => ({
          rank: row.overallRankNumeric ?? idx + 1,
          bib: row.bib,
          name: row.name ?? null,
          chipTime: row.chipTime ?? null,
          gunTime: row.gunTime ?? null,
          pace: row.pace ?? null,
          ageGroup: row.category ?? null,
          ageGroupRank: row.categoryRankNumeric ?? null,
          gender: row.gender ?? null,
          nationality: row.nationality ?? null,
          club: row.club ?? null,
        }));

        return {
          courseId: course.courseId,
          courseName: course.name,
          distanceKm: typeof course.distanceKm === 'number' ? course.distanceKm : null,
          finishersCount: entries.length,
          podium: entries,
        };
      }),
    );

    const response: PodiumResponseDto = {
      raceId,
      raceTitle: race.title,
      raceStatus: race.status,
      generatedAt: new Date().toISOString(),
      courses: podiumCourses,
    };

    await this.redis.set(
      cacheKey,
      JSON.stringify(response),
      'EX',
      PodiumService.CACHE_TTL_SECONDS,
    );

    return response;
  }
}
