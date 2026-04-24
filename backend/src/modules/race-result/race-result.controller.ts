import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  Res,
  BadRequestException,
  NotFoundException,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  FileInterceptor,
  FileFieldsInterceptor,
} from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { GetRaceResultsDto } from './dto/get-race-results.dto';
import { RaceResultsPaginatedDto } from './dto/race-result-response.dto';
import {
  ResultImageQueryDto,
  normalizeImageConfig,
} from './dto/result-image-query.dto';
import { SubmitClaimDto } from './dto/submit-claim.dto';
import {
  TimeDistributionResponseDto,
  CountryStatsResponseDto,
  CountryRankResponseDto,
  PercentileResponseDto,
} from './dto/stats-viz.dto';
import { RaceResultService } from './services/race-result.service';
import {
  ResultImageService,
  AthleteInput,
} from './services/result-image.service';
import { BadgeService } from './services/badge.service';
import { RacesService } from '../races/races.service';
import { UploadService } from '../upload/upload.service';
import { LogtoAdminGuard } from '../logto-auth';

@ApiTags('Race Results')
@Controller('race-results')
export class RaceResultController {
  constructor(
    private readonly raceResultService: RaceResultService,
    private readonly resultImageService: ResultImageService,
    private readonly badgeService: BadgeService,
    private readonly racesService: RacesService,
    private readonly uploadService: UploadService,
  ) {}

  @Get('distances')
  @ApiOperation({ summary: 'Get available race distances/types' })
  @ApiResponse({
    status: 200,
    description: 'Returns list of available race distances',
  })
  async getRaceDistances() {
    return this.raceResultService.getRaceDistances();
  }

