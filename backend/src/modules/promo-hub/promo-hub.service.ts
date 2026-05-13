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
import { Model, Types } from 'mongoose';
// CJS interop — `sanitize-html` ships as CommonJS; default import via
// `import sanitizeHtml from 'sanitize-html'` triggers Jest ts-jest resolver
// quirk (undefined `.simpleTransform`, function not callable). Use namespace
// import + cast to call signature, both runtime safe in ts-node + jest.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sanitizeHtmlLib: (
  dirty: string,
  options?: import('sanitize-html').IOptions,
) => string = require('sanitize-html');
type SanitizeOptions = import('sanitize-html').IOptions;
import {
  PromoHub,
  PromoHubDocument,
  Section,
} from './schemas/promo-hub.schema';
import { CreatePromoHubDto } from './dto/create-promo-hub.dto';
import { UpdatePromoHubDto } from './dto/update-promo-hub.dto';
import {
  PromoHubListItemDto,
  PromoHubListQueryDto,
  PromoHubListResponseDto,
  PromoHubResponseDto,
} from './dto/promo-hub-response.dto';
import { SectionInputDto } from './dto/section.dto';

/**
 * FEATURE-027 — PromoHubService.
 *
 * CRUD for promo_hubs collection + Redis cache + anti-stampede lock +
 * server-side section schedule filter for public reads.
 *
 * Cache strategy:
 *   Read path (public `findBySlugPublic`):
 *     1. GET promo-hub:<slug>
 *     2. Cache hit → parse + return
 *     3. SETNX promo-hub-lock:<slug> TTL 5s
 *     4. Lock acquired → query Mongo → sanitize + filter scheduled sections
 *        → SET cache 60s → DEL lock → return
 *     5. Lock contended → sleep 200ms → retry GET cache (max 3 times)
 *        → fallback direct query if still cold
 *   Write path (`create` / `update` / `delete` / `reorderSections`):
 *     - DEL promo-hub:<slug> after Mongo write commit.
 *     - On slug change: DEL both old AND new slug keys.
 *
 * Sanitization:
 *   - `rich_text.html` config → sanitize-html with strict allowlist
 *   - `theme.customCss` → strip <script>, javascript: URIs, event handlers
 *
 * Section schedule (BR-PH-06):
 *   - `visible: false` → always excluded from public response
 *   - `schedule.enabled: true` → check `startDate <= now <= endDate`
 *   - `schedule.enabled: false` → schedule ignored, visibility only
 */
@Injectable()
export class PromoHubService {
  private readonly logger = new Logger(PromoHubService.name);

  private static readonly CACHE_PREFIX = 'promo-hub:';
  private static readonly LOCK_PREFIX = 'promo-hub-lock:';
  private static readonly CACHE_TTL_SECONDS = 60;
  private static readonly LOCK_TTL_SECONDS = 5;
  private static readonly LOCK_RETRY_MAX = 3;
  private static readonly LOCK_RETRY_SLEEP_MS = 200;

