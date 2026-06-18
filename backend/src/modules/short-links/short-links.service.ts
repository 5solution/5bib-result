import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Model } from 'mongoose';
import * as QRCode from 'qrcode';
import { ShortLink, ShortLinkDocument } from './schemas/short-link.schema';
import { CreateShortLinkDto } from './dto/create-short-link.dto';
import { UpdateShortLinkDto } from './dto/update-short-link.dto';
import {
  ShortLinkListResponseDto,
  ShortLinkResponseDto,
} from './dto/short-link-response.dto';
import {
  buildShortUrl,
  generateRandomCode,
  isReservedCode,
  SHORTLINK_CACHE,
  SHORTLINK_CODE_MAX_RETRY,
} from './short-links.constants';

/** Mongo duplicate-key error code. */
const MONGO_DUP_KEY = 11000;

@Injectable()
export class ShortLinksService {
  private readonly logger = new Logger(ShortLinksService.name);

  constructor(
    @InjectModel(ShortLink.name)
    private readonly model: Model<ShortLinkDocument>,
    @Optional() @InjectRedis() private readonly redis?: Redis,
  ) {}

  // ─── Admin mutations ───────────────────────────────────────────

  async create(
    dto: CreateShortLinkDto,
    userId: string,
  ): Promise<ShortLinkResponseDto> {
    if (dto.customAlias) {
      const alias = dto.customAlias;
      if (isReservedCode(alias)) {
        throw new BadRequestException('Alias này bị hệ thống giữ chỗ, chọn cái khác');
      }
      try {
        const doc = await this.model.create({
          code: alias,
          targetUrl: dto.targetUrl,
          title: dto.title,
          createdBy: userId,
        });
        return this.toResponse(doc);
      } catch (err) {
        if (this.isDupKey(err)) {
          throw new ConflictException('Alias đã tồn tại, chọn cái khác');
        }
        throw err;
      }
    }

    // Random code với retry khi đụng unique index.
    for (let attempt = 0; attempt < SHORTLINK_CODE_MAX_RETRY; attempt++) {
      const code = generateRandomCode();
      if (isReservedCode(code)) continue;
      try {
        const doc = await this.model.create({
          code,
          targetUrl: dto.targetUrl,
          title: dto.title,
          createdBy: userId,
        });
        return this.toResponse(doc);
      } catch (err) {
        if (this.isDupKey(err)) continue; // collision — thử code khác
        throw err;
      }
    }
    throw new ConflictException(
      'Không sinh được mã ngắn (đụng nhiều lần), thử lại',
    );
  }

