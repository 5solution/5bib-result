import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HttpService } from '@nestjs/axios';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { firstValueFrom } from 'rxjs';
import { Race, RaceDocument } from './schemas/race.schema';
import { SearchRacesDto } from './dto/search-races.dto';
import { CreateRaceDto } from './dto/create-race.dto';
import { UpdateRaceDto } from './dto/update-race.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { ForceUpdateStatusDto } from './dto/force-update-status.dto';
import { AddCourseDto } from './dto/add-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@Injectable()
export class RacesService {
  private readonly logger = new Logger(RacesService.name);

  constructor(
    @InjectModel(Race.name) private readonly raceModel: Model<RaceDocument>,
    private readonly httpService: HttpService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  private async getRaceFromCache(key: string): Promise<any | null> {
    try {
      const raw = await this.redis.get(key);
      if (raw) return JSON.parse(raw);
    } catch { /* Redis down — fall through to DB */ }
    return null;
  }

  private async setRaceCache(key: string, value: any, ttl = 300): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttl);
    } catch { /* Redis down — non-fatal */ }
  }

  private async invalidateRaceCache(id: string, slug?: string): Promise<void> {
    try {
      const keys = [`race:id:${id}`];
      if (slug) keys.push(`race:slug:${slug}`);
      await this.redis.del(...keys);
    } catch { /* ignore */ }
  }

  /**
   * Strip internal Mongo fields (_id, __v) from a lean race object before
   * returning on PUBLIC endpoints. Admin callers opt out via allowDraft=true.
   * Keeps the rest of the payload intact.
   */
  private stripRacePrivateFields<T extends { _id?: unknown; __v?: unknown }>(
    race: T,
  ): Omit<T, '_id' | '__v'> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, __v, ...publicRace } = race;
    return publicRace;
  }

  // ─── Admin CRUD ──────────────────────────────────────────────

  async createRace(dto: CreateRaceDto) {
    const slug =
      dto.slug ||
      dto.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

    const race = await this.raceModel.create({
      ...dto,
      slug,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
    });

    return { data: race.toObject(), success: true };
  }

  async updateRace(id: string, dto: UpdateRaceDto) {
    const update: Record<string, any> = { ...dto };
    if (dto.startDate) update.startDate = new Date(dto.startDate);
    if (dto.endDate) update.endDate = new Date(dto.endDate);

    const race = await this.raceModel
      .findByIdAndUpdate(id, { $set: update }, { new: true })
      .lean()
      .exec();

    if (!race) {
      throw new NotFoundException('Race not found');
    }

    await this.invalidateRaceCache(id, race.slug);
    return { data: race, success: true };
  }

  async deleteRace(id: string) {
    const race = await this.raceModel.findByIdAndDelete(id).lean().exec();

    if (!race) {
      throw new NotFoundException('Race not found');
    }

    await this.invalidateRaceCache(id, race.slug);
    return { data: race, success: true, message: 'Race deleted' };
  }

  async updateStatus(id: string, dto: UpdateStatusDto) {
    const race = await this.raceModel.findById(id).lean().exec();

    if (!race) {
      throw new NotFoundException('Race not found');
    }

    // State machine: enforce valid transitions
    type RaceStatus = 'draft' | 'pre_race' | 'live' | 'ended';
    const ORDER: Record<RaceStatus, number> = { draft: 0, pre_race: 1, live: 2, ended: 3 };
    const current = race.status as RaceStatus;
    const next = dto.status as RaceStatus;

    if (current === 'ended') {
      throw new BadRequestException(`Cannot transition from 'ended' to any other status`);
    }
    if (ORDER[next] < ORDER[current]) {
      throw new BadRequestException(
        `Invalid status transition: '${current}' → '${next}'. Only forward transitions are allowed.`,
      );
    }

    const updated = await this.raceModel
      .findByIdAndUpdate(id, { $set: { status: dto.status } }, { new: true })
      .lean()
      .exec();

    if (updated) await this.invalidateRaceCache(id, updated.slug);
    return { data: updated, success: true };
  }

  /**
   * Admin override: bypass forward-only state machine. Requires reason (audit).
   * Every override is appended to race.statusHistory.
   */
  async forceUpdateStatus(id: string, dto: ForceUpdateStatusDto, adminId: string) {
    const race = await this.raceModel.findById(id).lean().exec();
    if (!race) {
      throw new NotFoundException('Race not found');
    }

    const from = race.status;
    const to = dto.status;

    // No-op: target equals current → don't pollute history
    if (from === to) {
      return { data: race, success: true, message: 'Status unchanged' };
    }

    const historyEntry = {
      from,
      to,
      reason: dto.reason.trim(),
      changedBy: adminId,
      changedAt: new Date(),
    };

    const updated = await this.raceModel
      .findByIdAndUpdate(
        id,
        {
          $set: { status: to },
          $push: { statusHistory: historyEntry },
        },
        { new: true },
      )
      .lean()
      .exec();

    if (updated) {
      await this.invalidateRaceCache(id, updated.slug);
      this.logger.warn(
        `Admin status override: race=${id} ${from}→${to} by=${adminId} reason="${dto.reason.slice(0, 80)}"`,
      );
    }
    return { data: updated, success: true };
  }

  // ─── Course management ───────────────────────────────────────

  async addCourse(raceId: string, dto: AddCourseDto) {
    if (!dto.courseId) {
      dto.courseId = dto.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    const race = await this.raceModel
      .findByIdAndUpdate(
        raceId,
        { $push: { courses: dto } },
        { new: true },
      )
      .lean()
      .exec();

    if (!race) {
      throw new NotFoundException('Race not found');
    }

    await this.invalidateRaceCache(raceId, race.slug);
    return { data: race, success: true };
  }

  async updateCourse(raceId: string, courseId: string, dto: UpdateCourseDto) {
    const setFields: Record<string, any> = {};
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) {
        setFields[`courses.$.${key}`] = value;
      }
    }

    const race = await this.raceModel
      .findOneAndUpdate(
        { _id: raceId, 'courses.courseId': courseId },
        { $set: setFields },
        { new: true },
      )
      .lean()
      .exec();

    if (!race) {
      throw new NotFoundException('Race or course not found');
    }

    await this.invalidateRaceCache(raceId, race.slug);
    return { data: race, success: true };
  }

  async removeCourse(raceId: string, courseId: string) {
    const race = await this.raceModel
      .findByIdAndUpdate(
        raceId,
        { $pull: { courses: { courseId } } },
        { new: true },
      )
      .lean()
      .exec();

    if (!race) {
      throw new NotFoundException('Race not found');
    }

    await this.invalidateRaceCache(raceId, race.slug);
    return { data: race, success: true, message: 'Course removed' };
  }

  // ─── Queries ─────────────────────────────────────────────────

  async searchRaces(dto: SearchRacesDto) {
    const {
      title,
      status,
      province,
      season,
      race_type,
      page = 0,
      pageSize = 10,
    } = dto;

    const filter: Record<string, any> = {};

    if (title) {
      filter.title = { $regex: title, $options: 'i' };
    }

    if (status && status !== 'all') {
      filter.status = status;
    } else if (!status) {
      filter.status = { $ne: 'draft' };
    }
    // status === 'all' → no filter, include drafts

    if (province) {
      filter.province = province;
    }

    if (season) {
      filter.season = season;
    }

    if (race_type) {
      filter.raceType = race_type;
    }

    const [list, totalItems] = await Promise.all([
      this.raceModel
        .find(filter)
        .sort({ startDate: -1, created_at: -1 })
        .skip(page * pageSize)
        .limit(pageSize)
        .lean()
        .exec(),
      this.raceModel.countDocuments(filter).exec(),
    ]);

    const totalPages = Math.ceil(totalItems / pageSize);

    return {
      data: {
        totalPages,
        currentPage: page,
        totalItems,
        list,
      },
      success: true,
    };
  }

  async getRaceById(id: string, allowDraft = false) {
    const cacheKey = `race:id:${id}`;
    const cached = await this.getRaceFromCache(cacheKey);
    if (cached && (!cached.status || allowDraft || cached.status !== 'draft')) {
      if (!allowDraft && cached.status === 'draft') {
        return { data: null, success: false, message: 'Race not found' };
      }
      const payload = allowDraft ? cached : this.stripRacePrivateFields(cached);
      return { data: payload, success: true };
    }

    const race = await this.raceModel.findById(id).lean().exec();

    if (!race || (!allowDraft && race.status === 'draft')) {
      return { data: null, success: false, message: 'Race not found' };
    }

    await this.setRaceCache(cacheKey, race, 300);
    const payload = allowDraft ? race : this.stripRacePrivateFields(race);
    return { data: payload, success: true };
  }

  async getRaceBySlug(slug: string, allowDraft = false) {
    const cacheKey = `race:slug:${slug}`;
    const cached = await this.getRaceFromCache(cacheKey);
    if (cached) {
      if (!allowDraft && cached.status === 'draft') {
        return { data: null, success: false, message: 'Race not found' };
      }
      const payload = allowDraft ? cached : this.stripRacePrivateFields(cached);
      return { data: payload, success: true };
    }

    const race = await this.raceModel.findOne({ slug }).lean().exec();

    if (!race || (!allowDraft && race.status === 'draft')) {
      return { data: null, success: false, message: 'Race not found' };
    }

    // Cache including draft races (allowDraft check is at read time)
    await this.setRaceCache(cacheKey, race, 300);
    const payload = allowDraft ? race : this.stripRacePrivateFields(race);
    return { data: payload, success: true };
  }

  async getRaceByProductId(productId: string) {
    const race = await this.raceModel
      .findOne({ productId })
      .lean()
      .exec();

    if (!race) {
      return {
        data: null,
        success: false,
        message: 'Race not found',
      };
    }

    return {
      data: this.stripRacePrivateFields(race),
      success: true,
    };
  }

  /**
   * Get all races that have courses with apiUrl configured (for sync)
   */
  async getRacesWithApiUrls(): Promise<RaceDocument[]> {
    return this.raceModel
      .find({
        'courses.apiUrl': { $exists: true, $ne: null },
        status: { $in: ['pre_race', 'live', 'ended'] },
      })
      .exec();
  }

  async findByIds(ids: string[]): Promise<RaceDocument[]> {
    return this.raceModel.find({ _id: { $in: ids } }).lean().exec();
  }

  async syncRacesFromSource() {
    try {
      this.logger.log('Starting race sync from source API...');

      const sourceUrl = 'https://api.5bib.com/pub/race';
      const params = { pageSize: 100 };

      const response = await firstValueFrom(
        this.httpService.get(sourceUrl, { params }),
      );

      const races = response.data?.data?.list || [];

      if (!races.length) {
        this.logger.warn('No races found from source API');
        return {
          message: 'No races found from source',
          count: 0,
          success: true,
        };
      }

      let syncedCount = 0;

      for (const raceData of races) {
        await this.saveRaceData(raceData);
        syncedCount++;
      }

      this.logger.log(`Successfully synced ${syncedCount} races`);

      return {
        message: `Successfully synced ${syncedCount} races`,
        count: syncedCount,
        success: true,
      };
    } catch (error) {
      this.logger.error('Failed to sync races from source', error.stack);
      throw error;
    }
  }

  /** Map upstream status enums (from 5BIB platform) to our lowercase schema values */
  private normalizeUpstreamStatus(raw: string): 'draft' | 'pre_race' | 'live' | 'ended' {
    const map: Record<string, 'draft' | 'pre_race' | 'live' | 'ended'> = {
      draft: 'draft',
      DRAFT: 'draft',
      GENERATED_CODE: 'draft',
      pre_race: 'pre_race',
      PRE_RACE: 'pre_race',
      live: 'live',
      LIVE: 'live',
      ended: 'ended',
      COMPLETE: 'ended',
      CANCEL: 'ended',
    };
    return map[raw] ?? 'draft';
  }

  private async saveRaceData(raceData: any) {
    const {
      race_course_bases,
      id,
      race_extenstion,
      race_virtual_extenstion,
      ...raceFields
    } = raceData;

    // Ensure product_id is set correctly (API returns both 'product' and 'product_id')
    const productId = String(raceFields.product_id || raceFields.product);
    if (!productId || productId === 'undefined') {
      this.logger.error('Race data missing product_id', raceData);
      throw new Error('Race data missing product_id');
    }

    // Map source fields to our schema
    const raceDoc: Partial<Race> = {
      productId,
      title: raceFields.title,
      status: this.normalizeUpstreamStatus(raceFields.status),
      season: raceFields.season,
      province: raceFields.province,
      raceType: raceFields.race_type,
      description: raceFields.description,
      imageUrl: raceFields.images,
      logoUrl: raceFields.logo_url,
      location: raceFields.location,
      startDate: raceFields.event_start_date
        ? new Date(raceFields.event_start_date)
        : undefined,
      endDate: raceFields.event_end_date
        ? new Date(raceFields.event_end_date)
        : undefined,
      rawData: raceFields, // preserve all original fields
    };

    // Build embedded courses from race_course_bases
    if (race_course_bases && Array.isArray(race_course_bases)) {
      // Load existing race to preserve manually-set apiUrl and checkpoints (H-02 fix)
      const existingRace = await this.raceModel.findOne({ productId }).lean().exec();
      const existingCourseMap = new Map(
        (existingRace?.courses || []).map((c: any) => [c.courseId, c]),
      );

      raceDoc.courses = race_course_bases.map((courseData: any) => {
        const courseId = String(courseData.variant_id || courseData.id);
        const existing = existingCourseMap.get(courseId);
        return {
          courseId,
          name: courseData.name,
          distance: courseData.distance,
          courseType: courseData.course_type,
          // Preserve manually-set apiUrl if API returns null/empty
          apiUrl: courseData.race_result_url || existing?.apiUrl || null,
          importStatus: courseData.race_result_import_status || existing?.importStatus || 'idle',
          checkpoints: existing?.checkpoints || [],
        };
      });
    }

    await this.raceModel.findOneAndUpdate(
      { productId },
      { $set: raceDoc },
      { upsert: true, new: true },
    );

    this.logger.log(
      `Synced race: ${raceDoc.title} (productId: ${productId})`,
    );
  }
}
