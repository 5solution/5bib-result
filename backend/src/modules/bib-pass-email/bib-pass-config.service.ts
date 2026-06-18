import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CertificateRenderService,
  RenderableTemplate,
  RenderData,
} from '../certificates/services/certificate-render.service';
import type {
  TemplateLayer,
  PhotoArea,
} from '../certificates/schemas/certificate-template.schema';
import {
  BibPassConfig,
  BibPassConfigDocument,
} from './schemas/bib-pass-config.schema';
import { BibPassSend, BibPassSendDocument } from './schemas/bib-pass-send.schema';
import { UpsertBibPassConfigDto } from './dto/bib-pass.dto';
import {
  BibPassConfigListResponseDto,
  BibPassConfigResponseDto,
  BibPassStatsDto,
} from './dto/bib-pass-response.dto';
import { BibPassScannerService, ConfirmedAthleteRow } from './bib-pass-scanner.service';

/**
 * FEATURE-091 — structural shape mà cả `BibPassTemplate` (schema) lẫn
 * `BibPassTemplateDto` (DTO) đều assignable (port F-090 CrewTemplateInput).
 */
export interface BibPassTemplateInput {
  canvas: {
    width: number;
    height: number;
    backgroundColor?: string;
    backgroundImageUrl?: string;
  };
  layers: TemplateLayer[];
  photoArea?: PhotoArea | null;
  placeholderPhotoUrl?: string | null;
  photoBehindBackground?: boolean;
}

@Injectable()
export class BibPassConfigService {
  private readonly logger = new Logger(BibPassConfigService.name);

  constructor(
    @InjectModel(BibPassConfig.name)
    private readonly configModel: Model<BibPassConfigDocument>,
    @InjectModel(BibPassSend.name)
    private readonly sendModel: Model<BibPassSendDocument>,
    private readonly renderService: CertificateRenderService,
    private readonly scanner: BibPassScannerService,
  ) {}

  // ─── CRUD ──────────────────────────────────────────────────────

  async listConfigs(): Promise<BibPassConfigListResponseDto> {
    const docs = await this.configModel.find().sort({ updatedAt: -1 }).lean().exec();
    const counts = await Promise.all(
      docs.map((d) =>
        this.sendModel.countDocuments({ raceId: d.raceId, status: 'sent' }).exec(),
      ),
    );
    return {
      items: docs.map((d, i) => ({
        raceId: d.raceId,
        raceName: d.raceName ?? '',
        enabled: d.enabled,
        hasTemplate: !!d.template,
        sentCount: counts[i],
        updatedAt: (d.updatedAt as Date).toISOString(),
      })),
      total: docs.length,
    };
  }

  async getConfig(raceId: number): Promise<BibPassConfigResponseDto> {
    const doc = await this.findOr404(raceId);
    return this.toResponse(doc);
  }

  /** Lấy config doc (internal — sender dùng). 404 nếu chưa cấu hình. */
  async getConfigDoc(raceId: number): Promise<BibPassConfigDocument> {
    return this.findOr404(raceId);
  }

  /** Upsert: tạo mới nếu chưa có config cho raceId, ngược lại cập nhật. */
  async upsertConfig(
    raceId: number,
    dto: UpsertBibPassConfigDto,
    userId: string,
  ): Promise<BibPassConfigResponseDto> {
    let doc = await this.configModel.findOne({ raceId }).exec();
    if (!doc) {
      doc = new this.configModel({ raceId, createdBy: userId });
    }
    if (dto.raceName !== undefined) doc.raceName = dto.raceName;
    if (dto.enabled !== undefined) doc.enabled = dto.enabled;
    if (dto.attachmentFilename !== undefined) {
      doc.attachmentFilename = dto.attachmentFilename;
    }
    if (dto.template !== undefined) {
      doc.template = dto.template as unknown as BibPassConfigDocument['template'];
    }
    if (dto.staticFields !== undefined) {
      doc.staticFields = {
        location: dto.staticFields.location ?? doc.staticFields?.location ?? '',
        raceDay: dto.staticFields.raceDay ?? doc.staticFields?.raceDay ?? '',
        distance: dto.staticFields.distance ?? doc.staticFields?.distance ?? '',
        passportPrefix:
          dto.staticFields.passportPrefix ?? doc.staticFields?.passportPrefix ?? '',
      };
    }
    if (dto.email !== undefined) {
      doc.email = {
        subject: dto.email.subject ?? doc.email?.subject ?? '[5BIB] Border Pass của bạn',
        bodyHtml: dto.email.bodyHtml ?? doc.email?.bodyHtml ?? '',
        fromName: dto.email.fromName ?? doc.email?.fromName ?? '5BIB',
      };
    }
    // BR-09 — bật enabled thì PHẢI có phôi + subject (không gửi email rỗng).
    if (doc.enabled) {
      if (!doc.template) {
        throw new BadRequestException('Phải cấu hình phôi trước khi bật gửi');
      }
      if (!doc.email?.subject?.trim()) {
        throw new BadRequestException('Phải có tiêu đề email trước khi bật gửi');
      }
    }
    await doc.save();
    return this.toResponse(doc);
  }

