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
import { slugifyVN } from '../../common/utils/slugify';
import {
  CertificateRenderService,
  RenderableTemplate,
  RenderData,
} from '../certificates/services/certificate-render.service';
import type {
  TemplateLayer,
  PhotoArea,
} from '../certificates/schemas/certificate-template.schema';

/**
 * FEATURE-090 — structural shape mà cả `CrewTemplate` (schema, bgColor required)
 * lẫn `CrewTemplateDto` (DTO, bgColor optional) đều assignable. Dùng cho render
 * (saved hoặc draft preview) — KHÔNG cast.
 */
export interface CrewTemplateInput {
  canvas: { width: number; height: number; backgroundColor?: string; backgroundImageUrl?: string };
  layers: TemplateLayer[];
  photoArea?: PhotoArea | null;
  placeholderPhotoUrl?: string | null;
  photoBehindBackground?: boolean;
}
import {
  CrewCertBatch,
  CrewCertBatchDocument,
  CrewCertNamedTemplate,
  CrewTemplate,
} from './schemas/crew-cert-batch.schema';
import {
  CrewCertRecipient,
  CrewCertRecipientDocument,
} from './schemas/crew-cert-recipient.schema';
import { CreateBatchDto, UpdateBatchDto } from './dto/crew-batch.dto';
import {
  BatchListResponseDto,
  BatchResponseDto,
  CrewSearchResultDto,
  RecipientRowDto,
} from './dto/crew-response.dto';
import {
  CREW_CACHE,
  CREW_SEARCH_MAX_RESULTS,
  CREW_SEARCH_MIN_CHARS,
} from './crew-certificates.constants';

const MONGO_DUP_KEY = 11000;

@Injectable()
export class CrewCertificatesService {
  private readonly logger = new Logger(CrewCertificatesService.name);

  constructor(
    @InjectModel(CrewCertBatch.name)
    private readonly batchModel: Model<CrewCertBatchDocument>,
    @InjectModel(CrewCertRecipient.name)
    private readonly recipientModel: Model<CrewCertRecipientDocument>,
    private readonly renderService: CertificateRenderService,
    @Optional() @InjectRedis() private readonly redis?: Redis,
  ) {}

  // ─── Admin batch CRUD ──────────────────────────────────────────

  async createBatch(dto: CreateBatchDto, userId: string): Promise<BatchResponseDto> {
    try {
      const doc = await this.batchModel.create({
        slug: dto.slug,
        eventName: dto.eventName,
        createdBy: userId,
      });
      return this.toBatchResponse(doc, 0);
    } catch (err) {
      if (this.isDupKey(err)) {
        throw new ConflictException('Slug đã tồn tại, chọn cái khác');
      }
      throw err;
    }
  }

  async listBatches(): Promise<BatchListResponseDto> {
    const docs = await this.batchModel.find().sort({ createdAt: -1 }).exec();
    const counts = await Promise.all(
      docs.map((d) => this.recipientModel.countDocuments({ batchId: d._id }).exec()),
    );
    return {
      items: docs.map((d, i) => ({
        id: String(d._id),
        slug: d.slug,
        eventName: d.eventName,
        active: d.active,
        recipientCount: counts[i],
        updatedAt: d.updatedAt.toISOString(),
      })),
      total: docs.length,
    };
  }

  async getBatch(id: string): Promise<BatchResponseDto> {
    const doc = await this.findBatchOr404(id);
    const count = await this.recipientModel.countDocuments({ batchId: doc._id }).exec();
    return this.toBatchResponse(doc, count);
  }

  async updateBatch(id: string, dto: UpdateBatchDto): Promise<BatchResponseDto> {
    const doc = await this.findBatchOr404(id);
    if (dto.eventName !== undefined) doc.eventName = dto.eventName;
    if (dto.slug !== undefined) doc.slug = dto.slug;
    if (dto.active !== undefined) doc.active = dto.active;
    if (dto.extraFields !== undefined) doc.extraFields = dto.extraFields;
    if (dto.template !== undefined) doc.template = dto.template as CrewTemplate;
    if (dto.templates !== undefined) {
      this.assertPositionsUnique(dto.templates);
      doc.templates = dto.templates as CrewCertNamedTemplate[];
    }
    try {
      await doc.save();
    } catch (err) {
      if (this.isDupKey(err)) throw new ConflictException('Slug đã tồn tại');
      throw err;
    }
    await this.invalidateBatchRenders(doc._id);
    const count = await this.recipientModel.countDocuments({ batchId: doc._id }).exec();
    return this.toBatchResponse(doc, count);
  }

  async removeBatch(id: string): Promise<void> {
    const doc = await this.findBatchOr404(id);
    await this.recipientModel.deleteMany({ batchId: doc._id }).exec();
    await this.batchModel.findByIdAndDelete(doc._id).exec();
    await this.invalidateBatchRenders(doc._id);
  }

