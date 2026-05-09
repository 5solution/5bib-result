import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { RacesService } from './races.service';
import { CourseMapService } from './services/course-map.service';
import { SearchRacesDto } from './dto/search-races.dto';
import { CreateRaceDto } from './dto/create-race.dto';
import { UpdateRaceDto } from './dto/update-race.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { ForceUpdateStatusDto } from './dto/force-update-status.dto';
import { AddCourseDto } from './dto/add-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CourseMapUploadResultDto } from './dto/course-map-upload-result.dto';
import { CourseMapDataDto } from './dto/course-map-data.dto';
import { UpdateCheckpointPositionDto } from './dto/update-checkpoint-position.dto';
import {
  LogtoAdminGuard,
  OptionalLogtoAuthGuard,
  type AuthenticatedRequest,
} from '../logto-auth';

const GPX_MAX_BYTES = 10 * 1024 * 1024;

@ApiTags('Races')
@Controller('races')
export class RacesController {
  constructor(
    private readonly racesService: RacesService,
    private readonly courseMapService: CourseMapService,
  ) {}

  // ─── Search / Read ────────────────────────────────────────────

  @Get()
  @UseGuards(OptionalLogtoAuthGuard)
  @ApiOperation({
    summary: 'Search and list races with filters and pagination',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated list of races',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            totalPages: { type: 'number', example: 5 },
            currentPage: { type: 'number', example: 0 },
            totalItems: { type: 'number', example: 42 },
            list: { type: 'array', items: { type: 'object' } },
          },
        },
        success: { type: 'boolean', example: true },
      },
    },
  })
  async searchRaces(@Query() dto: SearchRacesDto, @Req() req: AuthenticatedRequest) {
    const isAdmin = !!req.user;
    return this.racesService.searchRaces(dto, isAdmin);
  }

  @Get('slug/:slug')
  @UseGuards(OptionalLogtoAuthGuard)
  @ApiOperation({ summary: 'Get race by slug (SEO-friendly)' })
  @ApiParam({ name: 'slug', type: 'string', description: 'Race slug' })
  @ApiResponse({ status: 200, description: 'Returns race details' })
  @ApiResponse({ status: 404, description: 'Race not found' })
  async getRaceBySlug(@Param('slug') slug: string, @Req() req: AuthenticatedRequest) {
    const isAdmin = !!req.user;
    return this.racesService.getRaceBySlug(slug, isAdmin);
  }

  @Get(':id')
  @UseGuards(OptionalLogtoAuthGuard)
  @ApiOperation({ summary: 'Get race by ID' })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Race ID (MongoDB ObjectId)',
  })
  @ApiResponse({ status: 200, description: 'Returns race details with courses' })
  @ApiResponse({ status: 404, description: 'Race not found' })
  async getRaceById(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const isAdmin = !!req.user;
    return this.racesService.getRaceById(id, isAdmin);
  }

  @Get('product/:productId')
  @ApiOperation({ summary: 'Get race by product ID' })
  @ApiParam({
    name: 'productId',
    type: 'string',
    description: 'Product ID',
  })
  @ApiResponse({ status: 200, description: 'Returns race details with courses' })
  @ApiResponse({ status: 404, description: 'Race not found' })
  async getRaceByProductId(@Param('productId') productId: string) {
    return this.racesService.getRaceByProductId(productId);
  }

  // ─── Admin CRUD ───────────────────────────────────────────────

  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth('JWT-auth')
  @Post()
  @ApiOperation({ summary: 'Create a new race (admin)' })
  @ApiResponse({ status: 201, description: 'Race created' })
  async createRace(@Body() dto: CreateRaceDto) {
    return this.racesService.createRace(dto);
  }

  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch(':id')
  @ApiOperation({ summary: 'Update a race (admin)' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, description: 'Race updated' })
  @ApiResponse({ status: 404, description: 'Race not found' })
  async updateRace(@Param('id') id: string, @Body() dto: UpdateRaceDto) {
    return this.racesService.updateRace(id, dto);
  }

  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth('JWT-auth')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a race (admin)' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, description: 'Race deleted' })
  @ApiResponse({ status: 404, description: 'Race not found' })
  async deleteRace(@Param('id') id: string) {
    return this.racesService.deleteRace(id);
  }

  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch(':id/status')
  @ApiOperation({ summary: 'Update race lifecycle status (admin)' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  @ApiResponse({ status: 404, description: 'Race not found' })
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.racesService.updateStatus(id, dto);
  }

  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch(':id/status/force')
  @ApiOperation({
    summary:
      'Admin override — bypass forward-only state machine (requires reason, audit logged)',
  })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, description: 'Status overridden, audit entry appended' })
  @ApiResponse({ status: 400, description: 'Invalid reason (min 10 chars)' })
  @ApiResponse({ status: 404, description: 'Race not found' })
  async forceUpdateStatus(
    @Param('id') id: string,
    @Body() dto: ForceUpdateStatusDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const adminId = req.user?.userId ?? req.user?.sub ?? 'unknown';
    return this.racesService.forceUpdateStatus(id, dto, adminId);
  }

  // ─── Course management ────────────────────────────────────────

  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth('JWT-auth')
  @Post(':id/courses')
  @ApiOperation({ summary: 'Add a course to a race (admin)' })
  @ApiParam({ name: 'id', type: 'string', description: 'Race ID' })
  @ApiResponse({ status: 201, description: 'Course added' })
  @ApiResponse({ status: 404, description: 'Race not found' })
  async addCourse(@Param('id') id: string, @Body() dto: AddCourseDto) {
    return this.racesService.addCourse(id, dto);
  }

  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch(':id/courses/:courseId')
  @ApiOperation({ summary: 'Update a course in a race (admin)' })
  @ApiParam({ name: 'id', type: 'string', description: 'Race ID' })
  @ApiParam({ name: 'courseId', type: 'string', description: 'Course ID' })
  @ApiResponse({ status: 200, description: 'Course updated' })
  @ApiResponse({ status: 404, description: 'Race or course not found' })
  async updateCourse(
    @Param('id') id: string,
    @Param('courseId') courseId: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.racesService.updateCourse(id, courseId, dto);
  }

  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth('JWT-auth')
  @Delete(':id/courses/:courseId')
  @ApiOperation({ summary: 'Remove a course from a race (admin)' })
  @ApiParam({ name: 'id', type: 'string', description: 'Race ID' })
  @ApiParam({ name: 'courseId', type: 'string', description: 'Course ID' })
  @ApiResponse({ status: 200, description: 'Course removed' })
  @ApiResponse({ status: 404, description: 'Race not found' })
  async removeCourse(
    @Param('id') id: string,
    @Param('courseId') courseId: string,
  ) {
    return this.racesService.removeCourse(id, courseId);
  }

  // ─── Sync ─────────────────────────────────────────────────────

  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('sync')
  @ApiOperation({ summary: 'Manually sync races from source API' })
  @ApiResponse({
    status: 200,
    description: 'Sync completed successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Successfully synced 10 races' },
        count: { type: 'number', example: 10 },
        success: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 500, description: 'Sync failed' })
  async syncRaces() {
    return this.racesService.syncRacesFromSource();
  }

  // ─── Course map (FEATURE-006) ─────────────────────────────────

  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth('JWT-auth')
  @Post(':raceId/courses/:courseId/gpx')
  @ApiOperation({
    summary:
      'Upload GPX/KML for a course (admin). Server parses, simplifies, uploads to S3, and auto-matches waypoints to checkpoint keys.',
  })
  @ApiParam({ name: 'raceId', type: 'string' })
  @ApiParam({ name: 'courseId', type: 'string' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 200, type: CourseMapUploadResultDto })
  @ApiResponse({ status: 400, description: 'File invalid, > 10MB, or wrong extension' })
  @ApiResponse({ status: 404, description: 'Race or course not found' })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: GPX_MAX_BYTES } }),
  )
  async uploadCourseGpx(
    @Param('raceId') raceId: string,
    @Param('courseId') courseId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<CourseMapUploadResultDto> {
    if (!file || !file.buffer) {
      throw new BadRequestException(
        'No file uploaded. Send as multipart/form-data with field name "file"',
      );
    }
    if (file.size > GPX_MAX_BYTES) {
      throw new BadRequestException('File vượt quá 10MB');
    }
    const lower = (file.originalname ?? '').toLowerCase();
    if (!lower.endsWith('.gpx') && !lower.endsWith('.kml')) {
      throw new BadRequestException('Chỉ chấp nhận file .gpx hoặc .kml');
    }

    // 1. Parse + simplify (BR-CM-02/03/06)
    const parsed = await this.courseMapService.parseGpxOrKml(
      file.buffer,
      file.originalname,
    );

    // 2. Resolve race/course so we can match waypoints
    const raceResp = await this.racesService.getRaceById(raceId, true);
    if (!raceResp.success || !raceResp.data) {
      throw new NotFoundException('Race not found');
    }
    const courses = (raceResp.data as { courses?: { courseId: string; checkpoints?: { key: string }[] }[] }).courses ?? [];
    const course = courses.find((c) => c.courseId === courseId);
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    const matchResult = this.courseMapService.matchWaypoints(
      parsed.waypoints,
      course.checkpoints ?? [],
    );

    // 3. Upload to S3 (replace semantics — old keys deleted first)
    const { gpxUrl, gpxSimplifiedUrl } = await this.courseMapService.uploadGpxToS3(
      raceId,
      courseId,
      file.buffer,
      parsed.simplifiedGeoJson,
      file.originalname,
    );

    // 4. Persist gpxUrl + gpxParsed + gpxSimplifiedUrl + auto-matched lat/lng
    //    via UpdateCourseDto. Auto-matched checkpoints overlay onto the
    //    existing checkpoints array — unmatched keys retain their prior
    //    lat/lng (Clarification 4 — never clobber manually-set positions).
    const existingCheckpoints = (course.checkpoints ?? []) as {
      key: string;
      lat?: number;
      lng?: number;
    }[];
    const matchedByKey = new Map(
      matchResult.matched.map((m) => [m.key, { lat: m.lat, lng: m.lng }]),
    );
    const mergedCheckpoints = existingCheckpoints.map((cp) => {
      const m = matchedByKey.get(cp.key);
      return m ? { ...cp, lat: m.lat, lng: m.lng } : cp;
    });

    await this.racesService.updateCourse(raceId, courseId, {
      gpxUrl,
      gpxSimplifiedUrl,
      gpxParsed: parsed.gpxParsed,
      checkpoints: mergedCheckpoints as never,
    });

    // 5. Cache invalidate (RacesService.updateCourse already does this,
    //    but explicit call documents intent + safe if cache hook drifts).
    await this.courseMapService.invalidateMapDataCache(raceId, courseId);

    return {
      gpxParsed: parsed.gpxParsed,
      gpxSimplifiedUrl,
      autoMatchedCheckpoints: matchResult.matched,
      unmatchedCheckpointKeys: matchResult.unmatchedKeys,
    };
  }

  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth('JWT-auth')
  @Delete(':raceId/courses/:courseId/gpx')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Delete the uploaded GPX/KML for a course (admin). Manually-set checkpoint lat/lng are preserved (Clarification 4).',
  })
  @ApiParam({ name: 'raceId', type: 'string' })
  @ApiParam({ name: 'courseId', type: 'string' })
  @ApiResponse({ status: 200, description: 'GPX removed (S3 + DB unset)' })
  @ApiResponse({ status: 404, description: 'Race or course not found' })
  async deleteCourseGpx(
    @Param('raceId') raceId: string,
    @Param('courseId') courseId: string,
  ): Promise<{ ok: true }> {
    // Validate race+course exist (404 path)
    const raceResp = await this.racesService.getRaceById(raceId, true);
    if (!raceResp.success || !raceResp.data) {
      throw new NotFoundException('Race not found');
    }
    const courses = (raceResp.data as { courses?: { courseId: string }[] }).courses ?? [];
    if (!courses.find((c) => c.courseId === courseId)) {
      throw new NotFoundException('Course not found');
    }

    // S3 delete first — graceful on missing keys.
    await this.courseMapService.deleteGpxFromS3(raceId, courseId);

    // DB unset gpxUrl / gpxSimplifiedUrl / gpxParsed.
    // IMPORTANT: do NOT touch checkpoints[] — manual lat/lng must be preserved
    // per Clarification 4 in 02-manager-plan.md.
    await this.racesService.updateCourse(raceId, courseId, {
      gpxUrl: undefined,
      gpxSimplifiedUrl: undefined,
      gpxParsed: undefined,
    } as UpdateCourseDto);

    await this.courseMapService.invalidateMapDataCache(raceId, courseId);
    return { ok: true };
  }

  @UseGuards(LogtoAdminGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch(':raceId/courses/:courseId/checkpoint-position')
  @ApiOperation({
    summary:
      'Update a single checkpoint position (admin) — used by Leaflet manual-drag mode (BR-CM-05).',
  })
  @ApiParam({ name: 'raceId', type: 'string' })
  @ApiParam({ name: 'courseId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Checkpoint position updated' })
  @ApiResponse({ status: 400, description: 'Invalid lat/lng (out of WGS84 bounds)' })
  @ApiResponse({ status: 404, description: 'Race, course, or checkpoint key not found' })
  async updateCheckpointPosition(
    @Param('raceId') raceId: string,
    @Param('courseId') courseId: string,
    @Body() dto: UpdateCheckpointPositionDto,
  ): Promise<{ ok: true }> {
    const raceResp = await this.racesService.getRaceById(raceId, true);
    if (!raceResp.success || !raceResp.data) {
      throw new NotFoundException('Race not found');
    }
    const courses = (raceResp.data as { courses?: { courseId: string; checkpoints?: { key: string; name: string }[] }[] }).courses ?? [];
    const course = courses.find((c) => c.courseId === courseId);
    if (!course) throw new NotFoundException('Course not found');

    const checkpoints = (course.checkpoints ?? []) as {
      key: string;
      name: string;
      lat?: number;
      lng?: number;
    }[];
    const target = checkpoints.find((cp) => cp.key === dto.key);
    if (!target) {
      throw new NotFoundException(`Checkpoint key "${dto.key}" not found`);
    }
    const merged = checkpoints.map((cp) =>
      cp.key === dto.key ? { ...cp, lat: dto.lat, lng: dto.lng } : cp,
    );

    await this.racesService.updateCourse(raceId, courseId, {
      checkpoints: merged as never,
    });
    await this.courseMapService.invalidateMapDataCache(raceId, courseId);
    return { ok: true };
  }

  @Get(':raceId/courses/:courseId/map-data')
  @ApiOperation({
    summary:
      'Get public map-data for a course (public). Gated by race.status >= pre_race; draft races return 404.',
  })
  @ApiParam({ name: 'raceId', type: 'string' })
  @ApiParam({ name: 'courseId', type: 'string' })
  @ApiResponse({ status: 200, type: CourseMapDataDto })
  @ApiResponse({ status: 404, description: 'Race in draft status, or race/course not found' })
  async getCourseMapData(
    @Param('raceId') raceId: string,
    @Param('courseId') courseId: string,
  ): Promise<CourseMapDataDto> {
    return this.courseMapService.getCachedMapData(raceId, courseId);
  }
}