  /** raceId của các config đang bật (cron quét). */
  async listEnabledRaceIds(): Promise<number[]> {
    const docs = await this.configModel
      .find({ enabled: true, template: { $ne: null } })
      .select('raceId')
      .lean()
      .exec();
    return docs.map((d) => d.raceId);
  }

  async deleteConfig(raceId: number): Promise<void> {
    const doc = await this.findOr404(raceId);
    await this.configModel.deleteOne({ _id: doc._id }).exec();
    // KHÔNG xóa bib_pass_sends — giữ ledger idempotency (lịch sử gửi).
  }

  // ─── Preview render (admin, no mail) ───────────────────────────

  /**
   * Render PNG bằng phôi đã lưu HOẶC draft (live preview).
   *
   * Draft preview (admin đang sửa) KHÔNG yêu cầu config đã tồn tại — giải có
   * thể chưa cấu hình lần nào (upsert-on-save). draft mang theo raceName +
   * staticFields để preview phản ánh giá trị CHƯA lưu. Saved preview (không
   * draft) cần config — 404 nếu chưa có.
   */
  async renderPreview(
    raceId: number,
    draft?: {
      template?: BibPassTemplateInput;
      raceName?: string;
      staticFields?: Partial<BibPassConfig['staticFields']>;
    },
  ): Promise<Buffer> {
    const doc = await this.configModel.findOne({ raceId }).exec();
    const template =
      draft?.template ?? (doc?.template as BibPassTemplateInput | null) ?? null;
    if (!template) {
      if (!doc) throw new NotFoundException('Không tìm thấy cấu hình Border Pass');
      throw new BadRequestException('Chưa cấu hình phôi');
    }
    const sampleRow: ConfirmedAthleteRow = {
      athletes_id: 0,
      race_id: raceId,
      name: 'NGUYỄN THỊ HẬU',
      bib_number: '1234',
      email: null,
    };
    // Ưu tiên giá trị draft (chưa lưu) → fallback config đã lưu → rỗng.
    const configLike = {
      raceName: draft?.raceName ?? doc?.raceName ?? '',
      staticFields: {
        location: draft?.staticFields?.location ?? doc?.staticFields?.location ?? '',
        raceDay: draft?.staticFields?.raceDay ?? doc?.staticFields?.raceDay ?? '',
        distance: draft?.staticFields?.distance ?? doc?.staticFields?.distance ?? '',
        passportPrefix:
          draft?.staticFields?.passportPrefix ?? doc?.staticFields?.passportPrefix ?? '',
      },
    };
    return this.renderService.render(
      this.toRenderable(template),
      this.buildRenderData(sampleRow, configLike),
      { includePhoto: false },
    );
  }

  // ─── Stats + confirmed list ────────────────────────────────────

  async getStats(raceId: number): Promise<BibPassStatsDto> {
    const confirmed = await this.scanner.countConfirmed(raceId);
    const [sent, failed, skipped] = await Promise.all([
      this.sendModel.countDocuments({ raceId, status: 'sent' }).exec(),
      this.sendModel.countDocuments({ raceId, status: 'failed' }).exec(),
      this.sendModel.countDocuments({ raceId, status: 'skipped' }).exec(),
    ]);
    const processed = sent + failed + skipped;
    return {
      confirmed,
      sent,
      failed,
      skipped,
      pending: Math.max(0, confirmed - processed),
    };
  }

  /** Dropdown: giải có VĐV đã xác nhận + đã có config chưa. */
  async listRaceOptions(): Promise<
    Array<{ raceId: number; title: string | null; confirmedCount: number; configured: boolean }>
  > {
    const [races, configs] = await Promise.all([
      this.scanner.listRacesWithConfirmed(),
      this.configModel.find().select('raceId').lean().exec(),
    ]);
    const configured = new Set(configs.map((c) => c.raceId));
    return races.map((r) => ({
      raceId: r.raceId,
      title: r.title,
      confirmedCount: r.confirmedCount,
      configured: configured.has(r.raceId),
    }));
  }