  async list(params: {
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<ShortLinkListResponseDto> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const filter: Record<string, unknown> = {};
    if (params.search?.trim()) {
      const rx = new RegExp(this.escapeRegex(params.search.trim()), 'i');
      filter.$or = [{ code: rx }, { title: rx }, { targetUrl: rx }];
    }
    const [docs, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return {
      items: docs.map((d) => this.toResponse(d)),
      total,
      page,
      pageSize,
    };
  }

  async update(
    id: string,
    dto: UpdateShortLinkDto,
  ): Promise<ShortLinkResponseDto> {
    const doc = await this.model.findById(id).exec();
    if (!doc) throw new NotFoundException('Không tìm thấy link');
    if (dto.targetUrl !== undefined) doc.targetUrl = dto.targetUrl;
    if (dto.title !== undefined) doc.title = dto.title;
    if (dto.active !== undefined) doc.active = dto.active;
    await doc.save();
    await this.invalidate(doc.code);
    return this.toResponse(doc);
  }

  async remove(id: string): Promise<void> {
    const doc = await this.model.findByIdAndDelete(id).exec();
    if (!doc) throw new NotFoundException('Không tìm thấy link');
    await this.invalidate(doc.code);
  }

  async generateQrPng(id: string): Promise<Buffer> {
    const doc = await this.model.findById(id).exec();
    if (!doc) throw new NotFoundException('Không tìm thấy link');
    return QRCode.toBuffer(buildShortUrl(doc.code), {
      type: 'png',
      width: 512,
      margin: 1,
    });
  }

  // ─── Public resolve (cache + SETNX anti-stampede) ──────────────

  /**
   * BR-05/06/07 — trả targetUrl cho frontend redirect 302. Cache-aside Redis,
   * $inc clickCount fire-and-forget mỗi lần resolve (kể cả cache hit) để đếm
   * click chính xác. Link không tồn tại / active=false → 404.
   */
  async resolve(code: string): Promise<{ targetUrl: string }> {
    const cacheKey = SHORTLINK_CACHE.CODE_PREFIX + code;
    const cached = await this.cacheGet(cacheKey);
    if (typeof cached === 'string') {
      this.bumpClick(code);
      return { targetUrl: cached };
    }

    const doc = await this.queryActive(code);
    if (!doc) {
      // queryActive trả null có thể vì (a) link không tồn tại/tắt HOẶC
      // (b) tín hiệu contention "worker khác đã warm cache" → re-read 1 lần
      // trước khi 404 (tránh spurious 404 dưới stampede).
      const recheck = await this.cacheGet(cacheKey);
      if (typeof recheck === 'string') {
        this.bumpClick(code);
        return { targetUrl: recheck };
      }
      throw new NotFoundException('Link không tồn tại');
    }
    await this.cacheSet(cacheKey, doc.targetUrl, SHORTLINK_CACHE.CACHE_TTL_SECONDS);
    this.bumpClick(code);
    return { targetUrl: doc.targetUrl };
  }

  // ─── Helpers ───────────────────────────────────────────────────

  private async queryActive(code: string): Promise<ShortLinkDocument | null> {
    if (!this.redis) {
      return this.model.findOne({ code, active: true }).exec();
    }
    const lockKey = SHORTLINK_CACHE.LOCK_PREFIX + code;
    const cacheKey = SHORTLINK_CACHE.CODE_PREFIX + code;
    for (let attempt = 0; attempt < SHORTLINK_CACHE.LOCK_RETRY_MAX; attempt++) {
      const lock = await this.redis.set(
        lockKey,
        '1',
        'EX',
        SHORTLINK_CACHE.LOCK_TTL_SECONDS,
        'NX',
      );
      if (lock) {
        return this.model.findOne({ code, active: true }).exec();
      }
      await this.sleep(SHORTLINK_CACHE.LOCK_RETRY_SLEEP_MS);
      const retry = await this.cacheGet(cacheKey);
      if (typeof retry === 'string') return null; // worker khác đã warm cache
    }
    // contended fallback — direct query, chấp nhận stampede ngắn.
    return this.model.findOne({ code, active: true }).exec();
  }

  /** $inc clickCount async, KHÔNG chặn redirect; nuốt lỗi. */
  private bumpClick(code: string): void {
    this.model
      .updateOne({ code, active: true }, { $inc: { clickCount: 1 } })
      .exec()
      .catch((err) => this.logger.warn(`bumpClick failed: ${String(err)}`));
  }

  private async invalidate(code: string): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.del(SHORTLINK_CACHE.CODE_PREFIX + code);
    } catch (err) {
      this.logger.warn(`Redis invalidate failed: ${String(err)}`);
    }
  }

  private async cacheGet(key: string): Promise<unknown | null> {
    if (!this.redis) return null;
    try {
      return await this.redis.get(key);
    } catch (err) {
      this.logger.warn(`Redis get failed: ${String(err)}`);
      return null;
    }
  }

  private async cacheSet(
    key: string,
    value: string,
    ttl: number,
  ): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.set(key, value, 'EX', ttl);
    } catch (err) {
      this.logger.warn(`Redis set failed: ${String(err)}`);
    }
  }

  private toResponse(doc: ShortLinkDocument): ShortLinkResponseDto {
    return {
      id: String(doc._id),
      code: doc.code,
      shortUrl: buildShortUrl(doc.code),
      targetUrl: doc.targetUrl,
      title: doc.title,
      clickCount: doc.clickCount,
      active: doc.active,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  private isDupKey(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      (err as { code?: number }).code === MONGO_DUP_KEY
    );
  }

  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
