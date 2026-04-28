import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { QueryFilter, Model, isValidObjectId } from 'mongoose';
import Redis from 'ioredis';
import { Article, ArticleDocument } from './schemas/article.schema';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import {
  ListArticlesAdminQueryDto,
  ListArticlesPublicQueryDto,
  LatestArticlesQueryDto,
} from './dto/list-articles-query.dto';
import {
  ArticleAdminDto,
  ArticleCardDto,
  ArticleDetailDto,
  ArticleStatsDto,
  HelpfulVoteResponseDto,
  PaginatedAdminArticlesDto,
  PaginatedArticlesDto,
  ViewCountResponseDto,
} from './dto/article-response.dto';
import { computeReadTimeMinutes, generateSlug } from './utils/slug.util';
import { sanitizeArticleContent } from './utils/sanitize.util';
import { buildTableOfContents } from './utils/toc.util';
import { escapeRegex } from './utils/regex.util';

// Mongo duplicate-key error code — only thrown by E11000 (unique index conflict).
const MONGO_DUP_KEY = 11000;
const ARTICLE_NOT_FOUND = 'Không tìm thấy bài viết';

const CACHE_TTL = {
  latest: 300,
  list: 120,
  detail: 600,
};

// Rate-limit windows for anonymous public POST endpoints (B-05).
const RATE_LIMIT_TTL = {
  view: 300, // 1 view per IP per 5 min — same session reload = same view
  helpful: 86400, // 1 vote per IP per 24h — prevents simple downvote brigades
};

interface ArticleAuthor {
  id?: string;
  name?: string;
  avatar?: string;
}

@Injectable()
export class ArticlesService {
  private readonly logger = new Logger(ArticlesService.name);

  constructor(
    @InjectModel(Article.name) private readonly articleModel: Model<ArticleDocument>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  // ─── Cache helpers ───────────────────────────────────────────

  private async cacheGet<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (err) {
      this.logger.warn(`Redis GET ${key} failed: ${(err as Error).message}`);
      return null;
    }
  }