  /** Trang VĐV đã xác nhận + trạng thái gửi (merge ledger), email ẩn 1 phần. */
  async listConfirmedAthletes(
    raceId: number,
    opts: { q?: string; page: number; pageSize: number },
  ): Promise<{
    items: Array<{
      athletesId: number;
      name: string | null;
      bib: string | null;
      emailMasked: string | null;
      hasEmail: boolean;
      sendStatus: string;
    }>;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { rows, total } = await this.scanner.listConfirmedPaged(raceId, opts);
    const ids = rows.map((r) => r.athletes_id);
    const ledger = ids.length
      ? await this.sendModel
          .find({ raceId, athletesId: { $in: ids } })
          .select('athletesId status')
          .lean()
          .exec()
      : [];
    const statusMap = new Map<number, string>(
      ledger.map((l) => [l.athletesId, l.status]),
    );
    return {
      items: rows.map((r) => ({
        athletesId: r.athletes_id,
        name: r.name,
        bib: r.bib_number,
        emailMasked: this.maskEmail(r.email),
        hasEmail: !!r.email,
        sendStatus: statusMap.get(r.athletes_id) ?? 'pending',
      })),
      total,
      page: opts.page,
      pageSize: opts.pageSize,
    };
  }

  private maskEmail(email: string | null): string | null {
    if (!email) return null;
    const [user, domain] = email.split('@');
    if (!domain) return '***';
    const head = user.slice(0, 2);
    return `${head}${'*'.repeat(Math.max(1, user.length - 2))}@${domain}`;
  }

  // ─── Render helpers (shared với sender) ────────────────────────

  /** Token map cho 1 VĐV (BR-03/06). passport_no = passportPrefix + bib. */
  buildRenderData(
    row: ConfirmedAthleteRow,
    config: Pick<BibPassConfig, 'raceName' | 'staticFields'>,
  ): RenderData {
    const name = row.name ?? '';
    const bib = row.bib_number ?? '';
    const sf = config.staticFields ?? ({} as BibPassConfig['staticFields']);
    const passportNo = `${sf?.passportPrefix ?? ''}${bib}`;
    const variables: Record<string, string> = {
      name,
      bib,
      event_name: config.raceName ?? '',
      location: sf?.location ?? '',
      race_day: sf?.raceDay ?? '',
      distance: sf?.distance ?? '',
      passport_no: passportNo,
    };
    return {
      runner_name: name,
      bib,
      event_name: config.raceName ?? '',
      distance: sf?.distance ?? '',
      runner_photo_url: null,
      variables,
    };
  }

  async renderForRow(
    config: BibPassConfigDocument,
    row: ConfirmedAthleteRow,
  ): Promise<Buffer> {
    if (!config.template) throw new BadRequestException('Chưa cấu hình phôi');
    return this.renderService.render(
      this.toRenderable(config.template as unknown as BibPassTemplateInput),
      this.buildRenderData(row, config),
      { includePhoto: false },
    );
  }

  toRenderable(t: BibPassTemplateInput): RenderableTemplate {
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

  // ─── Internal ──────────────────────────────────────────────────

  private async findOr404(raceId: number): Promise<BibPassConfigDocument> {
    if (!Number.isInteger(raceId) || raceId <= 0) {
      throw new NotFoundException('Không tìm thấy cấu hình');
    }
    const doc = await this.configModel.findOne({ raceId }).exec();
    if (!doc) throw new NotFoundException('Không tìm thấy cấu hình Border Pass');
    return doc;
  }

  private toResponse(doc: BibPassConfigDocument): BibPassConfigResponseDto {
    const o = typeof doc.toObject === 'function' ? doc.toObject() : (doc as unknown as BibPassConfig);
    return {
      id: String((o as { _id: unknown })._id),
      raceId: o.raceId,
      raceName: o.raceName ?? '',
      enabled: o.enabled,
      template: (o.template as Record<string, unknown> | null) ?? null,
      staticFields: {
        location: o.staticFields?.location ?? '',
        raceDay: o.staticFields?.raceDay ?? '',
        distance: o.staticFields?.distance ?? '',
        passportPrefix: o.staticFields?.passportPrefix ?? '',
      },
      email: {
        subject: o.email?.subject ?? '',
        bodyHtml: o.email?.bodyHtml ?? '',
        fromName: o.email?.fromName ?? '5BIB',
      },
      attachmentFilename: o.attachmentFilename ?? 'border-pass-{bib}.png',
      createdAt: (o.createdAt as Date).toISOString(),
      updatedAt: (o.updatedAt as Date).toISOString(),
    };
  }
}
