import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  TimingAlertConfig,
  TimingAlertConfigDocument,
} from '../schemas/timing-alert-config.schema';
import { Race, RaceDocument } from '../../races/schemas/race.schema';
import {
  CreateTimingAlertConfigDto,
  TimingAlertConfigResponseDto,
} from '../dto/create-config.dto';

/**
 * Config CRUD service — **CHỈ behavior knobs**.
 *
 * Manager refactor 03/05/2026:
 * - DROP encrypt + decrypt + masking (race document `apiUrl` plaintext OK)
 * - DROP rr_event_id, rr_api_keys, course_checkpoints, cutoff_times,
 *   event_start_iso/end_iso fields (đọc từ race document)
 * - GIỮ behavior: enabled, poll_interval_seconds, overdue_threshold_minutes,
 *   top_n_alert + audit metadata
 *
 * Race-domain config (apiUrl, checkpoints, cutoff, window) sửa qua
 * `/admin/races/[id]/edit`.
 */
@Injectable()
export class TimingAlertConfigService {
  private readonly logger = new Logger(TimingAlertConfigService.name);

  constructor(
    @InjectModel(TimingAlertConfig.name)
    private readonly configModel: Model<TimingAlertConfigDocument>,
    @InjectModel(Race.name)
    private readonly raceModel: Model<RaceDocument>,
  ) {}

  /**
   * Upsert config. Idempotent.
   *
   * @param raceId Mongo race document `_id` (string). Race PHẢI tồn tại.
   * @param dto behavior knobs only — race-domain fields sửa ở /races/[id]/edit
   * @param userId từ Logto JWT (audit)
   */
  async upsert(
    raceId: string,
    dto: CreateTimingAlertConfigDto,
    userId: string,
  ): Promise<TimingAlertConfigResponseDto> {
    // Validate race exists
    const race = await this.raceModel
      .findById(raceId)
      .select({ _id: 1 })
      .lean()
      .exec();
    if (!race) {
      throw new NotFoundException(`Race ${raceId} not found`);
    }

    const update = {
      race_id: raceId,
      poll_interval_seconds: dto.poll_interval_seconds ?? 90,
      overdue_threshold_minutes: dto.overdue_threshold_minutes ?? 30,
      top_n_alert: dto.top_n_alert ?? 3,
      enabled: dto.enabled ?? false,
      enabled_by_user_id: userId,
      enabled_at: dto.enabled ? new Date() : null,
    };

    const doc = await this.configModel
      .findOneAndUpdate(
        { race_id: raceId },
        { $set: update },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();

    this.logger.log(
      `[upsert] race=${raceId} enabled=${doc.enabled} interval=${doc.poll_interval_seconds}s threshold=${doc.overdue_threshold_minutes}min by=${userId}`,
    );

    return this.toResponse(doc);
  }

  async getByRaceId(
    raceId: string,
  ): Promise<TimingAlertConfigResponseDto | null> {
    const doc = await this.configModel
      .findOne({ race_id: raceId })
      .lean<TimingAlertConfig & { _id: unknown }>()
      .exec();
    if (!doc) return null;
    return this.toResponse(doc);
  }

  /**
   * List active configs cho cron tick.
   *
   * "Active" = enabled=true AND race window khả dụng:
   *   - Race document tồn tại
   *   - `now` trong [race.startDate - 1h, race.endDate + 2h] (TA-14)
   *   - Hoặc race.startDate/endDate null/undefined → luôn poll khi enabled
   *
   * Returns ARRAY of { config, race } pairs để caller có sẵn race document.
   */
  async listActiveConfigs(): Promise<TimingAlertConfigDocument[]> {
    const now = new Date();
    const oneHourMs = 60 * 60 * 1000;
    const twoHoursMs = 2 * 60 * 60 * 1000;

    const enabledConfigs = await this.configModel
      .find({ enabled: true })
      .lean<TimingAlertConfigDocument[]>()
      .exec();

    if (enabledConfigs.length === 0) return [];

    // Lookup race documents để filter window
    const raceIds = enabledConfigs.map((c) => c.race_id);
    const races = await this.raceModel
      .find({ _id: { $in: raceIds } })
      .select({ _id: 1, startDate: 1, endDate: 1 })
      .lean<Array<{ _id: unknown; startDate?: Date; endDate?: Date }>>()
      .exec();
    const raceById = new Map(races.map((r) => [String(r._id), r]));

    return enabledConfigs.filter((cfg) => {
      const race = raceById.get(cfg.race_id);
      if (!race) {
        // Race document deleted — config orphan. Skip safely.
        return false;
      }
      // Window OK nếu cả 2 missing (legacy / chưa set) hoặc trong khoảng
      const startOk =
        !race.startDate || race.startDate.getTime() <= now.getTime() + oneHourMs;
      const endOk =
        !race.endDate || race.endDate.getTime() >= now.getTime() - twoHoursMs;
      return startOk && endOk;
    });
  }

  async updateLastPolled(raceId: string): Promise<void> {
    await this.configModel
      .updateOne(
        { race_id: raceId },
        { $set: { last_polled_at: new Date() } },
      )
      .exec();
  }

  private toResponse(
    doc: TimingAlertConfig & { _id?: unknown },
  ): TimingAlertConfigResponseDto {
    return {
      config_id: String(doc._id ?? ''),
      race_id: doc.race_id,
      poll_interval_seconds: doc.poll_interval_seconds,
      overdue_threshold_minutes: doc.overdue_threshold_minutes,
      top_n_alert: doc.top_n_alert,
      enabled: doc.enabled,
      enabled_by_user_id: doc.enabled_by_user_id ?? null,
      enabled_at: doc.enabled_at ?? null,
      last_polled_at: doc.last_polled_at ?? null,
    };
  }
}