  // ─── Roster ────────────────────────────────────────────────────

  /** Thay TOÀN BỘ recipients của batch bằng rows mới (re-upload = fresh). */
  async confirmRoster(
    id: string,
    rows: RecipientRowDto[],
  ): Promise<{ inserted: number }> {
    const batch = await this.findBatchOr404(id);
    if (!rows.length) throw new BadRequestException('Danh sách rỗng');

    const docs = rows.map((r) => ({
      batchId: batch._id,
      fullName: r.fullName,
      normalizedName: slugifyVN(r.fullName),
      position: r.position,
      photoUrl: r.photoUrl ?? null,
      extraFields: r.extraFields ?? {},
    }));

    await this.recipientModel.deleteMany({ batchId: batch._id }).exec();
    await this.recipientModel.insertMany(docs);

    // Cập nhật nhãn extraFields (union các key) để admin biết token khả dụng.
    const keys = new Set<string>();
    for (const r of rows) {
      for (const k of Object.keys(r.extraFields ?? {})) keys.add(k);
    }
    batch.extraFields = [...keys];
    await batch.save();
    await this.invalidateBatchRenders(batch._id);
    return { inserted: docs.length };
  }

  async listRecipients(id: string): Promise<CrewSearchResultDto[]> {
    const batch = await this.findBatchOr404(id);
    const docs = await this.recipientModel
      .find({ batchId: batch._id })
      .sort({ fullName: 1 })
      .limit(1000)
      .exec();
    return docs.map((d) => ({
      id: String(d._id),
      fullName: d.fullName,
      position: d.position,
    }));
  }

