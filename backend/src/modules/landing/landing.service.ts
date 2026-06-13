import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Model, Types } from 'mongoose';
// CJS interop — sanitize-html ships CommonJS (see F-027 PromoHubService note).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sanitizeHtmlLib: (
  dirty: string,
  options?: import('sanitize-html').IOptions,
) => string = require('sanitize-html');
type SanitizeOptions = import('sanitize-html').IOptions;
import { Race } from '../races/schemas/race.schema';
import {
  LandingSection,
  RaceLanding,
  RaceLandingDocument,
} from './schemas/race-landing.schema';
import { CreateLandingDto } from './dto/create-landing.dto';
import { UpdateLandingDto } from './dto/update-landing.dto';
import { SectionInputDto } from './dto/section.dto';
import {
  LandingListResponseDto,
  LandingResponseDto,
  PublicLandingResponseDto,
} from './dto/landing-response.dto';
import {
  DEFAULT_MAIN_COLOR,
  DEFAULT_SEC_COLOR,
  HEX_COLOR_REGEX,
  LANDING_CACHE,
  LandingSectionType,
  RESERVED_SUBDOMAINS,
  SUBDOMAIN_REGEX,
  TICKETING_BASE_URL,
  VARIANTS_BY_TYPE,
} from './landing.constants';

interface RaceLean {
  _id: unknown;
  title?: string;
  slug?: string;
  brandColor?: string;
  bannerUrl?: string;
  startDate?: Date;
  organizer?: string;
  mysql_race_id?: number | null;
  enable5pix?: boolean;
  pixEventUrl?: string;
}

@Injectable()
export class LandingService {
  private readonly logger = new Logger(LandingService.name);

