import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { randomBytes } from 'crypto';
import {
  ChipRaceConfig,
  ChipRaceConfigDocument,
} from '../schemas/chip-race-config.schema';
import {
  CHIP_CACHE_TTL_SECONDS,
  ChipRedisKeys,
} from '../utils/redis-keys';
import { sha256Hex } from '../utils/normalize';
import { TokenAction } from '../dto/chip-verify-token.dto';

/**
 * Quản lý token + enable/disable + preload trigger cho race verify.
 * Token TTL ∞ + audit log mỗi rotate (PAUSE #5 resolved bởi Danny).
 *
 * BR-05: Token rotate → DEL Redis cache cũ NGAY (không grace period).
 */
@Injectable()
export class ChipConfigService {
  private readonly logger = new Logger(ChipConfigService.name);

  constructor(
    @InjectModel(ChipRaceConfig.name)
    private readonly configModel: Model<ChipRaceConfigDocument>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  /** Lấy hoặc tạo doc config cho race. tenant_id phải truyền vào lần đầu. */
  async getOrCreate(
    raceId: number,
    tenantId: number,
  ): Promise<ChipRaceConfigDocument> {
    let cfg = await this.configModel.findOne({ mysql_race_id: raceId }).exec();
    if (!cfg) {
      cfg = await this.configModel.create({
        mysql_race_id: raceId,
        tenant_id: tenantId,
        chip_verify_enabled: false,
        total_chip_mappings: 0,
        device_labels: [],
        token_audit_log: [],
      });
    }
    return cfg;
  }

  async getByToken(
    token: string,
  ): Promise<ChipRaceConfigDocument | null> {
    if (!token || token.length !== 32) return null;
    return this.configModel
      .findOne({ chip_verify_token: token, chip_verify_enabled: true })
      .exec();
  }

  /**
   * GENERATE = enable + sinh token mới (idempotent: nếu đã enabled trả token cũ).
   * ROTATE   = sinh token mới + DEL Redis token index cũ ngay lập tức (BR-05).
   * DISABLE  = clear token + clear cache + chip_verify_enabled=false.
   */
  async tokenAction(
    raceId: number,
    tenantId: number,
    action: TokenAction,
    byUserId: string,
  ): Promise<ChipRaceConfigDocument> {
    const cfg = await this.getOrCreate(raceId, tenantId);
    const oldToken = cfg.chip_verify_token ?? null;

    switch (action) {
      case 'GENERATE': {
        if (cfg.chip_verify_enabled && oldToken) {
          // idempotent: trả nguyên trạng
          return cfg;
        }
        const newToken = this.makeToken();
        cfg.chip_verify_token = newToken;
        cfg.chip_verify_enabled = true;
        cfg.enabled_by_user_id = byUserId;
        cfg.token_audit_log.push({
          action: 'GENERATE',
          at: new Date(),
          by_user_id: byUserId,
          old_token_hash: undefined,
          new_token_hash: sha256Hex(newToken),
        });
        await cfg.save();
        await this.indexToken(newToken, raceId);
        this.logger.log(
          `[GENERATE] race=${raceId} by=${byUserId} token=${this.maskToken(newToken)}`,
        );
        return cfg;
      }
      case 'ROTATE': {
        if (!cfg.chip_verify_enabled || !oldToken) {
          throw new BadRequestException('Cannot ROTATE — verify not enabled');
        }
        const newToken = this.makeToken();

        // BUG #3 fix — strict ordering for atomic invalidation:
        //   1. DEL Redis old token FIRST → kills hot path immediately.
        //   2. Save Mongo with newToken → kills cold-fallback path.
        //   3. SET Redis new token → install new hot path.
        //
        // Why: hot path (Redis GET tokenIndex(oldToken)) is the common case
        // serving 99% of kiosk traffic. If we save Mongo first then DEL Redis,
        // there is a 1-50ms window where Redis still resolves oldToken even
        // though Mongo no longer has it. This violates BR-05 "instant
        // invalidation". Ordering DEL→save→SET reduces window to the
        // cold-fallback-only path which: (a) is slower (Mongo round trip),
        // (b) requires Redis to be empty (just was DEL'd), (c) Mongo cold
        // query filters by chip_verify_enabled=true AND chip_verify_token=
        // oldToken — after save, oldToken is no longer the doc's token, so
        // cold query also returns null. Net window: 0ms for hot path,
        // ~Mongo-save-duration (~5ms) for cold which is also empty.
        await this.redis.del(ChipRedisKeys.tokenIndex(oldToken));

        cfg.chip_verify_token = newToken;
        cfg.token_audit_log.push({
          action: 'ROTATE',
          at: new Date(),
          by_user_id: byUserId,
          old_token_hash: sha256Hex(oldToken),
          new_token_hash: sha256Hex(newToken),
        });
        await cfg.save();

        await this.indexToken(newToken, raceId);
        this.logger.log(
          `[ROTATE] race=${raceId} by=${byUserId} oldHash=${sha256Hex(oldToken).slice(0, 8)} newToken=${this.maskToken(newToken)}`,
        );
        return cfg;
      }
      case 'DISABLE': {
        if (!cfg.chip_verify_enabled) return cfg;
        cfg.chip_verify_enabled = false;
        cfg.token_audit_log.push({
          action: 'DISABLE',
          at: new Date(),
          by_user_id: byUserId,
          old_token_hash: oldToken ? sha256Hex(oldToken) : undefined,
        });
        cfg.chip_verify_token = null;
        await cfg.save();
        if (oldToken) {
          await this.redis.del(ChipRedisKeys.tokenIndex(oldToken));
        }
        // Clear preload cache so next enable rebuilds fresh.
        await this.redis.del(ChipRedisKeys.athleteCache(raceId));
        await this.redis.del(ChipRedisKeys.cacheReady(raceId));
        this.logger.log(`[DISABLE] race=${raceId} by=${byUserId}`);
        return cfg;
      }
    }
  }

  async findByRace(raceId: number): Promise<ChipRaceConfigDocument | null> {
    return this.configModel.findOne({ mysql_race_id: raceId }).exec();
  }

  /** Find existing config by Mongo Race._id (admin URL identifier). */
  async findByMongoId(
    mongoRaceId: string,
  ): Promise<ChipRaceConfigDocument | null> {
    return this.configModel.findOne({ mongo_race_id: mongoRaceId }).exec();
  }

  /**
   * Link an admin Mongo Race to a MySQL platform race_id. BTC enters the
   * mysql_race_id manually because Mongo Race ↔ MySQL race are two separate
   * systems with no automatic mapping. Idempotent: re-linking same mongoId
   * to a different mysql_race_id is allowed (in case BTC typed the wrong
   * number first time) UNLESS chip mappings already exist for the prior
   * mysql_race_id (would orphan them — surface as 409 conflict).
   */
  async linkMongoToMysql(input: {
    mongoRaceId: string;
    mysqlRaceId: number;
    tenantId: number;
    byUserId: string;
  }): Promise<ChipRaceConfigDocument> {
    if (!input.mongoRaceId || input.mongoRaceId.length < 8) {
      throw new BadRequestException('Invalid mongoRaceId');
    }
    if (!Number.isFinite(input.mysqlRaceId) || input.mysqlRaceId <= 0) {
      throw new BadRequestException('mysql_race_id must be a positive integer');
    }

    // Check existing link for this mongoId
    const existingByMongo = await this.findByMongoId(input.mongoRaceId);
    if (existingByMongo) {
      if (existingByMongo.mysql_race_id === input.mysqlRaceId) {
        return existingByMongo; // idempotent
      }
      // Re-link to different mysql_race_id — allow only if no mappings yet
      if (existingByMongo.total_chip_mappings > 0) {
        throw new BadRequestException(
          `Race already linked to mysql_race_id=${existingByMongo.mysql_race_id} with ${existingByMongo.total_chip_mappings} mappings. Delete or migrate mappings first before re-linking.`,
        );
      }
      existingByMongo.mysql_race_id = input.mysqlRaceId;
      await existingByMongo.save();
      this.logger.log(
        `[link] mongo=${input.mongoRaceId} re-linked to mysql=${input.mysqlRaceId} by=${input.byUserId}`,
      );
      return existingByMongo;
    }

    // Check if mysql_race_id already taken by a different mongoId
    const existingByMysql = await this.findByRace(input.mysqlRaceId);
    if (existingByMysql && existingByMysql.mongo_race_id) {
      throw new BadRequestException(
        `mysql_race_id=${input.mysqlRaceId} đã link tới race khác (mongo=${existingByMysql.mongo_race_id}).`,
      );
    }
    if (existingByMysql) {
      // mysql_race_id has unlinked legacy config — adopt it
      existingByMysql.mongo_race_id = input.mongoRaceId;
      existingByMysql.tenant_id = input.tenantId;
      await existingByMysql.save();
      this.logger.log(
        `[link] mongo=${input.mongoRaceId} adopted existing mysql=${input.mysqlRaceId} by=${input.byUserId}`,
      );
      return existingByMysql;
    }

    // Fresh create
    const cfg = await this.configModel.create({
      mysql_race_id: input.mysqlRaceId,
      mongo_race_id: input.mongoRaceId,
      tenant_id: input.tenantId,
      chip_verify_enabled: false,
      total_chip_mappings: 0,
      device_labels: [],
      token_audit_log: [],
    });
    this.logger.log(
      `[link] mongo=${input.mongoRaceId} new-link mysql=${input.mysqlRaceId} by=${input.byUserId}`,
    );
    return cfg;
  }

  /** Used by ChipDeltaSyncCron — only enabled races. */
  async listEnabled(): Promise<
    Pick<ChipRaceConfig, 'mysql_race_id' | 'tenant_id'>[]
  > {
    return this.configModel
      .find({ chip_verify_enabled: true })
      .select({ mysql_race_id: 1, tenant_id: 1, _id: 0 })
      .lean<{ mysql_race_id: number; tenant_id: number }[]>()
      .exec();
  }

  async setPreloadCompleted(
    raceId: number,
    totalMappings: number,
  ): Promise<void> {
    await this.configModel.updateOne(
      { mysql_race_id: raceId },
      {
        $set: {
          preload_completed_at: new Date(),
          total_chip_mappings: totalMappings,
        },
      },
    );
  }

  private async indexToken(token: string, raceId: number): Promise<void> {
    await this.redis.set(
      ChipRedisKeys.tokenIndex(token),
      String(raceId),
      'EX',
      CHIP_CACHE_TTL_SECONDS,
    );
  }

  private makeToken(): string {
    // 24 random bytes → 32-char base64url (no padding). 192-bit entropy.
    return randomBytes(24).toString('base64url');
  }

  private maskToken(t: string): string {
    return `${t.slice(0, 4)}…${t.slice(-4)}`;
  }
}
