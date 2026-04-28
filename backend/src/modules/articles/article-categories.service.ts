import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { isValidObjectId, Model, QueryFilter } from 'mongoose';
import Redis from 'ioredis';
import {
  ArticleCategory,
  ArticleCategoryDocument,
} from './schemas/article-category.schema';
import { Article, ArticleDocument } from './schemas/article.schema';
import {
  ArticleCategoryResponseDto,
  CreateArticleCategoryDto,
  ReorderArticleCategoriesDto,
  UpdateArticleCategoryDto,
} from './dto/article-category.dto';
import { generateSlug } from './utils/slug.util';

const MONGO_DUP_KEY = 11000;
const NOT_FOUND = 'Không tìm thấy danh mục';

@Injectable()
export class ArticleCategoriesService {
  private readonly logger = new Logger(ArticleCategoriesService.name);

  constructor(
    @InjectModel(ArticleCategory.name)
    private readonly categoryModel: Model<ArticleCategoryDocument>,
    @InjectModel(Article.name)
    private readonly articleModel: Model<ArticleDocument>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  // ─── Helpers ─────────────────────────────────────────────────

  private async findByIdOrThrow(id: string): Promise<ArticleCategoryDocument> {
    if (!isValidObjectId(id)) throw new NotFoundException(NOT_FOUND);
    const doc = await this.categoryModel.findById(id).exec();
    if (!doc) throw new NotFoundException(NOT_FOUND);
    return doc;
  }

  private async ensureUniqueSlug(desired: string, excludeId?: string): Promise<string> {
    const base = desired || 'danh-muc';
    let candidate = base;
    let suffix = 2;
    for (let i = 0; i < 100; i++) {
      const filter: QueryFilter<ArticleCategoryDocument> = excludeId
        ? { slug: candidate, _id: { $ne: excludeId } }
        : { slug: candidate };
      const exists = await this.categoryModel.exists(filter);
      if (!exists) return candidate;
      candidate = `${base}-${suffix++}`;
    }
    throw new ConflictException('Không tạo được slug duy nhất');
  }

  private isSlugDuplicateError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const e = err as { code?: number; keyPattern?: Record<string, unknown> };
    return e.code === MONGO_DUP_KEY && !!e.keyPattern && 'slug' in e.keyPattern;
  }

