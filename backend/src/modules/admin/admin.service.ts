import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { RaceResultService } from '../race-result/services/race-result.service';
import { RacesService } from '../races/races.service';
import { TelegramService } from '../notification/telegram.service';
import { MailService } from '../notification/mail.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly raceResultService: RaceResultService,
    private readonly racesService: RacesService,
    @InjectRedis() private readonly redis: Redis,
    private readonly telegramService: TelegramService,
    private readonly mailService: MailService,
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
   * List all claims (paginated, optional status filter)
   */
  async getClaims(page: number, pageSize: number, status?: string) {
    return this.raceResultService.getClaims(page, pageSize, status);
  }

  /**
   * Resolve or reject a claim (PRD BR-04)
   */
  async resolveClaim(
    claimId: string,
    action: 'approved' | 'rejected',
    resolutionNote: string,
    resolvedBy: string,
  ) {
    const claim = await this.raceResultService.resolveClaim(
      claimId,
      action,
      resolutionNote,
      resolvedBy,
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
        status: action,
        adminNote: resolutionNote,
      })
      .catch((err) =>
        this.logger.error(`Telegram notification failed: ${err.message}`),
      );

    // Send email to claimant
    if (claim.email) {
      let eventTitle = '';
      try {
        const race = await this.racesService.getRaceById(claim.raceId);
        eventTitle = race?.data?.title || '';
      } catch { /* ignore */ }

      this.mailService
        .sendClaimResolvedEmail({
          toEmail: claim.email,
          registeredName: claim.name || '',
          bib: claim.bib?.toString() || '',
          phone: claim.phone || '',
          reason: claim.description || '',
          adminNote: resolutionNote || '',
          eventTitle,
        })
        .catch((err) =>
          this.logger.error(`Email notification failed: ${err.message}`),
        );
    }

    return { data: claim, success: true };
  }

  /**
   * Edit a race result manually with audit trail (PRD BR-03)
   */
  async editResult(
    resultId: string,
    fields: {
      chipTime?: string;
      gunTime?: string;
      name?: string;
      status?: string;
      overallRank?: number;
    },
    reason: string,
    adminUserId: string,
  ) {
    return this.raceResultService.editResult(resultId, fields, reason, adminUserId);
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

  async sendTestOtpEmail(email: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Test endpoint not available in production');
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const testRaceId = 'test-race';
    const testBib = '9999';
    await this.redis.set(`avatar-otp:${testRaceId}:${testBib}`, otp, 'EX', 600);

    await this.mailService.sendAvatarOtpEmail({
      toEmail: email,
      name: 'Test User',
      bib: testBib,
      otp,
    });
    return {
      success: true,
      message: `Test OTP sent to ${email}`,
      __dev_otp: otp,
      __dev_raceId: testRaceId,
      __dev_bib: testBib,
    };
  }
}