  private async cacheSet(key: string, value: unknown, ttl: number) {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttl);
    } catch (err) {
      this.logger.warn(`Redis SET ${key} failed: ${(err as Error).message}`);
    }
  }

  private async invalidateAll() {
    try {
      const stream = this.redis.scanStream({ match: 'articles:*', count: 200 });
      const pipeline = this.redis.pipeline();
      let count = 0;
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (keys: string[]) => {
          for (const k of keys) {
            pipeline.del(k);
            count++;
          }
        });
        stream.on('end', () => resolve());
        stream.on('error', (err) => reject(err));
      });
      if (count > 0) await pipeline.exec();
    } catch (err) {
      this.logger.warn(`Cache invalidation failed: ${(err as Error).message}`);
    }
  }

  // ─── Mappers ─────────────────────────────────────────────────

  private toCardDto(doc: Article): ArticleCardDto {
    return {
      id: String(doc._id),
      slug: doc.slug,
      title: doc.title,
      excerpt: doc.excerpt ?? '',
      coverImageUrl: doc.coverImageUrl ?? '',
      type: doc.type,
      products: doc.products ?? [],
      category: doc.category ?? '',
      authorName: doc.authorName ?? '',
      authorAvatar: doc.authorAvatar ?? '',
      publishedAt: doc.publishedAt ?? null,
      readTimeMinutes: doc.readTimeMinutes ?? 1,
      featured: !!doc.featured,
    };
  }

  private toAdminDto(doc: Article): ArticleAdminDto {
    return {
      ...this.toCardDto(doc),
      content: doc.content ?? '',
      seoTitle: doc.seoTitle ?? '',
      seoDescription: doc.seoDescription ?? '',
      status: doc.status,
      isDeleted: !!doc.isDeleted,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      authorId: doc.authorId,
      viewCount: doc.viewCount ?? 0,
      helpfulYes: doc.helpfulYes ?? 0,
      helpfulNo: doc.helpfulNo ?? 0,
    };
  }

  // ─── ID helpers ──────────────────────────────────────────────

  /**
   * Validate `:id` path param is a valid ObjectId, then load. Throws 404 for
   * both invalid format and missing document (avoids leaking Mongoose
   * CastError as 500 to clients).
   */
  private async findByIdOrThrow(id: string): Promise<ArticleDocument> {
    if (!isValidObjectId(id)) throw new NotFoundException(ARTICLE_NOT_FOUND);
    const doc = await this.articleModel.findById(id).exec();
    if (!doc) throw new NotFoundException(ARTICLE_NOT_FOUND);
    return doc;
  }

  private async findByIdLeanOrThrow(id: string): Promise<Article> {
    if (!isValidObjectId(id)) throw new NotFoundException(ARTICLE_NOT_FOUND);
    const doc = await this.articleModel.findById(id).lean<Article>().exec();
    if (!doc) throw new NotFoundException(ARTICLE_NOT_FOUND);
    return doc;
  }

  // ─── Slug helpers ────────────────────────────────────────────

  private async ensureUniqueSlug(desired: string, excludeId?: string): Promise<string> {
    const base = desired || 'bai-viet';
    let candidate = base;
    let suffix = 2;
    // Bound the loop — practically returns within 1-3 iterations.
    for (let i = 0; i < 100; i++) {
      const filter: QueryFilter<ArticleDocument> = excludeId
        ? { slug: candidate, _id: { $ne: excludeId } }
        : { slug: candidate };
      const exists = await this.articleModel.exists(filter);
      if (!exists) return candidate;
      candidate = `${base}-${suffix++}`;
    }
    throw new ConflictException('Không tạo được slug duy nhất');
  }

  // ─── Admin: Create ───────────────────────────────────────────

  async create(dto: CreateArticleDto, author: ArticleAuthor): Promise<ArticleAdminDto> {
    const baseSlug = dto.slug ? dto.slug : generateSlug(dto.title);
    const sanitized = dto.content ? sanitizeArticleContent(dto.content) : '';
    const { html: contentWithIds } = buildTableOfContents(sanitized);

    const payload = {
      title: dto.title,
      type: dto.type,
      products: dto.products ?? [],
      category: dto.category ?? '',
      content: contentWithIds,
      excerpt: dto.excerpt ?? '',
      coverImageUrl: dto.coverImageUrl ?? '',
      seoTitle: dto.seoTitle ?? '',
      seoDescription: dto.seoDescription ?? '',
      featured: dto.featured ?? false,
      status: 'draft' as const,
      publishedAt: null,
      authorId: author.id,
      authorName: author.name,
      authorAvatar: author.avatar,
      readTimeMinutes: computeReadTimeMinutes(contentWithIds),
      isDeleted: false,
    };

    // Retry with timestamp suffix on the rare cross-process slug race
    // (ensureUniqueSlug + create is not atomic — two parallel creates with the
    // same desired slug both pass the existence check, then second hits E11000).
    for (let attempt = 0; attempt < 3; attempt++) {
      const candidate =
        attempt === 0 ? baseSlug : `${baseSlug}-${Date.now().toString(36)}`;
      const slug = await this.ensureUniqueSlug(candidate);
      try {
        const doc = await this.articleModel.create({ ...payload, slug });
        await this.invalidateAll();
        return this.toAdminDto(doc.toObject());
      } catch (err) {
        if (this.isSlugDuplicateError(err)) continue;
        throw err;
      }
    }
    throw new ConflictException('Slug đang xung đột, vui lòng thử lại');
  }

  /** Detect E11000 specifically on the `slug` unique index. */
  private isSlugDuplicateError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const e = err as { code?: number; keyPattern?: Record<string, unknown> };
    return e.code === MONGO_DUP_KEY && !!e.keyPattern && 'slug' in e.keyPattern;
  }

  // ─── Admin: Update (autosave-friendly) ───────────────────────

  async update(id: string, dto: UpdateArticleDto): Promise<ArticleAdminDto> {
    const doc = await this.findByIdOrThrow(id);
    if (doc.isDeleted) throw new NotFoundException(ARTICLE_NOT_FOUND);

    if (dto.slug && dto.slug !== doc.slug) {
      doc.slug = await this.ensureUniqueSlug(dto.slug, id);
    }

    if (dto.title !== undefined) doc.title = dto.title;
    if (dto.type !== undefined) doc.type = dto.type;
    if (dto.products !== undefined) doc.products = dto.products as Article['products'];
    if (dto.category !== undefined) doc.category = dto.category;
    if (dto.excerpt !== undefined) doc.excerpt = dto.excerpt;
    if (dto.coverImageUrl !== undefined) doc.coverImageUrl = dto.coverImageUrl;
    if (dto.seoTitle !== undefined) doc.seoTitle = dto.seoTitle;
    if (dto.seoDescription !== undefined) doc.seoDescription = dto.seoDescription;
    if (dto.featured !== undefined) doc.featured = dto.featured;

    if (dto.content !== undefined) {
      const sanitized = sanitizeArticleContent(dto.content);
      const { html: contentWithIds } = buildTableOfContents(sanitized);
      doc.content = contentWithIds;
      doc.readTimeMinutes = computeReadTimeMinutes(contentWithIds);
    }

    await doc.save();
    await this.invalidateAll();
    return this.toAdminDto(doc.toObject());
  }

  // ─── Admin: Publish / Unpublish ──────────────────────────────

  async publish(id: string): Promise<ArticleAdminDto> {
    const doc = await this.findByIdOrThrow(id);
    if (doc.isDeleted) throw new NotFoundException(ARTICLE_NOT_FOUND);

    // BR-02 — required fields when publishing
    const missing: string[] = [];
    if (!doc.title?.trim()) missing.push('title');
    if (!doc.content?.trim()) missing.push('content');
    if (!doc.slug?.trim()) missing.push('slug');
    if (!doc.type) missing.push('type');
    if (!doc.coverImageUrl?.trim()) missing.push('coverImageUrl');
    if (missing.length > 0) {
      throw new UnprocessableEntityException({
        message: 'Thiếu trường bắt buộc khi publish',
        missing,
      });
    }

    doc.status = 'published';
    // BR-09 — preserve first publishedAt
    if (!doc.publishedAt) doc.publishedAt = new Date();
    await doc.save();
    await this.invalidateAll();
    return this.toAdminDto(doc.toObject());
  }

  async unpublish(id: string): Promise<ArticleAdminDto> {
    const doc = await this.findByIdOrThrow(id);
    if (doc.isDeleted) throw new NotFoundException(ARTICLE_NOT_FOUND);
    doc.status = 'draft';
    await doc.save();
    await this.invalidateAll();
    return this.toAdminDto(doc.toObject());
  }

  // ─── Admin: Soft delete + Restore ────────────────────────────

  async softDelete(id: string): Promise<{ ok: true }> {
    const doc = await this.findByIdOrThrow(id);
    if (doc.isDeleted) return { ok: true };

    doc.isDeleted = true;
    doc.status = 'draft';
    // Free the slug so a new article can reuse it later (avoids unique-index conflict).
    doc.slug = `${doc.slug}-deleted-${Date.now()}`;
    await doc.save();
    await this.invalidateAll();
    return { ok: true };
  }

  async restore(id: string, newSlug?: string): Promise<ArticleAdminDto> {
    const doc = await this.findByIdOrThrow(id);
    if (!doc.isDeleted) return this.toAdminDto(doc.toObject());

    const desired = newSlug ?? doc.slug.replace(/-deleted-\d+$/, '');
    doc.slug = await this.ensureUniqueSlug(desired || generateSlug(doc.title), id);
    doc.isDeleted = false;
    await doc.save();
    await this.invalidateAll();
    return this.toAdminDto(doc.toObject());
  }

  // ─── Admin: Read ─────────────────────────────────────────────

  async findAdminById(id: string): Promise<ArticleAdminDto> {
    const doc = await this.findByIdLeanOrThrow(id);
    return this.toAdminDto(doc);
  }

  async listAdmin(query: ListArticlesAdminQueryDto): Promise<PaginatedAdminArticlesDto> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));
    const filter: QueryFilter<ArticleDocument> = {};

    if (!query.includeDeleted) filter.isDeleted = false;
    if (query.type) filter.type = query.type;
    if (query.product) filter.products = query.product;
    if (query.category) filter.category = query.category;
    if (query.status && query.status !== 'all') filter.status = query.status;
    if (query.q?.trim()) {
      filter.title = { $regex: escapeRegex(query.q.trim()), $options: 'i' };
    }

    const [items, total] = await Promise.all([
      this.articleModel
        .find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<Article[]>()
        .exec(),
      this.articleModel.countDocuments(filter).exec(),
    ]);

    return {
      items: items.map((d) => this.toAdminDto(d)),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async stats(): Promise<ArticleStatsDto> {
    const [published, draft, deleted, total] = await Promise.all([
      this.articleModel.countDocuments({ status: 'published', isDeleted: false }).exec(),
      this.articleModel.countDocuments({ status: 'draft', isDeleted: false }).exec(),
      this.articleModel.countDocuments({ isDeleted: true }).exec(),
      this.articleModel.countDocuments({}).exec(),
    ]);
    return { total, published, draft, deleted };
  }

  // ─── Public: Latest (widget) ─────────────────────────────────

  async listLatest(query: LatestArticlesQueryDto): Promise<ArticleCardDto[]> {
    const limit = Math.min(20, Math.max(1, query.limit ?? 10));
    const cacheKey = `articles:latest:${query.type ?? 'all'}:${query.product ?? 'all'}:${limit}`;

    const cached = await this.cacheGet<ArticleCardDto[]>(cacheKey);
    if (cached) return cached;

    const filter: QueryFilter<ArticleDocument> = { status: 'published', isDeleted: false };
    if (query.type) filter.type = query.type;
    if (query.product) filter.products = { $in: [query.product, 'all'] };

    const docs = await this.articleModel
      .find(filter)
      .sort({ publishedAt: -1 })
      .limit(limit)
      .lean<Article[]>()
      .exec();

    const result = docs.map((d) => this.toCardDto(d));
    await this.cacheSet(cacheKey, result, CACHE_TTL.latest);
    return result;
  }

  // ─── Public: Paginated list ──────────────────────────────────

  async listPublic(query: ListArticlesPublicQueryDto): Promise<PaginatedArticlesDto> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 12));
    const cacheKey = `articles:list:${query.type ?? 'all'}:${query.product ?? 'all'}:${query.category ?? 'all'}:${page}:${limit}`;

    const cached = await this.cacheGet<PaginatedArticlesDto>(cacheKey);
    if (cached) return cached;

    const filter: QueryFilter<ArticleDocument> = { status: 'published', isDeleted: false };
    if (query.type) filter.type = query.type;
    if (query.product) filter.products = { $in: [query.product, 'all'] };
    if (query.category) filter.category = query.category;

    const [docs, total] = await Promise.all([
      this.articleModel
        .find(filter)
        .sort({ publishedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<Article[]>()
        .exec(),
      this.articleModel.countDocuments(filter).exec(),
    ]);

    const result: PaginatedArticlesDto = {
      items: docs.map((d) => this.toCardDto(d)),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
    await this.cacheSet(cacheKey, result, CACHE_TTL.list);
    return result;
  }

  // ─── Public: Detail by slug ──────────────────────────────────

  async findPublicBySlug(slug: string): Promise<ArticleDetailDto> {
    const cacheKey = `articles:detail:${slug}`;
    const cached = await this.cacheGet<ArticleDetailDto>(cacheKey);
    if (cached) return cached;

    const doc = await this.articleModel
      .findOne({ slug, status: 'published', isDeleted: false })
      .lean<Article>()
      .exec();
    if (!doc) throw new NotFoundException('Không tìm thấy bài viết');

    const { toc } = buildTableOfContents(doc.content ?? '');

    // Related: same type + at least one product overlap, exclude self.
    const relatedDocs = await this.articleModel
      .find({
        _id: { $ne: doc._id },
        status: 'published',
        isDeleted: false,
        type: doc.type,
        ...(doc.products?.length
          ? { products: { $in: doc.products } }
          : {}),
      })
      .sort({ publishedAt: -1 })
      .limit(3)
      .lean<Article[]>()
      .exec();

    const detail: ArticleDetailDto = {
      ...this.toCardDto(doc),
      content: doc.content ?? '',
      seoTitle: doc.seoTitle ?? '',
      seoDescription: doc.seoDescription ?? '',
      tableOfContents: toc,
      related: relatedDocs.map((r) => this.toCardDto(r)),
      helpfulYes: doc.helpfulYes ?? 0,
      helpfulNo: doc.helpfulNo ?? 0,
      viewCount: doc.viewCount ?? 0,
    };

    await this.cacheSet(cacheKey, detail, CACHE_TTL.detail);
    return detail;
  }

  // ─── Public: View count + helpful vote ───────────────────────

  /**
   * Increment view counter, deduped per IP per 5 min via Redis SETNX.
   * Returns silently with `alreadyCounted=true` when dedup hit (better UX
   * than 429 — frontend doesn't need to handle errors).
   */
  async incrementView(slug: string, ip: string): Promise<ViewCountResponseDto> {
    const dedupKey = `ratelimit:article-view:${slug}:${ip}`;
    const acquired = await this.redis.set(dedupKey, '1', 'EX', RATE_LIMIT_TTL.view, 'NX');
    if (!acquired) {
      // Same IP already counted in this window — return current count without inc
      const doc = await this.articleModel
        .findOne({ slug, status: 'published', isDeleted: false })
        .select({ viewCount: 1 })
        .lean()
        .exec();
      if (!doc) throw new NotFoundException(ARTICLE_NOT_FOUND);
      return { viewCount: doc.viewCount ?? 0, alreadyCounted: true };
    }

    const doc = await this.articleModel
      .findOneAndUpdate(
        { slug, status: 'published', isDeleted: false },
        { $inc: { viewCount: 1 } },
        { new: true, projection: { viewCount: 1 } },
      )
      .lean()
      .exec();
    if (!doc) {
      // Roll back rate-limit slot so a re-attempt with the right slug works
      await this.redis.del(dedupKey).catch(() => {});
      throw new NotFoundException(ARTICLE_NOT_FOUND);
    }
    return { viewCount: doc.viewCount ?? 0, alreadyCounted: false };
  }

  /**
   * Vote helpful, deduped per IP per 24h via Redis SETNX.
   * Already voted → return current counts + alreadyVoted=true (UI disables button).
   * Per PO P0-02 — anonymous tracking is OK; if Danny later wants logged-in
   * user dedup, swap key to `helpful:{slug}:{userId}` here.
   */
  async voteHelpful(slug: string, helpful: boolean, ip: string): Promise<HelpfulVoteResponseDto> {
    const dedupKey = `ratelimit:article-helpful:${slug}:${ip}`;
    const acquired = await this.redis.set(dedupKey, helpful ? 'y' : 'n', 'EX', RATE_LIMIT_TTL.helpful, 'NX');
    if (!acquired) {
      const doc = await this.articleModel
        .findOne({ slug, status: 'published', isDeleted: false })
        .select({ helpfulYes: 1, helpfulNo: 1 })
        .lean()
        .exec();
      if (!doc) throw new NotFoundException(ARTICLE_NOT_FOUND);
      return {
        helpfulYes: doc.helpfulYes ?? 0,
        helpfulNo: doc.helpfulNo ?? 0,
        alreadyVoted: true,
      };
    }

    const update = helpful ? { $inc: { helpfulYes: 1 } } : { $inc: { helpfulNo: 1 } };
    const doc = await this.articleModel
      .findOneAndUpdate(
        { slug, status: 'published', isDeleted: false },
        update,
        { new: true, projection: { helpfulYes: 1, helpfulNo: 1 } },
      )
      .lean()
      .exec();
    if (!doc) {
      await this.redis.del(dedupKey).catch(() => {});
      throw new NotFoundException(ARTICLE_NOT_FOUND);
    }
    // Detail cache holds counts — invalidate this slug only
    await this.redis.del(`articles:detail:${slug}`).catch(() => {});
    return {
      helpfulYes: doc.helpfulYes ?? 0,
      helpfulNo: doc.helpfulNo ?? 0,
      alreadyVoted: false,
    };
  }

  // ─── Categories list (for hotro.5bib.com category grid) ──────

  async listCategories(type?: 'news' | 'help'): Promise<{ category: string; count: number }[]> {
    const match: QueryFilter<ArticleDocument> = {
      status: 'published',
      isDeleted: false,
      category: { $exists: true, $ne: '' },
    };
    if (type) match.type = type;

    const rows = await this.articleModel
      .aggregate<{ _id: string; count: number }>([
        { $match: match },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ])
      .exec();

    return rows.map((r) => ({ category: r._id, count: r.count }));
  }

}