  @Get()
  @ApiOperation({ summary: 'Get race results with filters and pagination' })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated race results',
    type: RaceResultsPaginatedDto,
  })
  async getRaceResults(@Query() dto: GetRaceResultsDto) {
    return this.raceResultService.getRaceResults(dto);
  }

  @Get('search')
  @ApiOperation({ summary: 'Global search by name or bib across all races' })
  @ApiQuery({ name: 'q', type: String, description: 'Search query (name or bib)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max results (default 20)' })
  @ApiResponse({ status: 200, description: 'Returns matching athletes with race info' })
  async globalSearch(
    @Query('q') q: string,
    @Query('limit') limit?: number,
  ) {
    return this.raceResultService.globalSearch(q, limit || 20);
  }

  @Get('leaderboard/:courseId')
  @ApiOperation({ summary: 'Get top N results for a course' })
  @ApiParam({ name: 'courseId', type: 'string', description: 'Course ID' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of top results (default 10)',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns top results for the course',
  })
  async getLeaderboard(
    @Param('courseId') courseId: string,
    @Query('limit') limit?: number,
  ) {
    return this.raceResultService.getLeaderboard(courseId, limit || 10);
  }

  @Get('athlete/:raceId/:bib')
  @ApiOperation({ summary: 'Get athlete detail by race and bib' })
  @ApiParam({ name: 'raceId', type: 'string', description: 'Race ID' })
  @ApiParam({ name: 'bib', type: 'string', description: 'Bib number' })
  @ApiResponse({
    status: 200,
    description: 'Returns athlete result detail with splits',
  })
  async getAthleteDetail(
    @Param('raceId') raceId: string,
    @Param('bib') bib: string,
  ) {
    const result = await this.raceResultService.getAthleteDetail(raceId, bib);
    if (!result) {
      return { data: null, success: false, message: 'Athlete not found' };
    }
    // Strip internal/admin-only fields from public response (info disclosure fix)
    const { _id, editHistory, isManuallyEdited, ...publicData } = result as typeof result & {
      _id?: string;
      editHistory?: unknown[];
      isManuallyEdited?: boolean;
    };
    void _id; void editHistory; void isManuallyEdited;
    return { data: publicData, success: true };
  }

  @Get('certificate/:raceId/:bib')
  @ApiOperation({ summary: 'Get certificate as PNG image for an athlete' })
  @ApiParam({ name: 'raceId', type: 'string', description: 'Race ID' })
  @ApiParam({ name: 'bib', type: 'string', description: 'Bib number' })
  @ApiResponse({ status: 200, description: 'Returns certificate as PNG image' })
  @ApiResponse({ status: 404, description: 'Athlete or certificate not found' })
  async getCertificate(
    @Param('raceId') raceId: string,
    @Param('bib') bib: string,
    @Res() res: Response,
  ) {
    const athlete = await this.raceResultService.getAthleteDetail(raceId, bib);
    if (!athlete || !athlete.Certificate) {
      throw new NotFoundException('Certificate not found');
    }

    const pdfRes = await fetch(athlete.Certificate);
    if (!pdfRes.ok) {
      throw new NotFoundException('Certificate not available');
    }

    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());

    const { pdfToPng } = await import('pdf-to-png-converter');
    const pages = await pdfToPng(pdfBuffer, {
      viewportScale: 3,
      pagesToProcess: [1],
    });

    if (!pages.length || !pages[0].content) {
      throw new NotFoundException('Failed to convert certificate');
    }

    const pngBuffer = pages[0].content;
    res.set({
      'Content-Type': 'image/png',
      'Content-Length': pngBuffer.length.toString(),
      'Cache-Control': 'public, max-age=3600',
      'Content-Disposition': `inline; filename="certificate-${bib}.png"`,
    });
    res.send(pngBuffer);
  }

  @Get('compare/:raceId')
  @ApiOperation({ summary: 'Compare multiple athletes by bibs' })
  @ApiParam({ name: 'raceId', type: 'string', description: 'Race ID' })
  @ApiQuery({
    name: 'bibs',
    type: String,
    description: 'Comma-separated bib numbers',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns results for multiple athletes',
  })
  async compareAthletes(
    @Param('raceId') raceId: string,
    @Query('bibs') bibs: string,
  ) {
    const bibList = bibs ? bibs.split(',').map((b) => b.trim()) : [];
    const results = await this.raceResultService.compareAthletes(
      raceId,
      bibList,
    );
    return { data: results, success: true };
  }

  @Get('filters/:courseId')
  @ApiOperation({ summary: 'Get available filter options (genders, categories) for a course' })
  @ApiParam({ name: 'courseId', type: 'string', description: 'Course ID' })
  @ApiResponse({ status: 200, description: 'Returns distinct genders and categories' })
  async getFilterOptions(@Param('courseId') courseId: string) {
    const filters = await this.raceResultService.getFilterOptions(courseId);
    return { data: filters, success: true };
  }

  @Get('stats/:courseId')
  @ApiOperation({ summary: 'Get aggregated course stats (avg time, finishers, etc.)' })
  @ApiParam({ name: 'courseId', type: 'string', description: 'Course ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns aggregated stats for the course',
  })
  async getCourseStats(@Param('courseId') courseId: string) {
    const stats = await this.raceResultService.getCourseStats(courseId);
    return { data: stats, success: true };
  }

  // ─── F-03: Time Distribution ──────────────────────────────────

  @Get('stats/:courseId/distribution')
  @ApiOperation({
    summary: 'Get finish time distribution histogram for a course (F-03)',
  })
  @ApiParam({ name: 'courseId', type: 'string', description: 'Course ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns histogram buckets + summary stats',
    type: TimeDistributionResponseDto,
  })
  async getTimeDistribution(
    @Param('courseId') courseId: string,
  ): Promise<TimeDistributionResponseDto> {
    const data = await this.raceResultService.getTimeDistribution(courseId);
    return { data, success: true };
  }

  // ─── F-04: Country Stats ──────────────────────────────────────

  @Get('stats/:courseId/countries')
  @ApiOperation({
    summary: 'Get per-country stats (count + best time) for a course (F-04)',
  })
  @ApiParam({ name: 'courseId', type: 'string', description: 'Course ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns top countries with finisher count + best chip time',
    type: CountryStatsResponseDto,
  })
  async getCountryStats(
    @Param('courseId') courseId: string,
  ): Promise<CountryStatsResponseDto> {
    const data = await this.raceResultService.getCountryStats(courseId);
    return { data, success: true };
  }

  @Get('athlete/:raceId/:bib/country-rank')
  @ApiOperation({
    summary: 'Get athlete rank among same-nationality finishers (F-04)',
  })
  @ApiParam({ name: 'raceId', type: 'string', description: 'Race ID' })
  @ApiParam({ name: 'bib', type: 'string', description: 'Bib number' })
  @ApiResponse({
    status: 200,
    description:
      'Returns rank (null if DNF) + total same-nationality finishers',
    type: CountryRankResponseDto,
  })
  async getCountryRank(
    @Param('raceId') raceId: string,
    @Param('bib') bib: string,
  ): Promise<CountryRankResponseDto> {
    const data = await this.raceResultService.getCountryRank(raceId, bib);
    return { data, success: true };
  }

  // ─── F-06: Performance Percentile ─────────────────────────────

  @Get('athlete/:raceId/:bib/percentile')
  @ApiOperation({
    summary: "Get athlete's performance percentile on this course (F-06)",
  })
  @ApiParam({ name: 'raceId', type: 'string', description: 'Race ID' })
  @ApiParam({ name: 'bib', type: 'string', description: 'Bib number' })
  @ApiResponse({
    status: 200,
    description: 'Returns percentile + comparison metrics',
    type: PercentileResponseDto,
  })
  async getPercentile(
    @Param('raceId') raceId: string,
    @Param('bib') bib: string,
  ): Promise<PercentileResponseDto> {
    const data = await this.raceResultService.getPercentile(raceId, bib);
    return { data, success: true };
  }

  @Post('avatar/request-otp')
  @ApiOperation({ summary: 'Request OTP to verify email before avatar upload' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['raceId', 'bib', 'email'],
      properties: {
        raceId: { type: 'string' },
        bib: { type: 'string' },
        email: { type: 'string', format: 'email' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'OTP sent to registered email' })
  @ApiResponse({ status: 400, description: 'Email does not match or no email on record' })
  @ApiResponse({ status: 404, description: 'Athlete not found' })
  async requestAvatarOtp(
    @Body('raceId') raceId: string,
    @Body('bib') bib: string,
    @Body('email') email: string,
  ) {
    if (!raceId || !bib || !email) {
      throw new BadRequestException('raceId, bib and email are required');
    }
    return this.raceResultService.requestAvatarOtp(raceId, bib, email);
  }

  @Post('avatar/upload')
  @ApiOperation({ summary: 'Upload avatar after OTP verification' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['raceId', 'bib', 'otp', 'file'],
      properties: {
        raceId: { type: 'string' },
        bib: { type: 'string' },
        otp: { type: 'string' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Avatar uploaded, returns avatarUrl' })
  @ApiResponse({ status: 400, description: 'Invalid OTP or upload failed' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadAvatar(
    @Body('raceId') raceId: string,
    @Body('bib') bib: string,
    @Body('otp') otp: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!raceId || !bib || !otp) {
      throw new BadRequestException('raceId, bib and otp are required');
    }
    if (!file) throw new BadRequestException('No file uploaded');
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Only JPG, PNG or WebP images allowed');
    }
    return this.raceResultService.uploadAvatar(raceId, bib, otp, file);
  }

  @Post('claims/upload')
  @ApiOperation({ summary: 'Upload attachment for a claim (tracklog, screenshot)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'File uploaded, returns URL' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max for tracklog files
    }),
  )
  async uploadClaimAttachment(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const allowed = [
      'application/gpx+xml',
      'application/xml',
      'text/xml',
      'application/vnd.google-earth.kml+xml',
      'application/vnd.google-earth.kmz',
      'application/octet-stream',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'application/zip',
    ];
    // Also allow by extension for GPX/KML/FIT files
    const ext = file.originalname?.split('.').pop()?.toLowerCase() || '';
    const allowedExts = ['gpx', 'kml', 'kmz', 'fit', 'tcx', 'jpg', 'jpeg', 'png', 'webp', 'pdf', 'zip'];
    if (!allowed.includes(file.mimetype) && !allowedExts.includes(ext)) {
      throw new BadRequestException(
        'File type not allowed. Supported: GPX, KML, KMZ, FIT, TCX, JPG, PNG, PDF, ZIP',
      );
    }
    const url = await this.uploadService.uploadFile(file);
    if (!url) {
      throw new BadRequestException('Upload failed');
    }
    return { url };
  }

  @Post('claims')
  @ApiOperation({ summary: 'Submit a result claim' })
  @ApiResponse({ status: 201, description: 'Claim created' })
  async submitClaim(@Body() dto: SubmitClaimDto) {
    return this.raceResultService.submitClaim(dto);
  }

  // ─── Result Image Creator v1.0 ────────────────────────────────
  //
  // Three public endpoints:
  //   GET  /race-results/result-image/:raceId/:bib  → lowres preview (no cache)
  //   POST /race-results/result-image/:raceId/:bib  → full-res PNG (S3-cached)
  //   GET  /race-results/badges/:raceId/:bib        → badge list (cached 1h)
  //
  // All are PUBLIC per PRD BR-01 (no login required).
  // Rate-limited per IP to protect against scraping + brute-force cache busting.

  @Get('result-image/:raceId/:bib')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({
    summary: 'Preview result image (lowres, ~480px, no cache) — for template picker',
  })
  @ApiParam({ name: 'raceId', type: 'string', description: 'Race ID' })
  @ApiParam({ name: 'bib', type: 'string', description: 'Bib number' })
  @ApiResponse({ status: 200, description: 'Returns preview PNG' })
  @ApiResponse({ status: 404, description: 'Athlete not found' })
  async previewResultImage(
    @Param('raceId') raceId: string,
    @Param('bib') bib: string,
    @Query() query: ResultImageQueryDto,
    @Res() res: Response,
  ) {
    this.assertSafePathParam(raceId, 'raceId');
    this.assertSafePathParam(bib, 'bib');

    const athleteInput = await this.loadAthleteInput(raceId, bib);
    const { raceName, raceSlug, courseName } = await this.loadRaceMeta(raceId);

    const config = normalizeImageConfig({ ...query, preview: true });

    const result = await this.resultImageService.generate({
      raceId,
      bib,
      athlete: athleteInput,
      raceName,
      raceSlug,
      courseName,
      config,
    });

    res.set({
      'Content-Type': 'image/png',
      'Content-Length': result.buffer.length.toString(),
      'Cache-Control': 'no-store',
      'Content-Disposition': `inline; filename="preview-${bib}.png"`,
    });
    res.send(result.buffer);
  }

  @Post('result-image/:raceId/:bib')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({
    summary: 'Generate full-res result image for an athlete (S3-cached)',
  })
  @ApiParam({ name: 'raceId', type: 'string', description: 'Race ID' })
  @ApiParam({ name: 'bib', type: 'string', description: 'Bib number' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description:
      'Full config: template, size, gradient, show* toggles, optional customPhoto + customMessage. ' +
      'Backward-compat: `bg` aliases to `gradient`, `ratio` aliases to `size`.',
    schema: {
      type: 'object',
      properties: {
        template: {
          type: 'string',
          enum: [
            'classic',
            'celebration',
            'endurance',
            'story',
            'sticker',
            'podium',
          ],
          default: 'classic',
        },
        size: {
          type: 'string',
          enum: ['4:5', '1:1', '9:16'],
          default: '4:5',
        },
        gradient: {
          type: 'string',
          enum: ['blue', 'dark', 'sunset', 'forest', 'purple'],
          default: 'blue',
        },
        bg: {
          type: 'string',
          description: 'DEPRECATED — alias for `gradient`',
        },
        ratio: {
          type: 'string',
          description: 'DEPRECATED — alias for `size`',
        },
        showSplits: { type: 'boolean', default: false },
        showQrCode: { type: 'boolean', default: false },
        showBadges: { type: 'boolean', default: true },
        textColor: {
          type: 'string',
          enum: ['auto', 'light', 'dark'],
          default: 'auto',
        },
        customMessage: { type: 'string', maxLength: 50 },
        customPhoto: {
          type: 'string',
          format: 'binary',
          description: 'Custom background photo (JPG/PNG/WebP, ≤10MB)',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Returns result image as PNG' })
  @ApiResponse({ status: 404, description: 'Athlete not found' })
  @ApiResponse({
    status: 503,
    description: 'Render queue full — retry later',
  })
  // Accept BOTH field names: `customPhoto` (new) and `customBg` (legacy from
  // previous POST endpoint). Prevents silent data loss for clients still
  // using the old field name.
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'customPhoto', maxCount: 1 },
        { name: 'customBg', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: 10 * 1024 * 1024 },
      },
    ),
  )
  async generateResultImage(
    @Param('raceId') raceId: string,
    @Param('bib') bib: string,
    @Body() body: ResultImageQueryDto,
    @UploadedFiles()
    files:
      | { customPhoto?: Express.Multer.File[]; customBg?: Express.Multer.File[] }
      | undefined,
    @Res() res: Response,
  ) {
    this.assertSafePathParam(raceId, 'raceId');
    this.assertSafePathParam(bib, 'bib');

    const customPhotoFile =
      files?.customPhoto?.[0] ?? files?.customBg?.[0] ?? undefined;

    const athleteInput = await this.loadAthleteInput(raceId, bib);
    const { raceName, raceSlug, courseName } = await this.loadRaceMeta(raceId);

    const config = normalizeImageConfig({ ...body, preview: false });

    const result = await this.resultImageService.generate({
      raceId,
      bib,
      athlete: athleteInput,
      raceName,
      raceSlug,
      courseName,
      config,
      customPhotoBuffer: customPhotoFile?.buffer,
    });

    res.set({
      'Content-Type': 'image/png',
      'Content-Length': result.buffer.length.toString(),
      // Let CDN/browser cache the same payload we just returned (same key = same bytes)
      'Cache-Control': 'public, max-age=300',
      'Content-Disposition': `inline; filename="result-${bib}.png"`,
      'X-From-Cache': result.fromCache ? '1' : '0',
    });
    res.send(result.buffer);
  }

  @Get('badges/:raceId/:bib')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @ApiOperation({
    summary: 'Get badges (PB / Podium / Sub-X / Ultra / Streak) for an athlete',
  })
  @ApiParam({ name: 'raceId', type: 'string', description: 'Race ID' })
  @ApiParam({ name: 'bib', type: 'string', description: 'Bib number' })
  @ApiResponse({ status: 200, description: 'Returns badge list' })
  async getAthleteBadges(
    @Param('raceId') raceId: string,
    @Param('bib') bib: string,
  ) {
    this.assertSafePathParam(raceId, 'raceId');
    this.assertSafePathParam(bib, 'bib');

    // Confirm athlete exists before running badge detection
    const athlete = await this.raceResultService.getAthleteDetail(raceId, bib);
    if (!athlete) {
      throw new NotFoundException('Athlete not found');
    }
    const badges = await this.badgeService.detectBadges(raceId, bib);
    return { data: badges, success: true };
  }

  @Get('share-count/:raceId')
  @ApiOperation({ summary: 'Get current share counter for a race' })
  @ApiParam({ name: 'raceId', type: 'string', description: 'Race ID' })
  @ApiResponse({ status: 200, description: 'Returns share count' })
  async getShareCount(@Param('raceId') raceId: string) {
    this.assertSafePathParam(raceId, 'raceId');
    const count = await this.resultImageService.getShareCount(raceId);
    return { data: { raceId, count }, success: true };
  }

  @Post('share-count/:raceId')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({
    summary:
      'Increment share counter for a race (called after user shares an image)',
  })
  @ApiParam({ name: 'raceId', type: 'string', description: 'Race ID' })
  @ApiResponse({ status: 201, description: 'Returns updated share count' })
  async incrementShareCount(@Param('raceId') raceId: string) {
    this.assertSafePathParam(raceId, 'raceId');
    const count = await this.resultImageService.incrementShareCount(raceId);
    return { data: { raceId, count }, success: true };
  }

  // ─── Helpers for result-image endpoints ──────────────────────

  /**
   * Path params flow into S3 keys + Redis keys. A bib like `"../../"` would
   * not escape S3 (no `..` resolution) but could pollute cache with garbage.
   * Allow only alphanumeric + `_` + `-`, 1-24 chars.
   */
  private assertSafePathParam(value: string, name: string): void {
    if (!value || !/^[A-Za-z0-9_-]{1,24}$/.test(value)) {
      throw new BadRequestException(
        `Invalid ${name}: must be 1-24 alphanumeric / dash / underscore chars`,
      );
    }
  }

  private async loadAthleteInput(
    raceId: string,
    bib: string,
  ): Promise<AthleteInput> {
    const athlete = await this.raceResultService.getAthleteDetail(raceId, bib);
    if (!athlete) {
      throw new NotFoundException('Athlete not found');
    }
    const a = athlete as typeof athlete & { updated_at?: string | Date | null };
    return {
      Name: athlete.Name ?? '',
      Bib: athlete.Bib ?? bib,
      ChipTime: athlete.ChipTime ?? '',
      GunTime: athlete.GunTime ?? '',
      Pace: athlete.Pace ?? '',
      Gap: athlete.Gap || '--',
      Gender: athlete.Gender ?? '',
      Category: athlete.Category ?? '',
      OverallRank: athlete.OverallRank ?? '',
      GenderRank: athlete.GenderRank ?? '',
      CatRank: athlete.CatRank ?? '',
      distance: athlete.distance ?? '',
      splits: Array.isArray(athlete.splits)
        ? (athlete.splits as AthleteInput['splits'])
        : undefined,
      updatedAt: a.updated_at ?? null,
    };
  }

  private async loadRaceMeta(
    raceId: string,
  ): Promise<{ raceName: string; raceSlug: string; courseName: string }> {
    try {
      const race = await this.racesService.getRaceById(raceId);
      return {
        raceName: race?.data?.title ?? '',
        raceSlug: race?.data?.slug ?? '',
        courseName: '',
      };
    } catch {
      return { raceName: '', raceSlug: '', courseName: '' };
    }
  }

  @UseGuards(LogtoAdminGuard)
  @Post('sync')
  @ApiOperation({ summary: 'Manually trigger race results sync' })
  @ApiResponse({
    status: 200,
    description: 'Sync completed successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Sync completed successfully',
        },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 500, description: 'Sync failed' })
  async manualSync() {
    await this.raceResultService.syncAllRaceResults();
    return {
      message: 'Sync completed successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