  /** FEATURE-094 — distinct `position` của đợt (trim, bỏ rỗng, unique, sort) — cho admin gán phôi. */
  async getPositions(id: string): Promise<string[]> {
    const batch = await this.findBatchOr404(id);
    const raw = await this.recipientModel
      .distinct('position', { batchId: batch._id })
      .exec();
    const set = new Set<string>();
    for (const p of raw) {
      const t = (typeof p === 'string' ? p : '').trim();
      if (t) set.add(t);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'vi'));
  }

  // ─── Public search + render ────────────────────────────────────

  async searchPublic(slug: string, name: string): Promise<CrewSearchResultDto[]> {
    const q = slugifyVN(name ?? '');
    if (q.length < CREW_SEARCH_MIN_CHARS) return []; // BR-05 chống enumeration
    const batch = await this.batchModel.findOne({ slug, active: true }).select('_id').exec();
    if (!batch) throw new NotFoundException('Không tìm thấy đợt GCN');
    const docs = await this.recipientModel
      .find({ batchId: batch._id, normalizedName: new RegExp(this.escapeRegex(q), 'i') })
      .limit(CREW_SEARCH_MAX_RESULTS)
      .exec();
    return docs.map((d) => ({
      id: String(d._id),
      fullName: d.fullName,
      position: d.position,
    }));
  }

  /** Render GCN PNG cho 1 recipient (public). Cache base64 Redis. */
  async renderPublic(recipientId: string): Promise<Buffer> {
    if (!Types.ObjectId.isValid(recipientId)) {
      throw new NotFoundException('Không tìm thấy');
    }
    const cacheKey = CREW_CACHE.RENDER_PREFIX + recipientId;
    const cached = await this.cacheGet(cacheKey);
    if (typeof cached === 'string') return Buffer.from(cached, 'base64');

    const recipient = await this.recipientModel.findById(recipientId).exec();
    if (!recipient) throw new NotFoundException('Không tìm thấy');
    const batch = await this.batchModel.findById(recipient.batchId).exec();
    if (!batch || !batch.active) throw new NotFoundException('Không tìm thấy');
    // FEATURE-094 — chọn phôi theo vị trí của crew (fallback phôi mặc định).
    const template = this.pickTemplateForPosition(recipient.position, batch);
    if (!template) throw new BadRequestException('Đợt GCN chưa cấu hình phôi');

    const buf = await this.renderService.render(
      this.toRenderable(template),
      this.buildRenderData(recipient, batch),
      { includePhoto: true },
    );
    await this.cacheSet(cacheKey, buf.toString('base64'), CREW_CACHE.RENDER_TTL_SECONDS);
    return buf;
  }

  /**
   * Admin preview render với dữ liệu mẫu (recipient đầu hoặc mock).
   * `draftTemplate` cho LIVE preview — render template chưa lưu (KHÔNG persist).
   * Bỏ trống → render template đã lưu.
   */
  async renderPreview(id: string, draftTemplate?: CrewTemplateInput): Promise<Buffer> {
    const batch = await this.findBatchOr404(id);
    const template = draftTemplate ?? batch.template;
    if (!template) throw new BadRequestException('Chưa cấu hình phôi');
    const sample = await this.recipientModel
      .findOne({ batchId: batch._id })
      .sort({ fullName: 1 })
      .exec();
    const data: RenderData = sample
      ? this.buildRenderData(sample, batch)
      : {
          runner_name: 'Nguyễn Văn A',
          event_name: batch.eventName,
          runner_photo_url: null,
          variables: { full_name: 'Nguyễn Văn A', position: 'Tình nguyện viên' },
        };
    return this.renderService.render(this.toRenderable(template), data, {
      includePhoto: true,
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────

  /**
   * FEATURE-094 — chọn phôi cho 1 vị trí: phôi phụ đầu tiên có `positions`
   * chứa `position` (trim + case-insensitive) → nếu không khớp / rỗng →
   * `batch.template` (phôi mặc định). `templates ?? []` cho batch F-090 cũ.
   */
  private pickTemplateForPosition(
    position: string | null | undefined,
    batch: CrewCertBatchDocument,
  ): CrewTemplate | null | undefined {
    const p = (position ?? '').trim().toLowerCase();
    if (p) {
      const matched = (batch.templates ?? []).find((t) =>
        (t.positions ?? []).some((x) => (x ?? '').trim().toLowerCase() === p),
      );
      if (matched?.template) return matched.template;
    }
    return batch.template;
  }

  /** FEATURE-094 — 1 giá trị position chỉ được gán vào tối đa 1 phôi phụ (BR-04). */
  private assertPositionsUnique(
    templates: { positions?: string[] }[],
  ): void {
    const seen = new Set<string>();
    for (const t of templates) {
      for (const raw of t.positions ?? []) {
        const key = (raw ?? '').trim().toLowerCase();
        if (!key) continue;
        if (seen.has(key)) {
          throw new BadRequestException(`Vị trí "${raw}" bị gán cho nhiều phôi`);
        }
        seen.add(key);
      }
    }
  }

  private buildRenderData(
    recipient: CrewCertRecipientDocument,
    batch: CrewCertBatchDocument,
  ): RenderData {
    const variables: Record<string, string> = {
      full_name: recipient.fullName,
      position: recipient.position,
      ...recipient.extraFields,
    };
    return {
      runner_name: recipient.fullName,
      event_name: batch.eventName,
      runner_photo_url: recipient.photoUrl ?? null,
      variables,
    };
  }

  private toRenderable(t: CrewTemplateInput): RenderableTemplate {
    return {
      canvas: {
        width: t.canvas.width,
        height: t.canvas.height,
        backgroundColor: t.canvas.backgroundColor ?? '#ffffff',
        backgroundImageUrl: t.canvas.backgroundImageUrl,
      },
      layers: t.layers,
      photo_area: t.photoArea ?? null,
      placeholder_photo_url: t.placeholderPhotoUrl ?? null,
      photo_behind_background: t.photoBehindBackground ?? false,
    };
  }

  private toBatchResponse(
    doc: CrewCertBatchDocument,
    recipientCount: number,
  ): BatchResponseDto {
    return {
      id: String(doc._id),
      slug: doc.slug,
      eventName: doc.eventName,
      active: doc.active,
      extraFields: doc.extraFields,
      recipientCount,
      template: (doc.template as BatchResponseDto['template']) ?? null,
      templates: (doc.templates as BatchResponseDto['templates']) ?? [],
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  private async findBatchOr404(id: string): Promise<CrewCertBatchDocument> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Không tìm thấy đợt GCN');
    const doc = await this.batchModel.findById(id).exec();
    if (!doc) throw new NotFoundException('Không tìm thấy đợt GCN');
    return doc;
  }

  private async invalidateBatchRenders(batchId: Types.ObjectId): Promise<void> {
    if (!this.redis) return;
    try {
      const ids = await this.recipientModel
        .find({ batchId })
        .select('_id')
        .lean()
        .exec();
      const keys = ids.map((r) => CREW_CACHE.RENDER_PREFIX + String(r._id));
      if (keys.length) await this.redis.del(...keys);
    } catch (err) {
      this.logger.warn(`Redis invalidate failed: ${String(err)}`);
    }
  }

  private async cacheGet(key: string): Promise<string | null> {
    if (!this.redis) return null;
    try {
      return await this.redis.get(key);
    } catch (err) {
      this.logger.warn(`Redis get failed: ${String(err)}`);
      return null;
    }
  }

  private async cacheSet(key: string, value: string, ttl: number): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.set(key, value, 'EX', ttl);
    } catch (err) {
      this.logger.warn(`Redis set failed: ${String(err)}`);
    }
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
}
