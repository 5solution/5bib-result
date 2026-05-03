import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  TimingAlertConfig,
  TimingAlertConfigDocument,
} from '../schemas/timing-alert-config.schema';
import { ApiKeyCrypto } from '../crypto/api-key.crypto';
import {
  CreateTimingAlertConfigDto,
  TimingAlertConfigResponseDto,
} from '../dto/create-config.dto';

/**
 * Config CRUD service. Single responsibility: persist + encrypt RR API keys
 * + return masked view cho admin UI.
 *
 * KHÔNG biết: poll engine, miss detector, MySQL legacy, master data.
 */
@Injectable()
export class TimingAlertConfigService {
  private readonly logger = new Logger(TimingAlertConfigService.name);

  constructor(
    @InjectModel(TimingAlertConfig.name)
    private readonly configModel: Model<TimingAlertConfigDocument>,
    private readonly crypto: ApiKeyCrypto,
  ) {}

  /**
   * Upsert config theo (mysql_race_id). Encrypt mọi API key trước khi save.
   * Idempotent: gọi lại với keys mới → re-encrypt + replace map.
   *
   * @param raceId MySQL race ID (numeric)
   * @param dto plaintext API keys (sẽ được encrypt)
   * @param userId từ Logto JWT (audit `enabled_by_user_id`)
   */
  async upsert(
    raceId: number,
    dto: CreateTimingAlertConfigDto,
    userId: string,
  ): Promise<TimingAlertConfigResponseDto> {
    if (!dto.rr_api_keys || Object.keys(dto.rr_api_keys).length === 0) {
      throw new BadRequestException(
        'rr_api_keys must contain at least 1 course key',
      );
    }

    // Encrypt từng API key. Validate không rỗng + không trùng tên course
    // checkpoints (consistency check — Mongo upsert sẽ overwrite nên cần
    // validate input trước khi destroy data cũ).
    const encryptedKeys: Record<string, string> = {};
    for (const [courseName, plaintext] of Object.entries(dto.rr_api_keys)) {
      if (typeof plaintext !== 'string' || plaintext.trim().length === 0) {
        throw new BadRequestException(
          `rr_api_keys["${courseName}"] phải là string không rỗng`,
        );
      }
      // Match course tên trong rr_api_keys với course_checkpoints — silent
      // mismatch sẽ làm poll skip course đó. Validate cho admin biết ngay.
      if (!dto.course_checkpoints[courseName]) {
        throw new BadRequestException(
          `Course "${courseName}" có trong rr_api_keys nhưng KHÔNG có trong course_checkpoints. ` +
            `Mọi course có API key phải có checkpoints definition.`,
        );
      }
      encryptedKeys[courseName] = this.crypto.encrypt(plaintext.trim());
    }

    const update = {
      mysql_race_id: raceId,
      mongo_race_id: dto.mongo_race_id ?? null,
      rr_event_id: dto.rr_event_id,
      rr_api_keys: encryptedKeys,
      course_checkpoints: dto.course_checkpoints,
      cutoff_times: dto.cutoff_times ?? {},
      poll_interval_seconds: dto.poll_interval_seconds ?? 90,
      overdue_threshold_minutes: dto.overdue_threshold_minutes ?? 30,
      top_n_alert: dto.top_n_alert ?? 3,
      enabled: dto.enabled ?? false,
      enabled_by_user_id: userId,
      enabled_at: dto.enabled ? new Date() : null,
    };

    const doc = await this.configModel
      .findOneAndUpdate(
        { mysql_race_id: raceId },
        { $set: update },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();

    this.logger.log(
      `[upsert] race=${raceId} courses=[${Object.keys(encryptedKeys).join(',')}] enabled=${doc.enabled} by=${userId}`,
    );

    // Return masked view — KHÔNG decrypt API keys ở đây.
    return this.toMaskedResponse(doc, dto.rr_api_keys);
  }

  /**
   * Read config. Trả masked API key preview — caller (admin UI) thấy
   * "LE2K...7VWA (32 chars)" thay vì plaintext.
   *
   * **Security:** decrypt KHÔNG xảy ra ở đây. Service poll engine sẽ tự
   * decrypt khi cần gọi RR API qua `decryptForPoll()` method dưới.
   */
  async getByRaceId(
    raceId: number,
  ): Promise<TimingAlertConfigResponseDto | null> {
    const doc = await this.configModel
      .findOne({ mysql_race_id: raceId })
      .lean<TimingAlertConfig & { _id: unknown; encryptedKeys?: never }>()
      .exec();

    if (!doc) return null;

    // Mask qua decrypt → mask. Cost: O(n) decrypt per read. Phase 1A có thể
    // accept (admin GET config rare). Phase 2 cache nếu cần.
    const plaintextMap: Record<string, string> = {};
    for (const [courseName, ct] of Object.entries(doc.rr_api_keys ?? {})) {
      try {
        plaintextMap[courseName] = this.crypto.decrypt(ct);
      } catch (err) {
        this.logger.warn(
          `[getByRaceId] race=${raceId} course=${courseName} decrypt failed: ${(err as Error).message}`,
        );
        plaintextMap[courseName] = '';
      }
    }

    return this.toMaskedResponse(doc, plaintextMap);
  }

  /**
   * Decrypt API key cho 1 course — chỉ poll engine gọi (race day cron).
   * KHÔNG bao giờ expose trên controller endpoint.
   */
  async decryptKeyForPoll(
    raceId: number,
    courseName: string,
  ): Promise<string> {
    const doc = await this.configModel
      .findOne({ mysql_race_id: raceId })
      .select({ rr_api_keys: 1 })
      .lean()
      .exec();
    if (!doc) {
      throw new NotFoundException(
        `Timing alert config not found for race=${raceId}`,
      );
    }
    const ct = doc.rr_api_keys?.[courseName];
    if (!ct) {
      throw new NotFoundException(
        `No API key configured for race=${raceId} course="${courseName}"`,
      );
    }
    return this.crypto.decrypt(ct);
  }

  /**
   * Phase 1B — list active configs cho cron tick.
   * "Active" = `enabled: true`. Phase 1B accept đơn giản, Phase 1C có thể
   * thêm filter race window (event_start - 1h → event_end + 2h).
   *
   * Returns array config docs raw (KHÔNG decrypt — caller decrypt per course).
   */
  async listActiveConfigs(): Promise<TimingAlertConfigDocument[]> {
    return this.configModel
      .find({ enabled: true })
      .lean<TimingAlertConfigDocument[]>()
      .exec();
  }

  /**
   * Update last_polled_at — gọi sau mỗi poll cycle hoàn thành.
   */
  async updateLastPolled(raceId: number): Promise<void> {
    await this.configModel
      .updateOne(
        { mysql_race_id: raceId },
        { $set: { last_polled_at: new Date() } },
      )
      .exec();
  }

  /**
   * Convert internal doc → response DTO với masked API keys. Helper private
   * để đảm bảo 100% endpoint return masked, không leak plaintext qua bug.
   */
  private toMaskedResponse(
    doc: TimingAlertConfig & { _id?: unknown },
    plaintextMap: Record<string, string>,
  ): TimingAlertConfigResponseDto {
    const masked: Record<string, string> = {};
    for (const [courseName, plaintext] of Object.entries(plaintextMap)) {
      masked[courseName] = ApiKeyCrypto.mask(plaintext);
    }

    return {
      config_id: String(doc._id ?? ''),
      mysql_race_id: doc.mysql_race_id,
      mongo_race_id: doc.mongo_race_id ?? null,
      rr_event_id: doc.rr_event_id,
      rr_api_keys_masked: masked,
      course_checkpoints: doc.course_checkpoints,
      cutoff_times: doc.cutoff_times ?? {},
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
