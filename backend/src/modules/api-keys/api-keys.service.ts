import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { isValidObjectId, Model } from 'mongoose';
import Redis from 'ioredis';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { ApiKey, ApiKeyDocument } from './schemas/api-key.schema';
import {
  ApiKeyResponseDto,
  CreateApiKeyDto,
  CreatedApiKeyDto,
  UpdateApiKeyDto,
} from './dto/api-key.dto';

const NOT_FOUND = 'Không tìm thấy API key';
const PREFIX_LEN = 9; // chars after 'ak_' → total 12-char prefix
const SECRET_LEN = 32;
const KEY_PREFIX_RE = /^ak_[A-Za-z0-9]{9}$/;

/** Base62 alphabet (no `+/=` to keep keys URL/header-safe). */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function randomBase62(len: number): string {
  // Use rejection sampling on raw bytes to avoid modulo bias.
  const out: string[] = [];
  while (out.length < len) {
    const buf = randomBytes(len * 2);
    for (const b of buf) {
      if (b < 248) {
        // 248 = 4 * 62 → uniform map to 0..61
        out.push(ALPHABET[b % 62]);
        if (out.length === len) break;
      }
    }
  }
  return out.join('');
}

function hashKey(fullKey: string): string {
  return createHash('sha256').update(fullKey).digest('hex');
}

/** Constant-time compare two hex digest strings. */
function constantTimeEqualsHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);

  constructor(
    @InjectModel(ApiKey.name) private readonly model: Model<ApiKeyDocument>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  // ─── CRUD ────────────────────────────────────────────────────

  async create(dto: CreateApiKeyDto): Promise<CreatedApiKeyDto> {
    // Retry on prefix collision (cosmically rare but possible).
    for (let attempt = 0; attempt < 5; attempt++) {
      const prefix = `ak_${randomBase62(PREFIX_LEN)}`;
      const secret = randomBase62(SECRET_LEN);
      const fullKey = `${prefix}${secret}`;
      const exists = await this.model.exists({ keyPrefix: prefix });
      if (exists) continue;

      const doc = await this.model.create({
        name: dto.name,
        keyPrefix: prefix,
        keyHash: hashKey(fullKey),
        allowedOrigins: dto.allowedOrigins ?? [],
        rateLimitPerMinute: dto.rateLimitPerMinute ?? 1000,
        isActive: dto.isActive ?? true,
        notes: dto.notes ?? '',
      });
      return { ...this.toDto(doc.toObject()), fullKey };
    }
    throw new ConflictException('Không tạo được key mới — thử lại');
  }

  async list(): Promise<ApiKeyResponseDto[]> {
    const docs = await this.model
      .find()
      .sort({ createdAt: -1 })
      .lean<ApiKey[]>()
      .exec();
    return docs.map((d) => this.toDto(d));
  }

  async findById(id: string): Promise<ApiKeyResponseDto> {
    if (!isValidObjectId(id)) throw new NotFoundException(NOT_FOUND);
    const doc = await this.model.findById(id).lean<ApiKey>().exec();
    if (!doc) throw new NotFoundException(NOT_FOUND);
    return this.toDto(doc);
  }

  async update(id: string, dto: UpdateApiKeyDto): Promise<ApiKeyResponseDto> {
    if (!isValidObjectId(id)) throw new NotFoundException(NOT_FOUND);
    const doc = await this.model.findById(id).exec();
    if (!doc) throw new NotFoundException(NOT_FOUND);

    if (dto.name !== undefined) doc.name = dto.name;
    if (dto.allowedOrigins !== undefined) doc.allowedOrigins = dto.allowedOrigins;
    if (dto.rateLimitPerMinute !== undefined)
      doc.rateLimitPerMinute = dto.rateLimitPerMinute;
    if (dto.isActive !== undefined) doc.isActive = dto.isActive;
    if (dto.notes !== undefined) doc.notes = dto.notes;

    await doc.save();
    // Invalidate cache so revoke takes effect within seconds, not 60s
    await this.redis.del(`apikey:${doc.keyPrefix}`).catch(() => {});
    return this.toDto(doc.toObject());
  }

  async remove(id: string): Promise<{ ok: true }> {
    if (!isValidObjectId(id)) throw new NotFoundException(NOT_FOUND);
    const doc = await this.model.findById(id).exec();
    if (!doc) throw new NotFoundException(NOT_FOUND);
    const prefix = doc.keyPrefix;
    await doc.deleteOne();
    await this.redis.del(`apikey:${prefix}`).catch(() => {});
    return { ok: true };
  }

  // ─── Verification (called by ApiKeyGuard) ────────────────────

  /**
   * Verify a full key. Returns the key doc on success, null on any failure.
   * Touches lastUsedAt + usageCount fire-and-forget.
   * Caches successful key lookup 60s in Redis (revoke window).
   */
  async verify(fullKey: string, origin?: string): Promise<ApiKey | null> {
    if (!fullKey || fullKey.length < 12) return null;
    const prefix = fullKey.slice(0, 12);
    if (!KEY_PREFIX_RE.test(prefix)) return null;

    const cacheKey = `apikey:${prefix}`;
    let keyDoc: ApiKey | null = null;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) keyDoc = JSON.parse(cached) as ApiKey;
    } catch {
      /* fall through to DB */
    }

    if (!keyDoc) {
      keyDoc = await this.model
        .findOne({ keyPrefix: prefix, isActive: true })
        .lean<ApiKey>()
        .exec();
      if (keyDoc) {
        await this.redis.set(cacheKey, JSON.stringify(keyDoc), 'EX', 60).catch(() => {});
      }
    }

    if (!keyDoc || !keyDoc.isActive) return null;

    // Constant-time hash compare
    const incomingHash = hashKey(fullKey);
    if (!constantTimeEqualsHex(incomingHash, keyDoc.keyHash)) return null;

    // Origin allowlist (if configured)
    if (keyDoc.allowedOrigins.length > 0 && origin) {
      if (!keyDoc.allowedOrigins.includes(origin)) return null;
    }

    // Fire-and-forget usage tracking
    this.model
      .updateOne(
        { _id: keyDoc._id },
        { $set: { lastUsedAt: new Date() }, $inc: { usageCount: 1 } },
      )
      .exec()
      .catch(() => {});

    return keyDoc;
  }

  // ─── Mapper ─────────────────────────────────────────────────

  private toDto(doc: ApiKey): ApiKeyResponseDto {
    return {
      id: String(doc._id),
      name: doc.name,
      keyPrefix: doc.keyPrefix,
      allowedOrigins: doc.allowedOrigins ?? [],
      rateLimitPerMinute: doc.rateLimitPerMinute ?? 0,
      isActive: !!doc.isActive,
      lastUsedAt: doc.lastUsedAt ?? null,
      usageCount: doc.usageCount ?? 0,
      notes: doc.notes ?? '',
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