  /** Articles cache contains category-driven public list — flush after cat write. */
  private async invalidateArticlesCache() {
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
      this.logger.warn(`Cache invalidate failed: ${(err as Error).message}`);
    }
  }

  private toDto(doc: ArticleCategory, articleCount = 0): ArticleCategoryResponseDto {
    return {
      id: String(doc._id),
      slug: doc.slug,
      name: doc.name,
      type: doc.type,
      icon: doc.icon ?? '📁',
      tint: doc.tint ?? '#1D49FF',
      description: doc.description ?? '',
      order: doc.order ?? 0,
      isActive: !!doc.isActive,
      articleCount,
    };
  }

  /** Aggregate counts for a list of category slugs in one query. */
  private async countArticlesBySlugs(slugs: string[]): Promise<Record<string, number>> {
    if (slugs.length === 0) return {};
    const rows = await this.articleModel
      .aggregate<{ _id: string; count: number }>([
        {
          $match: {
            status: 'published',
            isDeleted: false,
            category: { $in: slugs },
          },
        },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ])
      .exec();
    const map: Record<string, number> = {};
    for (const r of rows) map[r._id] = r.count;
    return map;
  }

  // ─── Admin: CRUD ─────────────────────────────────────────────

  async create(dto: CreateArticleCategoryDto): Promise<ArticleCategoryResponseDto> {
    const baseSlug = dto.slug ? dto.slug : generateSlug(dto.name);
    const payload = {
      name: dto.name,
      type: dto.type ?? 'both',
      icon: dto.icon ?? '📁',
      tint: dto.tint ?? '#1D49FF',
      description: dto.description ?? '',
      order: dto.order ?? 0,
      isActive: dto.isActive ?? true,
    };

    for (let attempt = 0; attempt < 3; attempt++) {
      const candidate =
        attempt === 0 ? baseSlug : `${baseSlug}-${Date.now().toString(36)}`;
      const slug = await this.ensureUniqueSlug(candidate);
      try {
        const doc = await this.categoryModel.create({ ...payload, slug });
        await this.invalidateArticlesCache();
        return this.toDto(doc.toObject(), 0);
      } catch (err) {
        if (this.isSlugDuplicateError(err)) continue;
        throw err;
      }
    }
    throw new ConflictException('Slug danh mục đang xung đột, vui lòng thử lại');
  }

  async update(id: string, dto: UpdateArticleCategoryDto): Promise<ArticleCategoryResponseDto> {
    const doc = await this.findByIdOrThrow(id);
    const oldSlug = doc.slug;
    const newSlug =
      dto.slug && dto.slug !== doc.slug ? await this.ensureUniqueSlug(dto.slug, id) : doc.slug;

    // B-19: cascade FIRST, then save category. Reverse order minimizes the
    // partial-state blast radius if the process dies mid-update — articles
    // already point to the new slug; failing the save means user retries and
    // the (now-idempotent) cascade is a no-op since articles already match.
    if (newSlug !== oldSlug) {
      await this.articleModel.updateMany({ category: oldSlug }, { $set: { category: newSlug } }).exec();
    }

    doc.slug = newSlug;
    if (dto.name !== undefined) doc.name = dto.name;
    if (dto.type !== undefined) doc.type = dto.type;
    if (dto.icon !== undefined) doc.icon = dto.icon;
    if (dto.tint !== undefined) doc.tint = dto.tint;
    if (dto.description !== undefined) doc.description = dto.description;
    if (dto.order !== undefined) doc.order = dto.order;
    if (dto.isActive !== undefined) doc.isActive = dto.isActive;
    await doc.save();

    await this.invalidateArticlesCache();
    const counts = await this.countArticlesBySlugs([doc.slug]);
    return this.toDto(doc.toObject(), counts[doc.slug] ?? 0);
  }

  async remove(id: string): Promise<{ ok: true }> {
    const doc = await this.findByIdOrThrow(id);
    const inUse = await this.articleModel.exists({ category: doc.slug }).exec();
    if (inUse) {
      throw new ConflictException(
        'Danh mục đang được sử dụng bởi 1 hoặc nhiều bài viết. Hãy reassign trước khi xóa.',
      );
    }
    await doc.deleteOne();
    await this.invalidateArticlesCache();
    return { ok: true };
  }

  async reorder(dto: ReorderArticleCategoriesDto): Promise<{ ok: true }> {
    const ops = dto.items
      .filter((it) => isValidObjectId(it.id))
      .map((it) => ({
        updateOne: {
          filter: { _id: it.id },
          update: { $set: { order: it.order } },
        },
      }));
    if (ops.length === 0) return { ok: true };
    await this.categoryModel.bulkWrite(ops);
    await this.invalidateArticlesCache();
    return { ok: true };
  }

  // ─── Read (admin + public share same shape) ───────────────────

  async listAdmin(): Promise<ArticleCategoryResponseDto[]> {
    const docs = await this.categoryModel
      .find()
      .sort({ order: 1, name: 1 })
      .lean<ArticleCategory[]>()
      .exec();
    const counts = await this.countArticlesBySlugs(docs.map((d) => d.slug));
    return docs.map((d) => this.toDto(d, counts[d.slug] ?? 0));
  }

  async listPublic(type?: 'news' | 'help'): Promise<ArticleCategoryResponseDto[]> {
    const cacheKey = `articles:categories:${type ?? 'all'}`;
    const cached = await this.redis.get(cacheKey).catch(() => null);
    if (cached) return JSON.parse(cached) as ArticleCategoryResponseDto[];

    const filter: QueryFilter<ArticleCategoryDocument> = { isActive: true };
    if (type) filter.type = { $in: [type, 'both'] };

    const docs = await this.categoryModel
      .find(filter)
      .sort({ order: 1, name: 1 })
      .lean<ArticleCategory[]>()
      .exec();
    const counts = await this.countArticlesBySlugs(docs.map((d) => d.slug));
    // B-25: strip `isActive` from public response — admin metadata, not useful
    // to consumers (list already filters isActive=true so all items are active).
    const result = docs.map((d) => {
      const dto = this.toDto(d, counts[d.slug] ?? 0);
      const { isActive: _drop, ...publicShape } = dto;
      void _drop;
      return publicShape as ArticleCategoryResponseDto;
    });
    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 300).catch(() => {});
    return result;
  }

  async findById(id: string): Promise<ArticleCategoryResponseDto> {
    const doc = await this.findByIdOrThrow(id);
    const counts = await this.countArticlesBySlugs([doc.slug]);
    return this.toDto(doc.toObject(), counts[doc.slug] ?? 0);
  }
}
