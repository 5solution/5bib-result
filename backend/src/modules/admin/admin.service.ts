import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { RaceResultService } from '../race-result/services/race-result.service';
import { RacesService } from '../races/races.service';
import { TelegramService } from '../notification/telegram.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly raceResultService: RaceResultService,
    private readonly racesService: RacesService,
    @InjectRedis() private readonly redis: Redis,
    private readonly telegramService: TelegramService,
  ) {}

  /**
   * Get paginated sync logs
   */
  async getSyncLogs(page: number, pageSize: number) {
    return this.raceResultService.getSyncLogs(page, pageSize);
  }

  /**
   * Force-sync a specific course
   */
  async forceSync(raceId: string, courseId: string) {
    const raceResult = await this.racesService.getRaceById(raceId);
    if (!raceResult.data) {
      throw new NotFoundException('Race not found');
    }

    const course = raceResult.data.courses?.find(
      (c) => c.courseId === courseId,
    );
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    if (!course.apiUrl) {
      throw new NotFoundException('Course has no apiUrl configured');
    }

    const count = await this.raceResultService.syncSingleCourse(
      raceId,
      courseId,
      course.distance || course.name,
      course.apiUrl,
    );

    return {
      message: `Force-synced ${count} results for course ${courseId}`,
      resultCount: count,
      success: true,
    };
  }

  /**
   * Delete all results for a course
   */
  async resetData(raceId: string, courseId: string) {
    const deleted = await this.raceResultService.deleteResultsByCourse(courseId);
    return {
      message: `Deleted ${deleted} results for course ${courseId}`,
      deletedCount: deleted,
      success: true,
    };
  }

  /**
   * List all claims (paginated)
   */
  async getClaims(page: number, pageSize: number) {
    return this.raceResultService.getClaims(page, pageSize);
  }

  /**
   * Resolve or reject a claim
   */
  async resolveClaim(claimId: string, status: string, adminNote?: string) {
    const claim = await this.raceResultService.resolveClaim(
      claimId,
      status,
      adminNote,
    );
    if (!claim) {
      throw new NotFoundException('Claim not found');
    }

    // Send Telegram notification
    this.telegramService
      .notifyClaimResolved({
        bib: claim.bib?.toString() || '',
        name: claim.name || '',
        phone: claim.phone,
        description: claim.description || '',
        status,
        adminNote,
      })
      .catch((err) =>
        this.logger.error(`Telegram notification failed: ${err.message}`),
      );

    return { data: claim, success: true };
  }

  /**
   * Purge Redis cache for a course
   */
  async purgeCache(courseId: string) {
    const deleted = await this.raceResultService.purgeCache(courseId);
    return {
      message: `Purged ${deleted} cache keys for course ${courseId}`,
      deletedKeys: deleted,
      success: true,
    };
  }
}