  private static readonly RICH_TEXT_SANITIZE: SanitizeOptions = {
    allowedTags: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'ul', 'ol', 'li',
      'h2', 'h3', 'h4', 'blockquote', 'span',
    ],
    allowedAttributes: { a: ['href', 'target', 'rel'], '*': ['class'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, rel: 'noopener noreferrer', target: '_blank' },
      }),
    },
  };

  constructor(
    @InjectModel(RaceLanding.name)
    private readonly landingModel: Model<RaceLandingDocument>,
    /** Read-only Race lookup for create-seed (NOT cross-module service DI). */
    @InjectModel(Race.name)
    private readonly raceModel: Model<Race>,
    @Optional() @InjectRedis() private readonly redis?: Redis,
  ) {}

  // ─── Mutations ─────────────────────────────────────────────────

  async create(dto: CreateLandingDto, userId: string): Promise<LandingResponseDto> {
    const race = (await this.raceModel
      .findById(dto.raceId)
      .lean()
      .exec()) as RaceLean | null;
    if (!race) throw new NotFoundException('Không tìm thấy giải');

    const raceId = String(race._id);
    const existing = await this.landingModel
      .findOne({ 'raceRef.raceId': raceId })
      .select('_id')
      .lean()
      .exec();
    if (existing) {
      throw new ConflictException({
        code: 'LANDING_EXISTS',
        message: 'Giải này đã có trang landing',
      });
    }

    const mysqlRaceId = race.mysql_race_id ?? null;
    const main =
      race.brandColor && HEX_COLOR_REGEX.test(race.brandColor)
        ? race.brandColor
        : DEFAULT_MAIN_COLOR;

    const created = await this.landingModel.create({
      raceRef: { raceId, mysqlRaceId, slug: race.slug },
      merchantRef: { tenantName: race.organizer },
      internalName: race.title,
      status: 'draft',
      meta: { title: race.title, lang: 'vi', robots: 'index,follow' },
      theme: { main, sec: DEFAULT_SEC_COLOR },
      sections: this.buildSeedSections(race, mysqlRaceId),
      createdBy: userId,
      updatedBy: userId,
    });
    return this.toAdminResponse(created);
  }

  async list(params: {
    status?: string;
    pageNo?: number;
    pageSize?: number;
    q?: string;
  }): Promise<LandingListResponseDto> {
    const pageNo = Math.max(1, params.pageNo ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const filter: Record<string, unknown> = {};
    if (params.status && params.status !== 'all') filter.status = params.status;
    else filter.status = { $ne: 'archived' };
    if (params.q) {
      filter.$or = [
        { internalName: { $regex: params.q, $options: 'i' } },
        { 'domain.subdomain': { $regex: params.q, $options: 'i' } },
        { 'meta.title': { $regex: params.q, $options: 'i' } },
      ];
    }
    const [docs, total] = await Promise.all([
      this.landingModel
        .find(filter)
        .sort({ updatedAt: -1 })
        .skip((pageNo - 1) * pageSize)
        .limit(pageSize)
        .lean()
        .exec(),
      this.landingModel.countDocuments(filter).exec(),
    ]);
    return {
      data: docs.map((d) => ({
        id: String(d._id),
        raceTitle: d.meta?.title ?? d.raceRef?.slug,
        subdomain: d.domain?.subdomain,
        status: d.status,
        enabledSectionCount: (d.sections ?? []).filter((s) => s.enabled).length,
        updatedAt: d.updatedAt,
      })),
      total,
      pageNo,
      pageSize,
    };
  }

  async findById(id: string): Promise<LandingResponseDto> {
    const doc = await this.findOneOr404(id);
    return this.toAdminResponse(doc);
  }

  async update(
    id: string,
    dto: UpdateLandingDto,
    userId: string,
  ): Promise<LandingResponseDto> {
    const doc = await this.findOneOr404(id);
    const oldSubdomain = doc.domain?.subdomain;

    if (dto.internalName !== undefined) doc.internalName = dto.internalName;
    if (dto.meta) doc.meta = { ...doc.meta, ...this.cleanUndefined(dto.meta) } as never;
    if (dto.theme) doc.theme = { ...doc.theme, ...this.cleanUndefined(dto.theme) } as never;
    if (dto.domain?.subdomain !== undefined) {
      await this.assertSubdomainAvailable(dto.domain.subdomain, id);
      doc.domain.subdomain = dto.domain.subdomain;
    }

    doc.publish.hasUnpublishedChanges = true;
    doc.updatedBy = userId;
    await doc.save();

    await this.invalidate(oldSubdomain);
    await this.invalidate(doc.domain?.subdomain);
    return this.toAdminResponse(doc);
  }

  async reorderSections(
    id: string,
    sections: SectionInputDto[],
    userId: string,
  ): Promise<LandingResponseDto> {
    const doc = await this.findOneOr404(id);
    const rebuilt = sections.map((s, idx) => {
      this.assertVariant(s.type, s.variant);
      return {
        _id: this.toObjectId(s.id),
        type: s.type,
        variant: s.variant,
        enabled: s.enabled,
        order: idx,
        anchor: s.anchor,
        data: this.sanitizeSectionData(s.type, s.data ?? {}),
      };
    });
    doc.set('sections', rebuilt);
    doc.publish.hasUnpublishedChanges = true;
    doc.updatedBy = userId;
    await doc.save();

    await this.invalidate(doc.domain?.subdomain);
    return this.toAdminResponse(doc);
  }

  async publish(id: string, userId: string): Promise<LandingResponseDto> {
    const doc = await this.findOneOr404(id);
    if (!doc.domain?.subdomain) {
      throw new UnprocessableEntityException({
        code: 'SUBDOMAIN_REQUIRED',
        message: 'Cần đặt subdomain hợp lệ trước khi publish',
      });
    }
    // re-validate (defense: reserved list may have changed since set).
    await this.assertSubdomainAvailable(doc.domain.subdomain, id);

    const enabled = (doc.sections ?? []).filter((s) => s.enabled);
    const currentVersion = doc.publish?.version ?? 0;

    // Atomic version-guarded publish (TC-83-16 — 1 winner under concurrency).
    const updated = await this.landingModel
      .findOneAndUpdate(
        { _id: doc._id, 'publish.version': currentVersion },
        {
          $set: {
            status: 'published',
            'publish.hasUnpublishedChanges': false,
            'publish.version': currentVersion + 1,
            'publish.publishedAt': new Date(),
            'publish.publishedBy': userId,
            'publish.liveSnapshot': {
              meta: doc.meta,
              theme: doc.theme,
              sections: enabled,
            },
            updatedBy: userId,
          },
        },
        { new: true },
      )
      .exec();
    if (!updated) {
      throw new ConflictException({
        code: 'PUBLISH_CONFLICT',
        message: 'Trang đang được publish bởi người khác — thử lại',
      });
    }

    await this.invalidate(updated.domain?.subdomain);
    return this.toAdminResponse(updated);
  }

  async unpublish(id: string, userId: string): Promise<LandingResponseDto> {
    const doc = await this.findOneOr404(id);
    doc.status = 'unpublished';
    doc.updatedBy = userId;
    await doc.save();
    await this.invalidate(doc.domain?.subdomain);
    return this.toAdminResponse(doc);
  }

  async softDelete(id: string, userId: string): Promise<{ success: boolean }> {
    const doc = await this.findOneOr404(id);
    doc.status = 'archived';
    doc.updatedBy = userId;
    await doc.save();
    await this.invalidate(doc.domain?.subdomain);
    return { success: true };
  }

  // ─── Public reads (cache + SETNX anti-stampede) ────────────────

  async findBySlugPublic(subdomain: string): Promise<PublicLandingResponseDto> {
    const cacheKey = LANDING_CACHE.SLUG_PREFIX + subdomain;
    const cached = await this.cacheGet(cacheKey);
    if (cached) return cached as PublicLandingResponseDto;

    const doc = await this.queryPublished(subdomain);
    if (!doc) throw new NotFoundException('Không tìm thấy trang');
    const res = this.toPublicResponse(doc);
    await this.cacheSet(cacheKey, res, LANDING_CACHE.CACHE_TTL_SECONDS);
    return res;
  }

  async resolveHost(host: string): Promise<{ slug: string }> {
    const subdomain = this.extractSubdomain(host);
    if (!subdomain) throw new NotFoundException('Host không hợp lệ');
    const cacheKey = LANDING_CACHE.RESOLVE_PREFIX + host;
    const cached = await this.cacheGet(cacheKey);
    if (cached) return cached as { slug: string };

    const doc = await this.landingModel
      .findOne({ 'domain.subdomain': subdomain, status: 'published' })
      .select('_id')
      .lean()
      .exec();
    if (!doc) throw new NotFoundException('Không tìm thấy trang');
    const res = { slug: subdomain };
    await this.cacheSet(cacheKey, res, LANDING_CACHE.RESOLVE_TTL_SECONDS);
    return res;
  }

  // ─── Helpers ───────────────────────────────────────────────────

  private async queryPublished(
    subdomain: string,
  ): Promise<RaceLandingDocument | null> {
    if (!this.redis) {
      return this.landingModel
        .findOne({ 'domain.subdomain': subdomain, status: 'published' })
        .exec();
    }
    const lockKey = LANDING_CACHE.LOCK_PREFIX + subdomain;
    const cacheKey = LANDING_CACHE.SLUG_PREFIX + subdomain;
    for (let attempt = 0; attempt < LANDING_CACHE.LOCK_RETRY_MAX; attempt++) {
      const lock = await this.redis.set(
        lockKey,
        '1',
        'EX',
        LANDING_CACHE.LOCK_TTL_SECONDS,
        'NX',
      );
      if (lock) {
        return this.landingModel
          .findOne({ 'domain.subdomain': subdomain, status: 'published' })
          .exec();
      }
      await this.sleep(LANDING_CACHE.LOCK_RETRY_SLEEP_MS);
      const retry = await this.cacheGet(cacheKey);
      if (retry) return null; // another worker warmed cache; caller re-reads cache path
    }
    // contended fallback — direct query, accept brief stampede.
    return this.landingModel
      .findOne({ 'domain.subdomain': subdomain, status: 'published' })
      .exec();
  }

  private buildSeedSections(
    race: RaceLean,
    mysqlRaceId: number | null,
  ): LandingSection[] {
    const cta = this.buildCtaHref(mysqlRaceId, race.slug ?? '', 'hero');
    const has5pix = !!race.enable5pix && !!race.pixEventUrl;
    const seeds: Array<{
      type: LandingSectionType;
      variant: string;
      enabled: boolean;
      data: Record<string, unknown>;
    }> = [
      {
        type: 'hero',
        variant: 'image',
        enabled: true,
        data: {
          title: race.title,
          media: race.bannerUrl ?? '',
          countdownTo: race.startDate ?? null,
          ctaButtons: [{ label: 'Đăng ký ngay', href: cta, style: 'primary' }],
        },
      },
      { type: 'about', variant: 'image-right', enabled: false, data: {} },
      { type: 'course', variant: 'default', enabled: true, data: { source: 'race_courses' } },
      { type: 'schedule', variant: 'timeline', enabled: false, data: { items: [] } },
      { type: 'pricing', variant: 'default', enabled: false, data: { tiers: [] } },
      { type: 'results_embed', variant: 'default', enabled: true, data: { mode: 'native' } },
      { type: 'photos_embed', variant: 'default', enabled: has5pix, data: { pixEventUrl: race.pixEventUrl ?? '' } },
      { type: 'gallery', variant: 'bento', enabled: false, data: { items: [] } },
      { type: 'sponsors', variant: 'tier', enabled: true, data: { source: 'race_sponsors' } },
      { type: 'contact_social', variant: 'default', enabled: false, data: {} },
    ];
    return seeds.map(
      (s, idx) =>
        ({
          _id: new Types.ObjectId(),
          type: s.type,
          variant: s.variant,
          enabled: s.enabled,
          order: idx,
          data: s.data,
        }) as LandingSection,
    );
  }

  /** BR-83-12 — auto-fill CTA when mysql_race_id present; else empty (admin fills). */
  private buildCtaHref(
    mysqlRaceId: number | null,
    slug: string,
    medium: string,
  ): string {
    if (mysqlRaceId == null) return '';
    const params = `utm_source=landing&utm_medium=${medium}&utm_campaign=${encodeURIComponent(slug)}`;
    return `${TICKETING_BASE_URL}${mysqlRaceId}?${params}`;
  }

  private assertVariant(type: LandingSectionType, variant: string): void {
    const allowed = VARIANTS_BY_TYPE[type];
    if (!allowed || !allowed.includes(variant)) {
      throw new BadRequestException(
        `Variant "${variant}" không hợp lệ cho section "${type}"`,
      );
    }
  }

  private async assertSubdomainAvailable(
    subdomain: string,
    selfId: string,
  ): Promise<void> {
    if (!SUBDOMAIN_REGEX.test(subdomain)) {
      throw new BadRequestException({
        code: 'SUBDOMAIN_INVALID',
        message: 'Subdomain không hợp lệ',
      });
    }
    if (RESERVED_SUBDOMAINS.includes(subdomain)) {
      throw new BadRequestException({
        code: 'SUBDOMAIN_RESERVED',
        message: 'Subdomain này được hệ thống giữ chỗ',
      });
    }
    const clash = await this.landingModel
      .findOne({ 'domain.subdomain': subdomain, _id: { $ne: this.toObjectId(selfId) } })
      .select('_id')
      .lean()
      .exec();
    if (clash) {
      throw new ConflictException({
        code: 'SUBDOMAIN_TAKEN',
        message: 'Subdomain đã được dùng cho giải khác',
      });
    }
  }

  private sanitizeSectionData(
    _type: LandingSectionType,
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    const out = { ...data };
    if (typeof out.richText === 'string') {
      out.richText = sanitizeHtmlLib(
        out.richText,
        LandingService.RICH_TEXT_SANITIZE,
      );
    }
    return out;
  }

  private async findOneOr404(id: string): Promise<RaceLandingDocument> {
    const objId = this.toObjectId(id);
    const doc = objId ? await this.landingModel.findById(objId).exec() : null;
    if (!doc || doc.status === 'archived') {
      throw new NotFoundException('Không tìm thấy trang landing');
    }
    return doc;
  }

  // ─── Response mapping (strip) ──────────────────────────────────

  private toAdminResponse(doc: RaceLandingDocument): LandingResponseDto {
    return {
      id: String(doc._id),
      raceRef: {
        raceId: doc.raceRef.raceId,
        mysqlRaceId: doc.raceRef.mysqlRaceId ?? null,
        slug: doc.raceRef.slug,
      },
      internalName: doc.internalName,
      status: doc.status,
      meta: this.metaOut(doc.meta),
      theme: doc.theme as never,
      domain: {
        subdomain: doc.domain?.subdomain,
        domainStatus: doc.domain?.domainStatus ?? 'none',
        sslStatus: doc.domain?.sslStatus ?? 'none',
      },
      sections: (doc.sections ?? []).map((s) => this.sectionOut(s)),
      publish: {
        hasUnpublishedChanges: doc.publish?.hasUnpublishedChanges ?? false,
        version: doc.publish?.version ?? 0,
        publishedAt: doc.publish?.publishedAt ?? null,
      },
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  /** BR-83-20 — public strip: _id→id, no merchantRef.tenantId/internalName/draft. */
  private toPublicResponse(doc: RaceLandingDocument): PublicLandingResponseDto {
    const snap = doc.publish?.liveSnapshot;
    return {
      id: String(doc._id),
      raceRef: {
        raceId: doc.raceRef.raceId,
        mysqlRaceId: doc.raceRef.mysqlRaceId ?? null,
        slug: doc.raceRef.slug,
      },
      meta: this.metaOut(snap?.meta ?? doc.meta),
      theme: (snap?.theme ?? doc.theme) as never,
      subdomain: doc.domain?.subdomain,
      sections: (snap?.sections ?? []).map((s) => this.sectionOut(s)),
    };
  }

  private metaOut(meta: RaceLanding['meta']): LandingResponseDto['meta'] {
    return {
      title: meta?.title,
      description: meta?.description,
      lang: meta?.lang ?? 'vi',
      ogImage: meta?.ogImage,
      favicon: meta?.favicon,
      robots: meta?.robots ?? 'index,follow',
      analytics: {
        ga4MeasurementId: meta?.analytics?.ga4MeasurementId,
        fbPixelId: meta?.analytics?.fbPixelId,
      },
    };
  }

  private sectionOut(s: LandingSection): LandingResponseDto['sections'][number] {
    return {
      id: String(s._id),
      type: s.type,
      variant: s.variant,
      enabled: s.enabled,
      order: s.order,
      anchor: s.anchor,
      data: s.data ?? {},
    };
  }

  // ─── Low-level utils ───────────────────────────────────────────

  private async invalidate(subdomain?: string): Promise<void> {
    if (!this.redis || !subdomain) return;
    try {
      await this.redis.del(LANDING_CACHE.SLUG_PREFIX + subdomain);
      const hosts = await this.redis.keys(
        `${LANDING_CACHE.RESOLVE_PREFIX}${subdomain}.*`,
      );
      if (hosts.length) await this.redis.del(...hosts);
    } catch (err) {
      this.logger.warn(`Redis invalidate failed: ${String(err)}`);
    }
  }

  private async cacheGet(key: string): Promise<unknown | null> {
    if (!this.redis) return null;
    try {
      const raw = await this.redis.get(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      this.logger.warn(`Redis get failed: ${String(err)}`);
      return null;
    }
  }

  private async cacheSet(key: string, value: unknown, ttl: number): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttl);
    } catch (err) {
      this.logger.warn(`Redis set failed: ${String(err)}`);
    }
  }

  private extractSubdomain(host: string): string | null {
    const clean = (host || '').toLowerCase().split(':')[0].trim();
    const parts = clean.split('.');
    if (parts.length < 3) return null; // need <sub>.5bib.com
    return parts[0] || null;
  }

  private cleanUndefined<T extends object>(obj: T): Partial<T> {
    const out: Partial<T> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) out[k as keyof T] = v as T[keyof T];
    }
    return out;
  }

  private toObjectId(id?: string): Types.ObjectId | undefined {
    if (id && Types.ObjectId.isValid(id)) return new Types.ObjectId(id);
    return undefined;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