  /** sanitize-html allowlist for `rich_text` section html field. */
  private static readonly RICH_TEXT_SANITIZE_OPTIONS: SanitizeOptions = {
    allowedTags: [
      'p',
      'br',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'a',
      'ul',
      'ol',
      'li',
      'h1',
      'h2',
      'h3',
      'h4',
      'blockquote',
      'code',
      'pre',
      'img',
      'figure',
      'figcaption',
      'span',
      'div',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      '*': ['class', 'style'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      // Inline transform fn (skip `sanitizeHtml.simpleTransform` helper —
      // it crashes in Jest's CJS resolver due to ESM interop quirk).
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
    },
  };

  constructor(
    @InjectModel(PromoHub.name)
    private readonly promoHubModel: Model<PromoHubDocument>,
    @Optional() @InjectRedis() private readonly redis?: Redis,
  ) {}

  // ─── Mutations ─────────────────────────────────────────────────

  async create(dto: CreatePromoHubDto, userId: string): Promise<PromoHubResponseDto> {
    try {
      const sanitizedSections = (dto.sections ?? []).map((s) =>
        this.toSectionDoc(this.sanitizeSection(s)),
      );
      const created = await this.promoHubModel.create({
        slug: dto.slug,
        title: dto.title,
        description: dto.description,
        status: dto.status ?? 'draft',
        sections: sanitizedSections,
        seo: dto.seo ?? {},
        theme: this.sanitizeTheme(dto.theme ?? {}),
        createdBy: userId,
      });
      // No cache to invalidate yet — newly created (draft default).
      return this.toResponseDto(created);
    } catch (err) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: unknown }).code === 11000
      ) {
        throw new ConflictException(
          `Slug "${dto.slug}" đã tồn tại — chọn slug khác.`,
        );
      }
      throw err;
    }
  }

  async update(
    id: string,
    dto: UpdatePromoHubDto,
    _userId: string,
  ): Promise<PromoHubResponseDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('id không hợp lệ');
    }
    const existing = await this.promoHubModel.findById(id).exec();
    if (!existing) {
      throw new NotFoundException('Không tìm thấy trang quảng bá');
    }
    const oldSlug = existing.slug;

    // Apply field-level update + sanitize where needed.
    if (dto.slug !== undefined) existing.slug = dto.slug;
    if (dto.title !== undefined) existing.title = dto.title;
    if (dto.description !== undefined) existing.description = dto.description;
    if (dto.status !== undefined) existing.status = dto.status;
    if (dto.sections !== undefined) {
      existing.sections = dto.sections.map((s) =>
        this.toSectionDoc(this.sanitizeSection(s)),
      );
    }
    if (dto.seo !== undefined) existing.seo = { ...existing.seo, ...dto.seo };
    if (dto.theme !== undefined) {
      existing.theme = {
        ...existing.theme,
        ...this.sanitizeTheme(dto.theme),
      };
    }

    try {
      const saved = await existing.save();
      // Invalidate BOTH old slug AND new slug if changed.
      await this.invalidateSlug(oldSlug);
      if (saved.slug !== oldSlug) {
        await this.invalidateSlug(saved.slug);
      }
      return this.toResponseDto(saved);
    } catch (err) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: unknown }).code === 11000
      ) {
        throw new ConflictException(
          `Slug "${dto.slug}" đã tồn tại — chọn slug khác.`,
        );
      }
      throw err;
    }
  }

  async softDelete(id: string, _userId: string): Promise<{ success: boolean }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('id không hợp lệ');
    }
    const updated = await this.promoHubModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), status: { $ne: 'archived' } },
      { $set: { status: 'archived' } },
      { new: true },
    );
    if (!updated) {
      throw new NotFoundException('Không tìm thấy trang quảng bá');
    }
    await this.invalidateSlug(updated.slug);
    return { success: true };
  }

  async reorderSections(
    id: string,
    sectionIds: string[],
    _userId: string,
  ): Promise<PromoHubResponseDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('id không hợp lệ');
    }
    const hub = await this.promoHubModel.findById(id).exec();
    if (!hub) {
      throw new NotFoundException('Không tìm thấy trang quảng bá');
    }
    const currentIds = hub.sections.map((s) => s._id.toString()).sort();
    const requestedIds = [...sectionIds].sort();
    if (
      currentIds.length !== requestedIds.length ||
      !currentIds.every((id, i) => id === requestedIds[i])
    ) {
      throw new BadRequestException(
        'sectionIds phải khớp đúng tập section hiện tại của hub (không thêm/bớt — dùng PATCH /promo-hubs/:id để CRUD).',
      );
    }

    const idToSection = new Map<string, Section>(
      hub.sections.map((s) => [s._id.toString(), s]),
    );
    const newSections = sectionIds.map((sid, index) => {
      const section = idToSection.get(sid)!;
      section.order = index;
      return section;
    });
    hub.sections = newSections;
    const saved = await hub.save();
    await this.invalidateSlug(saved.slug);
    return this.toResponseDto(saved);
  }

  // ─── Reads (admin) ─────────────────────────────────────────────

  async findById(id: string): Promise<PromoHubResponseDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('id không hợp lệ');
    }
    const hub = await this.promoHubModel.findById(id).exec();
    if (!hub) {
      throw new NotFoundException('Không tìm thấy trang quảng bá');
    }
    return this.toResponseDto(hub);
  }

  async list(query: PromoHubListQueryDto): Promise<PromoHubListResponseDto> {
    const pageNo = Math.max(1, query.pageNo ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const filter: Record<string, unknown> = {};
    if (query.status && query.status !== 'all') {
      filter.status = query.status;
    }
    if (query.q && query.q.trim().length > 0) {
      filter.title = { $regex: query.q.trim(), $options: 'i' };
    }

    const [docs, total] = await Promise.all([
      this.promoHubModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNo - 1) * pageSize)
        .limit(pageSize)
        .lean()
        .exec(),
      this.promoHubModel.countDocuments(filter).exec(),
    ]);

    const data: PromoHubListItemDto[] = docs.map((d) => ({
      id: d._id.toString(),
      slug: d.slug,
      title: d.title,
      status: d.status,
      sectionCount: (d.sections ?? []).length,
      // views7d roll-up filled by analytics service caller (left 0 here
      // to keep service pure — controller composes via Promise.all if
      // analytics aggregation is desired in list response).
      views7d: 0,
      createdAt: d.createdAt?.toISOString() ?? new Date(0).toISOString(),
      updatedAt: d.updatedAt?.toISOString() ?? new Date(0).toISOString(),
    }));

    return {
      data,
      total,
      pageNo,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ─── Reads (public — Redis cache + SETNX anti-stampede) ───────

  /**
   * Public lookup by slug. Returns ONLY `status='published'` hubs with
   * scheduled-section filter applied. Cache 60s + SETNX lock to prevent
   * stampede when MKT pushes high traffic to fresh hub.
   *
   * @throws NotFoundException if hub does not exist OR status != 'published'.
   */
  async findBySlugPublic(slug: string): Promise<PromoHubResponseDto> {
    const cacheKey = `${PromoHubService.CACHE_PREFIX}${slug}`;
    const cached = await this.cacheGet(cacheKey);
    if (cached) return cached;

    // SETNX anti-stampede pattern (port from F-004 RaceMasterDataService).
    const lockKey = `${PromoHubService.LOCK_PREFIX}${slug}`;
    const gotLock = await this.acquireLock(lockKey);

    if (!gotLock) {
      // Lock contended — retry cache lookup with sleep backoff.
      for (let i = 0; i < PromoHubService.LOCK_RETRY_MAX; i++) {
        await this.sleep(PromoHubService.LOCK_RETRY_SLEEP_MS);
        const retryHit = await this.cacheGet(cacheKey);
        if (retryHit) return retryHit;
      }
      // Still cold after retries — fall through to direct query (degrade gracefully).
    }

    try {
      const hub = await this.promoHubModel
        .findOne({ slug, status: 'published' })
        .lean()
        .exec();
      if (!hub) {
        throw new NotFoundException('Không tìm thấy trang quảng bá');
      }
      const filtered = this.filterScheduledSections(hub);
      const response = this.toResponseDtoFromLean(filtered);
      await this.cacheSet(cacheKey, response);
      return response;
    } finally {
      if (gotLock) {
        await this.releaseLock(lockKey);
      }
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────

  /** DEL Redis cache for a slug (public visibility invalidation). */
  async invalidateSlug(slug: string): Promise<void> {
    if (!this.redis) return;
    const cacheKey = `${PromoHubService.CACHE_PREFIX}${slug}`;
    try {
      await this.redis.del(cacheKey);
    } catch (e) {
      this.logger.warn(
        `[promo-hub] redis DEL ${cacheKey} fail: ${(e as Error).message}`,
      );
    }
  }

  /**
   * Apply BR-PH-06 section visibility + schedule rules:
   *   - visible=false → drop
   *   - schedule.enabled=true && now outside [startDate, endDate] → drop
   *   - schedule.enabled=false → ignore schedule
   * Sort by order ascending. Return new object (not mutate).
   */
  private filterScheduledSections(
    hub: PromoHubDocument | (PromoHub & { _id: Types.ObjectId }),
  ): PromoHub & { _id: Types.ObjectId } {
    const now = Date.now();
    const sections = (hub.sections ?? [])
      .filter((s) => {
        if (!s.visible) return false;
        const sch = s.schedule;
        if (!sch?.enabled) return true;
        const startOk = !sch.startDate || new Date(sch.startDate).getTime() <= now;
        const endOk = !sch.endDate || new Date(sch.endDate).getTime() >= now;
        return startOk && endOk;
      })
      .sort((a, b) => a.order - b.order);
    return { ...hub, sections } as PromoHub & { _id: Types.ObjectId };
  }

  /**
   * Convert sanitized DTO to a plain object compatible with Mongoose
   * subdocument shape. Strict TypeScript needs explicit cast — runtime
   * structures are equivalent. Preserves provided `_id` (edit path) or
   * lets Mongoose auto-generate (create path).
   */
  private toSectionDoc(s: SectionInputDto): Section {
    // Accept any client-supplied _id but only PRESERVE if it's a valid
    // 24-char hex ObjectId. Non-ObjectId values (UUID v4 from
    // crypto.randomUUID(), "tmp-*", any other string) trigger fresh
    // ObjectId assignment. Fixes BUGFIX-F027-HOTFIX-01.
    const isValidObjectId =
      typeof s._id === 'string' && Types.ObjectId.isValid(s._id) && s._id.length === 24;
    return {
      _id: isValidObjectId ? new Types.ObjectId(s._id as string) : new Types.ObjectId(),
      type: s.type,
      order: s.order,
      visible: s.visible,
      config: s.config ?? {},
      schedule: {
        enabled: s.schedule?.enabled ?? false,
        startDate: s.schedule?.startDate ? new Date(s.schedule.startDate) : null,
        endDate: s.schedule?.endDate ? new Date(s.schedule.endDate) : null,
      },
    } as Section;
  }

  /**
   * Sanitize a section input — currently:
   *   - `rich_text` type → run html through sanitize-html allowlist
   *   - Other types → pass-through (type-specific config validated at
   *     UI layer + Mongoose schema flexibility)
   */
  private sanitizeSection(section: SectionInputDto): SectionInputDto {
    if (section.type === 'rich_text' && typeof section.config?.html === 'string') {
      return {
        ...section,
        config: {
          ...section.config,
          html: sanitizeHtmlLib(
            section.config.html,
            PromoHubService.RICH_TEXT_SANITIZE_OPTIONS,
          ),
        },
      };
    }
    return section;
  }

  /**
   * Sanitize theme.customCss: strip <script>, javascript: URIs, event
   * handlers, @import (prevents external CSS load with cookies). Whitelist
   * only safe CSS properties — but here we use blacklist regex for simplicity.
   */
  private sanitizeTheme<T extends { customCss?: string }>(theme: T): T {
    if (!theme.customCss) return theme;
    const stripped = theme.customCss
      .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
      .replace(/javascript\s*:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/@import[^;]*;?/gi, '')
      .replace(/expression\s*\(/gi, '');
    return { ...theme, customCss: stripped };
  }

  // ─── Cache primitives (Redis-optional) ─────────────────────────

  private async cacheGet(key: string): Promise<PromoHubResponseDto | null> {
    if (!this.redis) return null;
    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as PromoHubResponseDto;
    } catch (e) {
      this.logger.warn(
        `[promo-hub] redis GET ${key} fail: ${(e as Error).message}`,
      );
      return null;
    }
  }

  private async cacheSet(key: string, value: PromoHubResponseDto): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.set(
        key,
        JSON.stringify(value),
        'EX',
        PromoHubService.CACHE_TTL_SECONDS,
      );
    } catch (e) {
      this.logger.warn(
        `[promo-hub] redis SET ${key} fail: ${(e as Error).message}`,
      );
    }
  }

  private async acquireLock(key: string): Promise<boolean> {
    if (!this.redis) return true; // No Redis → no contention possible → "got" lock.
    try {
      const result = await this.redis.set(
        key,
        '1',
        'EX',
        PromoHubService.LOCK_TTL_SECONDS,
        'NX',
      );
      return result === 'OK';
    } catch (e) {
      this.logger.warn(
        `[promo-hub] redis SETNX ${key} fail: ${(e as Error).message}`,
      );
      return false;
    }
  }

  private async releaseLock(key: string): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.del(key);
    } catch (e) {
      this.logger.warn(
        `[promo-hub] redis DEL lock ${key} fail: ${(e as Error).message}`,
      );
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ─── Response DTO mappers (strip Mongoose internals, expose `id`) ──

  private toResponseDto(hub: PromoHubDocument): PromoHubResponseDto {
    return this.toResponseDtoFromLean({
      ...hub.toObject(),
      _id: hub._id,
      createdAt: hub.createdAt,
      updatedAt: hub.updatedAt,
    } as unknown as PromoHub & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date });
  }

  private toResponseDtoFromLean(
    hub: PromoHub & { _id: Types.ObjectId; createdAt?: Date; updatedAt?: Date },
  ): PromoHubResponseDto {
    return {
      id: hub._id.toString(),
      slug: hub.slug,
      title: hub.title,
      description: hub.description,
      status: hub.status,
      sections: (hub.sections ?? []).map((s) => ({
        _id: s._id.toString(),
        type: s.type,
        order: s.order,
        visible: s.visible,
        config: s.config ?? {},
        schedule: s.schedule
          ? {
              enabled: s.schedule.enabled,
              startDate: s.schedule.startDate
                ? new Date(s.schedule.startDate).toISOString()
                : undefined,
              endDate: s.schedule.endDate
                ? new Date(s.schedule.endDate).toISOString()
                : undefined,
            }
          : undefined,
      })),
      seo: hub.seo ?? {},
      theme: hub.theme ?? {
        primaryColor: '#1d4ed8',
        secondaryColor: '#ea580c',
        fontFamily: 'Be Vietnam Pro',
        layout: 'standard',
      },
      createdBy: hub.createdBy,
      createdAt: (hub.createdAt ?? new Date(0)).toISOString(),
      updatedAt: (hub.updatedAt ?? new Date(0)).toISOString(),
    };
  }
}
