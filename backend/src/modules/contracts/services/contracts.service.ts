import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type { Redis } from 'ioredis';
import { Model, Types } from 'mongoose';
import { createHash } from 'crypto';
import {
  Contract,
  ContractDocument,
  ContractStatus,
  ContractType,
  LineItem,
} from '../schemas/contract.schema';
import { Partner, PartnerDocument } from '../schemas/partner.schema';
import { CreateContractDto } from '../dto/create-contract.dto';
import { UpdateContractDto } from '../dto/update-contract.dto';
import { ContractFilterDto } from '../dto/contract-filter.dto';
import {
  CreateAcceptanceReportDto,
  CreatePaymentRequestDto,
} from '../dto/acceptance-payment.dto';
import { ContractNumberService } from './contract-number.service';
import { ContractTemplateService } from './contract-template.service';
import {
  DocumentGeneratorService,
  GeneratedDocType,
} from './document-generator.service';
import {
  DEFAULT_PROVIDER_BY_TYPE,
  getProviderEntity,
  ProviderId,
} from '../constants/provider-entities';
import { AuditLogService } from '../../audit/services/audit-log.service';
import { Race } from '../../races/schemas/race.schema';
import { vndAmountInWords } from '../utils/vn-num-to-words';
import { escapeRegex } from '../utils/escape-regex';
import {
  buildDocumentFilename,
  DocFormat,
} from '../utils/build-filename';

/**
 * M-03 QC fix — BR-CM-15: default average ticket price (VND) khi race
 * data không có. Admin có thể override per-contract qua revenueShare.avgTicketPrice.
 */
const DEFAULT_AVG_TICKET_PRICE = 200_000;

/**
 * M-02 QC fix — PRD Section 4 cache spec.
 * - `contracts:list:<filterHash>` TTL 60s
 * - `contracts:detail:<contractId>` TTL 300s
 */
const CACHE_LIST_TTL_SECONDS = 60;
const CACHE_DETAIL_TTL_SECONDS = 300;

/** Default late penalty per contract type (BR-CM-06). */
const DEFAULT_LATE_PENALTY: Record<
  ContractType,
  { rate: number; unit: 'PER_DAY' | 'PER_YEAR' }
> = {
  TIMING: { rate: 0.02, unit: 'PER_DAY' },
  RACEKIT: { rate: 0.02, unit: 'PER_DAY' },
  TICKET_SALES: { rate: 0.02, unit: 'PER_DAY' },
  OPERATIONS: { rate: 12, unit: 'PER_YEAR' },
};

const TERMINAL_STATES: ContractStatus[] = [
  'COMPLETED',
  'CANCELLED',
  'CONVERTED_TO_CONTRACT',
  'REJECTED',
];

/** Template file lookup by contract type + doc type (BR-CM-12 mapping). */
const TEMPLATE_FILE_MAP: Record<
  GeneratedDocType,
  Partial<Record<ContractType, string>>
> = {
  CONTRACT: {
    TIMING: 'contract-timing.docx',
    RACEKIT: 'contract-racekit.docx',
    OPERATIONS: 'contract-operations.docx',
    TICKET_SALES: 'contract-ticket-sales.docx',
  },
  QUOTATION: {
    TIMING: 'quotation.docx',
    RACEKIT: 'quotation.docx',
    OPERATIONS: 'quotation.docx',
    TICKET_SALES: 'quotation.docx',
  },
  ACCEPTANCE_REPORT: {
    TIMING: 'acceptance-timing.docx',
    RACEKIT: 'acceptance-racekit.docx',
    OPERATIONS: 'acceptance-operations.docx',
    // TICKET_SALES: KHÔNG có template — TICKET_SALES dùng quy trình đối soát
    // doanh thu theo kỳ (BR-CM-08), KHÔNG nghiệm thu hạng mục như fixed-price.
    // Block tại upsertAcceptanceReport + generateDocument bằng pre-check.
  },
  PAYMENT_REQUEST: {
    TIMING: 'payment-request.docx',
    RACEKIT: 'payment-request.docx',
    OPERATIONS: 'payment-request.docx',
    TICKET_SALES: 'payment-request.docx',
  },
};

/** Error message dùng chung khi block Acceptance Report cho TICKET_SALES. */
const TICKET_SALES_NO_ACCEPTANCE_MESSAGE =
  'TICKET_SALES không sử dụng Biên bản nghiệm thu — dùng quy trình đối soát thay thế';

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);

  constructor(
    @InjectModel(Contract.name) private model: Model<ContractDocument>,
    @InjectModel(Partner.name) private partnerModel: Model<PartnerDocument>,
    @InjectModel(Race.name) private raceModel: Model<any>,
    private readonly numberService: ContractNumberService,
    private readonly templateService: ContractTemplateService,
    private readonly docGenerator: DocumentGeneratorService,
    @Optional() private readonly auditLog?: AuditLogService,
    @Optional() @InjectRedis() private readonly redis?: Redis,
  ) {}

  // ────────────────────────────────────────────────────────────────
  // Cache invalidation (pattern from articles.service.ts)
  // ────────────────────────────────────────────────────────────────

  /** Flush all `contracts:*` keys via scanStream + pipeline DEL. Best-effort. */
  private async invalidateContractsCache(): Promise<void> {
    if (!this.redis) return;
    try {
      const stream = this.redis.scanStream({
        match: 'contracts:*',
        count: 200,
      });
      const pipeline = this.redis.pipeline();
      let count = 0;
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (keys: string[]) => {
          for (const k of keys) {
            // Don't flush sequence counter — it's permanent per-year
            if (!k.startsWith('contracts:sequence:')) {
              pipeline.del(k);
              count++;
            }
          }
        });
        stream.on('end', () => resolve());
        stream.on('error', (err) => reject(err));
      });
      if (count > 0) await pipeline.exec();
    } catch (err) {
      this.logger.warn(
        `[contracts] Cache invalidation failed: ${(err as Error).message}`,
      );
    }
  }

  /**
   * F-028 HIGH-01 QC carryover + F-038 BR-38-09 — flush BOTH
   * `pnl:dashboard:*` AND `pnl:contracts-list:*` (mọi filterHash).
   *
   * Khi link/unlink TICKET_SALES contract với MySQL race → revenue source
   * chuyển từ Estimated → Actual (hoặc ngược lại). Dashboard P&L Phase 2
   * + F-038 contracts list cùng aggregate revenue/profit qua nhiều contract
   * nên MỌI filterHash đều có thể stale. Clone pattern từ
   * `cost-items.service.ts#flushDashboardCache` + articles invalidation.
   * Best-effort — fail log warn, KHÔNG throw.
   */
  private async flushPnlDashboardCache(): Promise<void> {
    if (!this.redis) return;
    for (const pattern of ['pnl:dashboard:*', 'pnl:contracts-list:*']) {
      try {
        const stream = this.redis.scanStream({ match: pattern, count: 200 });
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
        this.logger.warn(
          `[contracts] flush ${pattern} fail: ${(err as Error).message}`,
        );
      }
    }
  }

  /** Emit audit log (best-effort). */
  private async emitAudit(
    action: string,
    contract: { _id: any; contractNumber?: string; contractType?: string },
    actorId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    if (!this.auditLog) return;
    await this.auditLog.emit({
      actor: { userId: actorId },
      action,
      entity: {
        type: 'contract',
        id: String(contract._id),
        displayName:
          contract.contractNumber ?? `${contract.contractType ?? 'CONTRACT'}`,
      },
      metadata,
    });
  }

  // ────────────────────────────────────────────────────────────────
  // BR-CM-04: Calculation helpers (PURE — no IO)
  // ────────────────────────────────────────────────────────────────

  /**
   * BR-CM-04: amount = quantity × unitPrice × (1 - discount/100)
   * Round to nearest VND (no fractional cents in VN currency).
   */
  static calcLineAmount(
    quantity: number,
    unitPrice: number,
    discount = 0,
  ): number {
    const factor = 1 - (discount || 0) / 100;
    return Math.round(quantity * unitPrice * factor);
  }

  /** BR-CM-04: subtotal/vat/total from line items. */
  static calcTotals(
    lineItems: Array<Pick<LineItem, 'amount' | 'quantity' | 'unitPrice' | 'discount'>>,
    vatRate: number,
  ) {
    const subtotal = lineItems.reduce(
      (sum, li) =>
        sum + (li.amount ?? ContractsService.calcLineAmount(li.quantity, li.unitPrice, li.discount)),
      0,
    );
    const vatAmount = Math.round((subtotal * vatRate) / 100);
    const totalAmount = subtotal + vatAmount;
    return { subtotal, vatAmount, totalAmount };
  }

  /**
   * BR-CM-15 (M-03 QC fix): Revenue-share estimated fee for TICKET_SALES contracts.
   *
   * Formula:
   *   estimatedFee = estimatedAthletes × feePerAthlete
   *                + estimatedAthletes × avgTicketPrice × feePercentage / 100
   *
   * Server-side compute snapshot so admin UI client-side value never diverges.
   * Rounded to nearest VND (no fractional currency).
   */
  static calcRevenueShareEstimatedFee(input: {
    estimatedAthletes?: number;
    feePerAthlete?: number;
    feePercentage?: number;
    avgTicketPrice?: number;
  }): number {
    const athletes = input.estimatedAthletes ?? 0;
    const perAthlete = input.feePerAthlete ?? 0;
    const pct = input.feePercentage ?? 0;
    const avgPrice = input.avgTicketPrice ?? DEFAULT_AVG_TICKET_PRICE;
    const flatPart = athletes * perAthlete;
    const pctPart = (athletes * avgPrice * pct) / 100;
    return Math.round(flatPart + pctPart);
  }

  /** Recompute payment terms (advance/remainder amounts) from totalAmount. */
  static calcPaymentTerms(totalAmount: number, advancePct = 50) {
    const advanceAmount = Math.round((totalAmount * advancePct) / 100);
    const remainderAmount = totalAmount - advanceAmount;
    return {
      advancePercentage: advancePct,
      advanceAmount,
      remainderPercentage: 100 - advancePct,
      remainderAmount,
    };
  }

  // ────────────────────────────────────────────────────────────────
  // CRUD
  // ────────────────────────────────────────────────────────────────

  async create(
    dto: CreateContractDto,
    createdBy?: string,
  ): Promise<ContractDocument> {
    const contractType = dto.contractType as ContractType;
    const providerId = (dto.providerId ||
      DEFAULT_PROVIDER_BY_TYPE[contractType] ||
      '5BIB') as ProviderId;
    const provider = getProviderEntity(providerId);
    const documentType = dto.documentType ?? 'CONTRACT';
    const vatRate = dto.vatRate ?? 8;

    // ─── Cross-module DI auto-fill (read-only) ───
    // BR-CM-10 US-06: nếu DTO có partnerId → đọc Partner, fill client info
    // (DTO client fields override partner data when both present)
    let clientInfo = dto.client;
    if (dto.partnerId && Types.ObjectId.isValid(dto.partnerId)) {
      const partner = await this.partnerModel
        .findOne({ _id: dto.partnerId, deletedAt: null })
        .lean();
      if (partner) {
        clientInfo = {
          entityName: dto.client?.entityName ?? partner.entityName,
          taxId: dto.client?.taxId ?? partner.taxId,
          address: dto.client?.address ?? partner.address,
          representative: dto.client?.representative ?? partner.representative,
          position: dto.client?.position ?? partner.position,
          bankAccount: dto.client?.bankAccount ?? partner.bankAccount,
          bankName: dto.client?.bankName ?? partner.bankName,
          phone: dto.client?.phone ?? partner.phone,
          email: dto.client?.email ?? partner.email,
        };
      }
    }

    // Race auto-fill (US-06)
    // F-024 race manual input: raceDate là free-format string. Khi pick race
    // từ DB → convert Date (startDate) → ISO string. Khi admin nhập thủ công
    // → lưu nguyên string (vd "06:00 ngày 15/06/2026 đến 12:00 ngày 16/06/2026").
    let raceFill: {
      raceName?: string;
      raceDate?: string;
      raceLocation?: string;
    } = {};
    if (dto.raceId) {
      try {
        const race = await this.raceModel
          .findById(dto.raceId)
          .select('title startDate location')
          .lean();
        if (race) {
          const fromDb = (race as any).startDate;
          raceFill = {
            raceName: dto.raceName ?? (race as any).title,
            raceDate:
              dto.raceDate ??
              (fromDb instanceof Date ? fromDb.toISOString() : fromDb ?? undefined),
            raceLocation: dto.raceLocation ?? (race as any).location,
          };
        }
      } catch (err) {
        this.logger.warn(
          `[contracts] Race auto-fill failed raceId=${dto.raceId}: ${
            (err as Error).message
          }`,
        );
      }
    }

    // F-024 UX-39 v3 Task 3 — Pre-fill từ template defaultLineItems khi
    // DTO không có lineItems hoặc empty. Admin có thể sửa per HĐ sau đó.
    let sourceLineItems = dto.lineItems ?? [];
    if (sourceLineItems.length === 0) {
      try {
        const defaults = await this.templateService.getLineItems(contractType);
        if (defaults && defaults.length > 0) {
          sourceLineItems = defaults.map((d, idx) => ({
            stt: idx + 1,
            description: d.description,
            unit: d.unit,
            quantity: d.quantity,
            unitPrice: d.unitPrice,
            discount: d.discount ?? 0,
            note: d.note ?? '',
            selected: true,
          }));
          this.logger.log(
            `[contracts] Pre-filled ${sourceLineItems.length} line items from template defaults for ${contractType}`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `[contracts] Pre-fill default line items failed: ${
            (err as Error).message
          }`,
        );
      }
    }

    // Compute line item amounts + totals
    const lineItems = sourceLineItems.map((li) => ({
      stt: li.stt,
      description: li.description,
      unit: li.unit ?? '',
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      discount: li.discount ?? 0,
      amount: ContractsService.calcLineAmount(
        li.quantity,
        li.unitPrice,
        li.discount,
      ),
      selected: li.selected ?? true,
      note: li.note ?? '',
      // F-028 Phase 3 — preserve catalog reference khi pick từ Service Catalog
      // picker. Optional → omit nếu line item nhập tay.
      ...((li as any).catalogItemId
        ? { catalogItemId: (li as any).catalogItemId }
        : {}),
      // FEATURE-033 — preserve quote-time estimated cost per unit. Default 0
      // backward compat. Bug-fix F-035 (branch fix/F-035-...): create + update
      // path missing field → cost silent drop on save → P&L sai.
      cost: (li as any).cost ?? 0,
    }));

    const totals = ContractsService.calcTotals(lineItems, vatRate);

    const advancePct =
      dto.paymentTerms?.advancePercentage ??
      (contractType === 'TICKET_SALES' ? 0 : 50);
    const paymentBase = ContractsService.calcPaymentTerms(
      totals.totalAmount,
      advancePct,
    );
    const defaultPenalty = DEFAULT_LATE_PENALTY[contractType];

    // M-03 QC fix: BR-CM-15 server-side compute estimatedFee snapshot
    // cho TICKET_SALES (revenue-share). Lưu cùng record để audit trail.
    let revenueShare = undefined;
    if (contractType === 'TICKET_SALES' && dto.revenueShare) {
      const avgTicketPrice =
        dto.revenueShare.avgTicketPrice && dto.revenueShare.avgTicketPrice > 0
          ? dto.revenueShare.avgTicketPrice
          : DEFAULT_AVG_TICKET_PRICE;
      const estimatedFee = ContractsService.calcRevenueShareEstimatedFee({
        estimatedAthletes: dto.revenueShare.estimatedAthletes,
        feePerAthlete: dto.revenueShare.feePerAthlete,
        feePercentage: dto.revenueShare.feePercentage,
        avgTicketPrice,
      });
      revenueShare = {
        feePercentage: dto.revenueShare.feePercentage,
        feePerAthlete: dto.revenueShare.feePerAthlete,
        estimatedAthletes: dto.revenueShare.estimatedAthletes,
        avgTicketPrice,
        estimatedFee,
      };
    }

    const created = await this.model.create({
      contractType,
      documentType,
      status: 'DRAFT',
      providerId,
      provider,
      partnerId: dto.partnerId
        ? new Types.ObjectId(dto.partnerId)
        : undefined,
      client: clientInfo,
      raceId: dto.raceId,
      raceName: raceFill.raceName ?? dto.raceName,
      raceDate: raceFill.raceDate ?? dto.raceDate,
      raceLocation: raceFill.raceLocation ?? dto.raceLocation,
      signDate: dto.signDate ? new Date(dto.signDate) : undefined,
      effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      lineItems,
      revenueShare,
      subtotal: totals.subtotal,
      vatRate,
      vatAmount: totals.vatAmount,
      totalAmount: totals.totalAmount,
      paymentTerms: {
        ...paymentBase,
        latePenaltyRate:
          dto.paymentTerms?.latePenaltyRate ?? defaultPenalty.rate,
        latePenaltyUnit:
          dto.paymentTerms?.latePenaltyUnit ?? defaultPenalty.unit,
        paymentDeadlineDays: dto.paymentTerms?.paymentDeadlineDays ?? 15,
      },
      templateOverrides: dto.templateOverrides ?? {},
      createdBy,
    });

    await this.invalidateContractsCache();
    await this.emitAudit('contract.create', created, createdBy ?? 'admin', {
      contractType,
      documentType,
      totalAmount: totals.totalAmount,
    });

    return created;
  }

  /** M-02 helper: stable md5(8 char) hash for filter cache key */
  private hashFilter(filter: ContractFilterDto): string {
    return createHash('md5')
      .update(JSON.stringify(filter ?? {}))
      .digest('hex')
      .slice(0, 8);
  }

  async findAll(filter: ContractFilterDto) {
    // M-02 QC fix: read-through cache `contracts:list:<hash>` TTL 60s
    const cacheKey = `contracts:list:${this.hashFilter(filter)}`;
    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch (err) {
        this.logger.warn(
          `[contracts] cache GET ${cacheKey} failed: ${(err as Error).message}`,
        );
      }
    }

    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const q: any = {};
    if (!filter.includeDeleted) q.deletedAt = null;
    if (filter.contractType) q.contractType = filter.contractType;
    if (filter.documentType) q.documentType = filter.documentType;
    if (filter.status) q.status = filter.status;
    if (filter.partnerId && Types.ObjectId.isValid(filter.partnerId)) {
      q.partnerId = new Types.ObjectId(filter.partnerId);
    }
    if (filter.raceId) q.raceId = filter.raceId;
    if (filter.search) {
      // M-01 QC fix: escape regex special chars to prevent DoS catastrophic backtracking
      const safeSearch = escapeRegex(filter.search);
      q.$or = [
        { contractNumber: { $regex: safeSearch, $options: 'i' } },
        { 'client.entityName': { $regex: safeSearch, $options: 'i' } },
        { raceName: { $regex: safeSearch, $options: 'i' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.model
        .find(q)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.model.countDocuments(q),
    ]);
    const result = {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };

    if (this.redis) {
      try {
        await this.redis.set(
          cacheKey,
          JSON.stringify(result),
          'EX',
          CACHE_LIST_TTL_SECONDS,
        );
      } catch (err) {
        this.logger.warn(
          `[contracts] cache SET ${cacheKey} failed: ${(err as Error).message}`,
        );
      }
    }
    return result;
  }

  async findOne(id: string): Promise<Contract> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid contract id');
    }
    // M-02 QC fix: read-through cache `contracts:detail:<id>` TTL 300s
    const cacheKey = `contracts:detail:${id}`;
    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) return JSON.parse(cached) as Contract;
      } catch (err) {
        this.logger.warn(
          `[contracts] cache GET ${cacheKey} failed: ${(err as Error).message}`,
        );
      }
    }
    const c = await this.model.findOne({ _id: id, deletedAt: null }).lean();
    if (!c) throw new NotFoundException('Contract not found');
    if (this.redis) {
      try {
        await this.redis.set(
          cacheKey,
          JSON.stringify(c),
          'EX',
          CACHE_DETAIL_TTL_SECONDS,
        );
      } catch (err) {
        this.logger.warn(
          `[contracts] cache SET ${cacheKey} failed: ${(err as Error).message}`,
        );
      }
    }
    return c as Contract;
  }

  async update(id: string, dto: UpdateContractDto): Promise<Contract> {
    const current = await this.model.findOne({ _id: id, deletedAt: null });
    if (!current) throw new NotFoundException('Contract not found');

    // F-028 Q3.A — `linkedTenantId` + `linkedMysqlRaceId` là **metadata** liên
    // kết MySQL platform, KHÔNG affect business amount. Cho phép edit anytime
    // (kể cả ACTIVE/COMPLETED) → tách path xử lý riêng vs DRAFT-only fields.
    const dtoKeys = Object.keys(dto);
    const isLinkOnlyUpdate =
      dtoKeys.length > 0 &&
      dtoKeys.every(
        (k) => k === 'linkedTenantId' || k === 'linkedMysqlRaceId',
      );

    // FEATURE-034 (Danny 2026-05-14 "tao muốn sửa được trong mọi trường hợp,
    // vì cơ bản thật ra cũng lắm chuyện phết"): UNLOCK edit cho mọi status
    // không chỉ DRAFT. Lý do: business reality — đối tác đôi khi yêu cầu sửa
    // line items/payment terms SAU khi đã sign HĐ. Trước F-034 admin phải
    // CANCEL HĐ rồi tạo HĐ mới (lằng nhằng, mất số HĐ continuity).
    //
    // Trade-off chấp nhận (Danny acknowledged):
    //   - HĐ ACTIVE đã sign → sửa = legal inconsistency với DOCX physical đã ký
    //     → admin tự regenerate DOCX + re-send đối tác sau khi sửa
    //   - HĐ COMPLETED đã có acceptance + payment → sửa line items KHÔNG
    //     auto-recompute acceptance numbers → admin tự xem có cần fix không
    //   - HĐ CANCELLED/REJECTED → low risk (đã end-of-life)
    //
    // Mitigation:
    //   1. Audit emit `contract.update.force` với status snapshot trước khi
    //      apply (track accountability — ai sửa, lúc nào, status gì)
    //   2. Frontend confirm dialog cảnh báo cho non-DRAFT trước khi mở edit
    //   3. Cache invalidate P&L + dashboard sau update (same as DRAFT path)
    const isCancelOnlyUpdate =
      dto.status === 'CANCELLED' && Object.keys(dto).length === 1;
    const isForceEdit =
      current.status !== 'DRAFT' &&
      !isCancelOnlyUpdate &&
      !isLinkOnlyUpdate;
    const previousStatus = current.status;

    // FEATURE-034 — Vẫn block status manipulation qua update (status changes
    // phải đi qua dedicated endpoints: activate / cancel / acceptQuotation /
    // rejectQuotation / convertToContract). Cancel-only single-field vẫn
    // hợp lệ (escape hatch). Mọi status khác = invalid.
    if (
      'status' in dto &&
      dto.status !== undefined &&
      dto.status !== 'CANCELLED' &&
      !isCancelOnlyUpdate
    ) {
      throw new BadRequestException(
        'Status transitions phải qua dedicated endpoints (activate/cancel/...) — KHÔNG sửa trực tiếp qua update',
      );
    }

    // Status-only cancel update — early exit.
    if (isCancelOnlyUpdate) {
      current.status = 'CANCELLED';
      await current.save();
      await this.invalidateContractsCache();
      await this.emitAudit('contract.cancel', current, 'admin');
      return current.toObject();
    }

    // F-028 — link/unlink MySQL platform (TICKET_SALES only validate).
    // Apply regardless of status (Q3.A).
    if (
      'linkedTenantId' in dto ||
      'linkedMysqlRaceId' in dto
    ) {
      if (current.contractType !== 'TICKET_SALES') {
        throw new BadRequestException(
          'Liên kết MySQL chỉ áp dụng cho hợp đồng TICKET_SALES',
        );
      }
      if ('linkedTenantId' in dto) {
        (current as any).linkedTenantId =
          dto.linkedTenantId === null ? undefined : dto.linkedTenantId;
      }
      if ('linkedMysqlRaceId' in dto) {
        (current as any).linkedMysqlRaceId =
          dto.linkedMysqlRaceId === null ? undefined : dto.linkedMysqlRaceId;
      }

      // Link-only fast path: persist + emit audit + invalidate P&L cache.
      if (isLinkOnlyUpdate) {
        await current.save();
        await this.invalidateContractsCache();
        // BR-PNL-09 — flush P&L cache cho contract này để revenue source
        // refresh ngay sau khi link. HIGH-01 QC carryover: ngoài key per-contract
        // còn phải scan + DEL `pnl:dashboard:*` (mọi filterHash) vì Phase 2
        // dashboard aggregate revenue qua nhiều contract → 1 contract đổi
        // Estimated↔Actual ảnh hưởng totalRevenue/byMonth/byType của filter
        // bất kỳ. Pattern: clone cost-items.service.ts flushDashboardCache().
        if (this.redis) {
          try {
            await this.redis.del(`pnl:contract:${String(current._id)}`);
            await this.redis.del(
              `pnl:ticket-sales-fee:${String(current._id)}`,
            );
          } catch (err) {
            this.logger.warn(
              `[contracts] flush P&L cache fail: ${(err as Error).message}`,
            );
          }
          await this.flushPnlDashboardCache();
        }
        await this.emitAudit(
          dto.linkedTenantId == null && dto.linkedMysqlRaceId == null
            ? 'contract.unlinkMysql'
            : 'contract.linkMysql',
          current,
          'admin',
          {
            linkedTenantId: (current as any).linkedTenantId ?? null,
            linkedMysqlRaceId: (current as any).linkedMysqlRaceId ?? null,
          },
        );
        return current.toObject();
      }
    }

    if (dto.lineItems) {
      const items = dto.lineItems.map((li) => ({
        stt: li.stt,
        description: li.description,
        unit: li.unit ?? '',
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        discount: li.discount ?? 0,
        amount: ContractsService.calcLineAmount(
          li.quantity,
          li.unitPrice,
          li.discount,
        ),
        selected: li.selected ?? true,
        note: li.note ?? '',
        // F-028 Phase 3 — preserve catalog reference khi pick từ Service Catalog
        // picker. Optional → omit nếu line item nhập tay.
        ...((li as any).catalogItemId
          ? { catalogItemId: (li as any).catalogItemId }
          : {}),
        // FEATURE-033 — preserve quote-time estimated cost per unit. F-035
        // fix: trước đó update path drop cost silent → admin nhập Giá vốn,
        // save xong field mất → P&L sai estimate.
        cost: (li as any).cost ?? 0,
      }));
      const vatRate = dto.vatRate ?? current.vatRate;
      const totals = ContractsService.calcTotals(items, vatRate);
      const advancePct =
        dto.paymentTerms?.advancePercentage ??
        current.paymentTerms.advancePercentage;
      const paymentBase = ContractsService.calcPaymentTerms(
        totals.totalAmount,
        advancePct,
      );
      Object.assign(current, {
        lineItems: items,
        vatRate,
        ...totals,
        paymentTerms: {
          ...current.paymentTerms,
          ...paymentBase,
          ...(dto.paymentTerms ?? {}),
        },
      });
    }

    // Apply other simple field updates
    // F-024 race manual input: raceDate là free-format string → lưu thẳng,
    // không qua new Date(). signDate/effectiveDate/endDate vẫn là Date.
    const simpleFields: (keyof UpdateContractDto)[] = [
      'client',
      'raceId',
      'raceName',
      'raceDate',
      'raceLocation',
      'templateOverrides',
    ];
    for (const f of simpleFields) {
      if (dto[f] !== undefined) (current as any)[f] = dto[f];
    }
    if (dto.signDate) current.signDate = new Date(dto.signDate);
    if (dto.effectiveDate) current.effectiveDate = new Date(dto.effectiveDate);
    if (dto.endDate) current.endDate = new Date(dto.endDate);

    // Handle revenueShare update (TICKET_SALES only).
    if (dto.revenueShare && current.contractType === 'TICKET_SALES') {
      const avgTicketPrice =
        dto.revenueShare.avgTicketPrice && dto.revenueShare.avgTicketPrice > 0
          ? dto.revenueShare.avgTicketPrice
          : DEFAULT_AVG_TICKET_PRICE;
      const estimatedFee = ContractsService.calcRevenueShareEstimatedFee({
        estimatedAthletes: dto.revenueShare.estimatedAthletes,
        feePerAthlete: dto.revenueShare.feePerAthlete,
        feePercentage: dto.revenueShare.feePercentage,
        avgTicketPrice,
      });
      current.revenueShare = {
        feePercentage: dto.revenueShare.feePercentage,
        feePerAthlete: dto.revenueShare.feePerAthlete,
        estimatedAthletes: dto.revenueShare.estimatedAthletes,
        avgTicketPrice,
        estimatedFee,
      } as any;
    }

    await current.save();
    await this.invalidateContractsCache();
    // FEATURE-034 — Force-edit audit: track ai sửa HĐ non-DRAFT lúc nào, status
    // gì, fields nào. Admin accountability cho legal mismatch post-sign.
    if (isForceEdit) {
      await this.emitAudit('contract.update.force', current, 'admin', {
        previousStatus,
        editedFields: Object.keys(dto),
      });
      this.logger.warn(
        `[contracts] FORCE-EDIT contract=${String(current._id)} ` +
          `previousStatus=${previousStatus} fields=${Object.keys(dto).join(',')}`,
      );
    } else {
      await this.emitAudit('contract.update', current, 'admin');
    }

    // FEATURE-034 — Flush P&L cache nếu force-edit ảnh hưởng revenue/cost
    // (line items hoặc revenueShare changed). Dashboard cache cũng flush
    // vì aggregation thay đổi.
    if (isForceEdit && this.redis) {
      try {
        await this.redis.del(`pnl:contract:${String(current._id)}`);
        await this.redis.del(`pnl:ticket-sales-fee:${String(current._id)}`);
        await this.flushPnlDashboardCache();
      } catch (err) {
        this.logger.warn(
          `[contracts] flush P&L cache fail post force-edit: ${(err as Error).message}`,
        );
      }
    }

    return current.toObject();
  }

  async remove(id: string, actorId = 'admin'): Promise<{ success: true }> {
    const result = await this.model.updateOne(
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date() } },
    );
    if (result.matchedCount === 0) {
      throw new NotFoundException('Contract not found');
    }
    await this.invalidateContractsCache();
    await this.emitAudit('contract.delete', { _id: id }, actorId);
    return { success: true };
  }

  // ────────────────────────────────────────────────────────────────
  // BR-CM-07: Lifecycle transitions
  // ────────────────────────────────────────────────────────────────

  /** DRAFT → ACTIVE. Generates contract number if missing. */
  async activate(id: string): Promise<Contract> {
    const c = await this.model.findOne({ _id: id, deletedAt: null });
    if (!c) throw new NotFoundException('Contract not found');
    if (c.documentType !== 'CONTRACT') {
      throw new BadRequestException('Only CONTRACT can be activated');
    }
    if (c.status === 'ACTIVE') {
      throw new BadRequestException('Contract already active');
    }
    if (c.status !== 'DRAFT') {
      throw new BadRequestException(
        `Cannot activate from status ${c.status} — only DRAFT can be activated`,
      );
    }
    if (!c.contractNumber) {
      const signDate = c.signDate ?? new Date();
      // FEATURE-066 BR-66-02: thay block acronym hand-built bằng partner.shortName
      // override (highest priority) → fallback stripCompanyPrefix(entityName).
      // Lookup Partner via c.partnerId để lấy shortName mới nhất (admin có thể
      // edit Partner.shortName sau khi tạo contract DRAFT — BR-66-10 forward-only).
      let partnerShortName: string | null | undefined;
      try {
        if (c.partnerId) {
          const partner = await this.partnerModel
            .findOne({ _id: c.partnerId, deletedAt: null }, { shortName: 1 })
            .lean();
          partnerShortName = partner?.shortName ?? null;
        }
      } catch (err) {
        // Defensive: log + fallback null (service tiếp tục bằng stripCompanyPrefix).
        this.logger.warn(
          `[contracts] lookup partner.shortName fail — fallback strip entity. ${
            (err as Error).message
          }`,
        );
        partnerShortName = null;
      }
      const entityName = c.client?.entityName ?? null;
      // F-024 BUG-002 fix — retry tối đa 5 lần nếu Redis sequence + seq
      // suffix vẫn collide với HĐ cũ trong DB (e.g. dev/test data residue).
      // Pre-check uniqueness via model.exists() khi available (production).
      // Trong jest unit tests mock model không expose .exists, skip pre-check
      // và rely trên seq suffix uniqueness (Redis INCR atomic đảm bảo).
      let attempts = 0;
      while (attempts < 5) {
        const { contractNumber } = await this.numberService.generateNumber({
          signDate,
          partnerShortName,
          entityName,
          providerId: c.providerId,
        });
        let collides = false;
        if (typeof (this.model as any).exists === 'function') {
          try {
            const found = await (this.model as any).exists({ contractNumber });
            collides = !!found;
          } catch {
            collides = false;
          }
        }
        if (!collides) {
          c.contractNumber = contractNumber;
          break;
        }
        this.logger.warn(
          `[contracts] contractNumber collision ${contractNumber} — retry ${
            attempts + 1
          }/5`,
        );
        attempts++;
      }
      if (!c.contractNumber) {
        throw new ConflictException(
          'Số HĐ bị trùng — vui lòng đổi tên viết tắt đối tác và thử lại',
        );
      }
    }
    c.status = 'ACTIVE';
    await c.save();
    await this.invalidateContractsCache();
    await this.emitAudit('contract.activate', c, 'admin', {
      contractNumber: c.contractNumber,
    });
    return c.toObject();
  }

  /**
   * F-024 BUG-001 fix — BR-CM-08: đối tác chấp nhận Quotation (DRAFT → ACCEPTED).
   * Chỉ Quotation status DRAFT mới accept được. Sau ACCEPTED có thể
   * convertQuotation → tạo HĐ DRAFT mới.
   */
  async acceptQuotation(id: string, actorId = 'admin'): Promise<Contract> {
    const q = await this.model.findOne({ _id: id, deletedAt: null });
    if (!q) throw new NotFoundException('Quotation not found');
    if (q.documentType !== 'QUOTATION') {
      throw new BadRequestException('Chỉ áp dụng cho QUOTATION');
    }
    if (q.status !== 'DRAFT') {
      throw new BadRequestException(
        `Chỉ DRAFT Quotation mới chấp nhận được — current status=${q.status}`,
      );
    }
    q.status = 'ACCEPTED';
    await q.save();
    await this.invalidateContractsCache();
    await this.emitAudit('quotation.accept', q, actorId);
    return q.toObject();
  }

  /**
   * F-024 BUG-001 fix — đối tác từ chối Quotation (DRAFT → REJECTED).
   * Terminal state — không thể uncoverged.
   */
  async rejectQuotation(
    id: string,
    actorId = 'admin',
    reason?: string,
  ): Promise<Contract> {
    const q = await this.model.findOne({ _id: id, deletedAt: null });
    if (!q) throw new NotFoundException('Quotation not found');
    if (q.documentType !== 'QUOTATION') {
      throw new BadRequestException('Chỉ áp dụng cho QUOTATION');
    }
    if (q.status !== 'DRAFT') {
      throw new BadRequestException(
        `Chỉ DRAFT Quotation mới từ chối được — current status=${q.status}`,
      );
    }
    q.status = 'REJECTED';
    await q.save();
    await this.invalidateContractsCache();
    await this.emitAudit('quotation.reject', q, actorId, { reason });
    return q.toObject();
  }

  /**
   * BR-CM-08: Quotation → Contract conversion.
   * Only ACCEPTED quotation can convert. Quotation status → CONVERTED_TO_CONTRACT.
   * New contract starts as DRAFT, copies all selected line items + partner info.
   */
  async convertQuotation(id: string, createdBy?: string): Promise<Contract> {
    const quotation = await this.model.findOne({
      _id: id,
      deletedAt: null,
    });
    if (!quotation) throw new NotFoundException('Quotation not found');
    if (quotation.documentType !== 'QUOTATION') {
      throw new BadRequestException('Source must be a QUOTATION');
    }
    if (quotation.status !== 'ACCEPTED') {
      throw new BadRequestException('Only ACCEPTED quotations can be converted');
    }

    const selectedItems = (quotation.lineItems ?? []).filter(
      (li) => li.selected !== false,
    );

    const totals = ContractsService.calcTotals(selectedItems, quotation.vatRate);
    const paymentBase = ContractsService.calcPaymentTerms(
      totals.totalAmount,
      quotation.paymentTerms.advancePercentage ?? 50,
    );

    const newContract = await this.model.create({
      contractType: quotation.contractType,
      documentType: 'CONTRACT',
      status: 'DRAFT',
      providerId: quotation.providerId,
      provider: quotation.provider,
      partnerId: quotation.partnerId,
      client: quotation.client,
      raceId: quotation.raceId,
      raceName: quotation.raceName,
      raceDate: quotation.raceDate,
      raceLocation: quotation.raceLocation,
      lineItems: selectedItems,
      revenueShare: quotation.revenueShare,
      subtotal: totals.subtotal,
      vatRate: quotation.vatRate,
      vatAmount: totals.vatAmount,
      totalAmount: totals.totalAmount,
      paymentTerms: {
        ...quotation.paymentTerms,
        ...paymentBase,
      },
      templateOverrides: quotation.templateOverrides,
      sourceQuotationId: quotation._id,
      createdBy,
    });

    quotation.status = 'CONVERTED_TO_CONTRACT';
    await quotation.save();

    await this.invalidateContractsCache();
    await this.emitAudit('contract.convertFromQuotation', newContract, createdBy ?? 'admin', {
      sourceQuotationId: String(quotation._id),
    });

    return newContract.toObject();
  }

  // ────────────────────────────────────────────────────────────────
  // BR-CM-09: Acceptance Report
  // ────────────────────────────────────────────────────────────────

  async upsertAcceptanceReport(
    id: string,
    dto: CreateAcceptanceReportDto,
  ): Promise<Contract> {
    const c = await this.model.findOne({ _id: id, deletedAt: null });
    if (!c) throw new NotFoundException('Contract not found');
    // F-024 Phase 3 finalize: TICKET_SALES dùng đối soát doanh thu (BR-CM-08),
    // KHÔNG dùng Biên bản nghiệm thu. Block ngay tại entry-point.
    if (c.contractType === 'TICKET_SALES') {
      throw new BadRequestException(TICKET_SALES_NO_ACCEPTANCE_MESSAGE);
    }
    if (c.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Contract must be ACTIVE to create acceptance report',
      );
    }
    if (c.acceptanceReport?.status === 'FINALIZED') {
      throw new BadRequestException(
        'Acceptance report đã FINALIZED — không thể chỉnh sửa',
      );
    }

    const actuals = (dto.actualValues ?? []).map((a) => ({
      stt: a.stt,
      description: a.description,
      unit: a.unit ?? '',
      quantity: a.quantity,
      unitPrice: a.unitPrice,
      amount: a.amount ?? Math.round(a.quantity * a.unitPrice),
    }));
    const actualSubtotal = actuals.reduce((s, a) => s + a.amount, 0);
    const actualVatAmount = Math.round((actualSubtotal * c.vatRate) / 100);
    const actualTotalWithVat = actualSubtotal + actualVatAmount;
    const advancePaid = dto.advancePaid ?? c.paymentTerms.advanceAmount ?? 0;
    const remainingBalance = actualTotalWithVat - advancePaid;
    const diffAmount = actualSubtotal - c.subtotal;

    c.acceptanceReport = {
      reportDate: dto.reportDate ? new Date(dto.reportDate) : new Date(),
      actualValues: actuals,
      actualSubtotal,
      actualVatAmount,
      actualTotalWithVat,
      contractSubtotal: c.subtotal,
      diffAmount,
      advancePaid,
      remainingBalance,
      verdict: dto.verdict ?? 'ACCEPTED',
      notes: dto.notes ?? '',
      status: c.acceptanceReport?.status ?? 'DRAFT',
      finalizedAt: c.acceptanceReport?.finalizedAt ?? null,
    } as any;
    await c.save();
    await this.invalidateContractsCache();
    await this.emitAudit('contract.acceptanceReportUpsert', c, 'admin', {
      diffAmount,
      remainingBalance,
    });
    return c.toObject();
  }

  async finalizeAcceptanceReport(id: string): Promise<Contract> {
    const c = await this.model.findOne({ _id: id, deletedAt: null });
    if (!c) throw new NotFoundException('Contract not found');
    // F-024 Phase 3 finalize: TICKET_SALES không có Acceptance Report.
    if (c.contractType === 'TICKET_SALES') {
      throw new BadRequestException(TICKET_SALES_NO_ACCEPTANCE_MESSAGE);
    }
    if (!c.acceptanceReport) {
      throw new BadRequestException('Acceptance report chưa tạo');
    }
    if (c.acceptanceReport.status === 'FINALIZED') {
      throw new BadRequestException('Acceptance report đã FINALIZED rồi');
    }
    c.acceptanceReport.status = 'FINALIZED';
    c.acceptanceReport.finalizedAt = new Date();
    await c.save();
    await this.invalidateContractsCache();
    await this.emitAudit('contract.acceptanceReportFinalize', c, 'admin');
    return c.toObject();
  }

  // ────────────────────────────────────────────────────────────────
  // Payment Request
  // ────────────────────────────────────────────────────────────────

  async upsertPaymentRequest(
    id: string,
    dto: CreatePaymentRequestDto,
  ): Promise<Contract> {
    const c = await this.model.findOne({ _id: id, deletedAt: null });
    if (!c) throw new NotFoundException('Contract not found');
    if (c.acceptanceReport?.status !== 'FINALIZED') {
      throw new BadRequestException(
        'Acceptance report phải FINALIZED trước khi tạo payment request',
      );
    }
    const requestDate = dto.requestDate ? new Date(dto.requestDate) : new Date();
    const deadlineDays = c.paymentTerms?.paymentDeadlineDays ?? 15;
    const paymentDeadline = new Date(
      requestDate.getTime() + deadlineDays * 24 * 60 * 60 * 1000,
    );
    c.paymentRequest = {
      requestDate,
      totalAmount: c.acceptanceReport.actualTotalWithVat,
      advancePaid: c.acceptanceReport.advancePaid,
      amountDue: c.acceptanceReport.remainingBalance,
      paymentDeadline,
      status: c.paymentRequest?.status ?? 'DRAFT',
      paidAt: c.paymentRequest?.paidAt ?? null,
      notes: dto.notes ?? '',
    } as any;
    await c.save();
    await this.invalidateContractsCache();
    await this.emitAudit('contract.paymentRequestUpsert', c, 'admin');
    return c.toObject();
  }

  async markPaymentPaid(id: string): Promise<Contract> {
    const c = await this.model.findOne({ _id: id, deletedAt: null });
    if (!c) throw new NotFoundException('Contract not found');
    if (!c.paymentRequest) {
      throw new BadRequestException('Payment request chưa tạo');
    }
    c.paymentRequest.status = 'PAID';
    c.paymentRequest.paidAt = new Date();
    c.status = 'COMPLETED';
    await c.save();
    await this.invalidateContractsCache();
    await this.emitAudit('contract.markPaid', c, 'admin', {
      totalAmount: c.paymentRequest.totalAmount,
    });
    return c.toObject();
  }

  // ────────────────────────────────────────────────────────────────
  // BR-CM-12: Document Generation
  // ────────────────────────────────────────────────────────────────

  /**
   * Build placeholder context cho docxtemplater từ contract data.
   * Reads articles từ ContractTemplateService (applies template overrides).
   * Spec: docs/F-024-placeholder-spec.md
   */
  async buildRenderContext(
    contract: Contract,
    docType: GeneratedDocType,
  ): Promise<Record<string, any>> {
    const articles = await this.templateService.getArticles(
      contract.contractType,
      contract.templateOverrides ?? {},
    );
    const signDate = contract.signDate ?? new Date();
    // F-024 BUG-003 fix — TICKET_SALES template đã có sẵn cụm "Giải chạy "
    // ở label "BÊN A: ...", nếu raceName cũng có prefix "Giải chạy" sẽ
    // render thành "Giải chạy Giải chạy XYZ". Strip leading variants.
    const stripGiaiChayPrefix = (name: string): string =>
      (name ?? '')
        .replace(/^\s*Giải\s+chạy\s+/i, '')
        .replace(/^\s*Race\s+/i, '')
        .trim();
    const raceName =
      contract.contractType === 'TICKET_SALES'
        ? stripGiaiChayPrefix(contract.raceName ?? '')
        : contract.raceName ?? '';
    return {
      contractNumber: contract.contractNumber ?? '',
      contractType: contract.contractType,
      documentType: contract.documentType,
      signDate,
      signDay: String(signDate.getDate()).padStart(2, '0'),
      signMonth: String(signDate.getMonth() + 1).padStart(2, '0'),
      // F-024 BUG-005 fix — year là 4-digit string nguyên raw (KHÔNG dùng
      // toLocaleString vi-VN vì sanitizeContext sẽ format `2026` thành
      // `2.026`). Pass string thì sanitizeContext giữ nguyên (không re-format).
      signYear: String(signDate.getFullYear()),
      effectiveDate: contract.effectiveDate,
      endDate: contract.endDate,
      provider: contract.provider,
      client: contract.client,
      raceName,
      raceDate: contract.raceDate,
      raceLocation: contract.raceLocation ?? '',
      lineItems: contract.lineItems ?? [],
      revenueShare: contract.revenueShare ?? {
        feePercentage: 0,
        feePerAthlete: 0,
        estimatedAthletes: 0,
      },
      ticketFeePercent: contract.revenueShare?.feePercentage ?? 0,
      subtotal: contract.subtotal,
      vatRate: contract.vatRate,
      vatAmount: contract.vatAmount,
      totalAmount: contract.totalAmount,
      // Phase 2B: VN số → chữ helper. Templates dùng {totalAmountInWords}
      // placeholder cho cụm "(Bằng chữ: ... đồng)".
      totalAmountInWords: vndAmountInWords(contract.totalAmount),
      paymentTerms: contract.paymentTerms,
      // Phase 2B: `articles` array có { key, title, body } để template
      // docxtemplater dùng loop `{#articles}{title}{body}{/articles}`.
      articles,
      acceptanceReport: contract.acceptanceReport ?? null,
      // F-042: Flatten acceptanceReport.* to top-level keys for docxtemplater
      // simple substitution. Templates use `{actualSubtotal}` NOT
      // `{acceptanceReport.actualSubtotal}` for cross-version docxtemplater
      // compat. sanitizeContext() RECURSES nested objects too, but flatten
      // is belt-and-suspenders + simpler template authoring.
      // Per BR-42-10 + Manager Adjustment plan F-042.
      ...(contract.acceptanceReport
        ? {
            actualSubtotal: contract.acceptanceReport.actualSubtotal,
            actualVatAmount: contract.acceptanceReport.actualVatAmount,
            actualTotalWithVat: contract.acceptanceReport.actualTotalWithVat,
            contractSubtotal: contract.acceptanceReport.contractSubtotal,
            diffAmount: contract.acceptanceReport.diffAmount,
            advancePaid: contract.acceptanceReport.advancePaid,
            remainingBalance: contract.acceptanceReport.remainingBalance,
            actualTotalWithVatInWords: vndAmountInWords(
              contract.acceptanceReport.actualTotalWithVat ?? 0,
            ),
            // F-044 BR-44-05: VN amount-in-words for `remainingBalance` —
            // template "Bằng chữ" sentences in `acceptance-*.docx` use this
            // placeholder for the "còn lại" amount (asymmetric advance/remaining
            // splits are properly rendered, unlike F-042 50/50 hidden bug).
            // vndAmountInWords(0) returns "Không đồng", null/undefined → ''.
            remainingBalanceInWords: vndAmountInWords(
              contract.acceptanceReport.remainingBalance ?? 0,
            ),
            reportDay: contract.acceptanceReport.reportDate
              ? String(
                  new Date(contract.acceptanceReport.reportDate).getDate(),
                ).padStart(2, '0')
              : '',
            reportMonth: contract.acceptanceReport.reportDate
              ? String(
                  new Date(contract.acceptanceReport.reportDate).getMonth() + 1,
                ).padStart(2, '0')
              : '',
            reportYear: contract.acceptanceReport.reportDate
              ? String(
                  new Date(contract.acceptanceReport.reportDate).getFullYear(),
                )
              : '',
          }
        : {}),
      paymentRequest: contract.paymentRequest
        ? {
            ...contract.paymentRequest,
            // VN số → chữ helper cho placeholder "(Bằng chữ: ... đồng)" trong DNTT.
            amountDueInWords: vndAmountInWords(
              contract.paymentRequest.amountDue ?? 0,
            ),
          }
        : null,
      // Payment Request — DNTT Mẫu cần requestDay/Month/Year tách rời để render
      // "Hà Nội, ngày X tháng Y năm Z" (không gộp vào 1 chuỗi format vì layout
      // DOCX khoảng cách giữa các từ là cố định).
      requestDay: contract.paymentRequest
        ? String(new Date(contract.paymentRequest.requestDate).getDate()).padStart(2, '0')
        : '',
      requestMonth: contract.paymentRequest
        ? String(new Date(contract.paymentRequest.requestDate).getMonth() + 1).padStart(2, '0')
        : '',
      requestYear: contract.paymentRequest
        ? String(new Date(contract.paymentRequest.requestDate).getFullYear())
        : '',
      generatedAt: new Date(),
    };
  }

  /**
   * Generate DOCX + PDF cho 1 contract + doc type.
   * Upload S3 → push entry vào contract.generatedDocuments → return signed URLs.
   */
  async generateDocument(
    contractId: string,
    docType: GeneratedDocType,
    actorId = 'admin',
  ): Promise<{ docxUrl: string; pdfUrl?: string; docxKey: string; pdfKey?: string }> {
    const c = await this.model.findOne({ _id: contractId, deletedAt: null });
    if (!c) throw new NotFoundException('Contract not found');

    // F-024 Phase 3 finalize: block ACCEPTANCE_REPORT cho TICKET_SALES
    // ở doc-gen layer (defense in depth — controller cũng đã filter UI).
    if (
      docType === 'ACCEPTANCE_REPORT' &&
      c.contractType === 'TICKET_SALES'
    ) {
      throw new BadRequestException(TICKET_SALES_NO_ACCEPTANCE_MESSAGE);
    }

    // F-024 BUG-006 fix — pre-condition checks per docType. Block sớm
    // tránh render template thiếu data → output blank fields.
    if (docType === 'ACCEPTANCE_REPORT' && !c.acceptanceReport) {
      throw new BadRequestException(
        'Chưa có Biên bản nghiệm thu — vui lòng tạo trước khi xuất tài liệu',
      );
    }
    if (docType === 'PAYMENT_REQUEST' && !c.paymentRequest) {
      throw new BadRequestException(
        'Chưa có Đề nghị thanh toán — vui lòng tạo trước khi xuất tài liệu',
      );
    }
    if (docType === 'CONTRACT' && c.status === 'DRAFT') {
      throw new BadRequestException(
        'HĐ ở trạng thái DRAFT — vui lòng kích hoạt (ACTIVE) trước khi xuất bản chính thức',
      );
    }

    const templateName =
      TEMPLATE_FILE_MAP[docType]?.[c.contractType as ContractType];
    if (!templateName) {
      throw new BadRequestException(
        `Không có template cho ${docType}/${c.contractType}`,
      );
    }

    const context = await this.buildRenderContext(c.toObject(), docType);
    const result = await this.docGenerator.renderAndUpload(
      templateName,
      context,
      String(c._id),
      docType,
    );

    // F-024 Phase 3 finalize: QUOTATION → XLSX (Excel), others → DOCX [+ PDF].
    // docGenerator.renderAndUpload trả về result.docxKey với extension
    // .xlsx khi docType === 'QUOTATION' (renderQuotationExcel branch).
    const isQuotationXlsx =
      docType === 'QUOTATION' && result.docxKey.endsWith('.xlsx');
    const primaryFormat: 'DOCX' | 'XLSX' = isQuotationXlsx ? 'XLSX' : 'DOCX';
    const existingPrimary = (c.generatedDocuments ?? []).filter(
      (g) => g.docType === docType && g.format === primaryFormat,
    );
    const existingPdf = (c.generatedDocuments ?? []).filter(
      (g) => g.docType === docType && g.format === 'PDF',
    );
    const now = new Date();
    c.generatedDocuments.push({
      docType,
      generatedAt: now,
      s3Key: result.docxKey,
      format: primaryFormat,
      version: existingPrimary.length + 1,
    } as any);
    if (result.pdfKey) {
      c.generatedDocuments.push({
        docType,
        generatedAt: now,
        s3Key: result.pdfKey,
        format: 'PDF',
        version: existingPdf.length + 1,
      } as any);
    }
    await c.save();
    await this.invalidateContractsCache();
    await this.emitAudit('contract.generateDocument', c, actorId, {
      docType,
      docxKey: result.docxKey,
      pdfKey: result.pdfKey,
    });

    return result;
  }

  /**
   * Download generated document by s3Key. Returns body + content type.
   * Security: only return file nếu s3Key thuộc về contract đang được request
   * (defense vs IDOR — attacker không thể guess random S3 key).
   */
  async downloadDocument(
    contractId: string,
    s3Key: string,
  ): Promise<{ body: Buffer; contentType: string; filename: string }> {
    const c = await this.model.findOne({ _id: contractId, deletedAt: null }).lean();
    if (!c) throw new NotFoundException('Contract not found');
    const doc = (c.generatedDocuments ?? []).find((g) => g.s3Key === s3Key);
    if (!doc) {
      throw new NotFoundException('Document not found in this contract');
    }
    const { body, contentType } = await this.docGenerator.getFileBody(s3Key);
    // F-024 — build human-readable filename:
    //   `[Provider] [Partner] - [DocType] [Service] - [DD.MM.YYYY].ext`
    // Thay vì raw S3 key `{docType}_{ts}.{ext}` (không meaningful).
    // RFC 5987 escape đã handle Unicode/space ở controller layer.
    // Extract extension từ s3Key — defense-in-depth: chỉ accept docx/pdf/xlsx.
    const rawExt = (s3Key.split('.').pop() ?? '').toLowerCase();
    const format: DocFormat = (
      rawExt === 'docx' || rawExt === 'pdf' || rawExt === 'xlsx'
        ? rawExt
        : 'docx'
    ) as DocFormat;
    const filename = buildDocumentFilename({
      providerId: c.providerId,
      partnerName: c.client?.entityName ?? '',
      docType: doc.docType as any,
      contractType: c.contractType,
      signDate: c.signDate ?? null,
      // Fallback: dùng generatedAt của document entry; nếu null → createdAt của contract.
      fallbackDate: doc.generatedAt ?? c.createdAt ?? null,
      format,
      // F-044 BR-44-12 — HYBRID Option C pattern inputs.
      // Khi cả contractNumber + raceName truthy, buildDocumentFilename trả về
      //   `[ContractNumber] - [RaceName] - [DocType].ext`
      // (Danny request 2026-05-19 — replace ID-based filename leak).
      // Else falls back to F-024 pattern (Quotation/Pre-contract flows).
      contractNumber: c.contractNumber ?? null,
      raceName: c.raceName ?? null,
    });
    return { body, contentType, filename };
  }

  /** Get signed URL for direct browser download. */
  async getDownloadUrl(contractId: string, s3Key: string): Promise<string> {
    const c = await this.model.findOne({ _id: contractId, deletedAt: null }).lean();
    if (!c) throw new NotFoundException('Contract not found');
    const doc = (c.generatedDocuments ?? []).find((g) => g.s3Key === s3Key);
    if (!doc) {
      throw new NotFoundException('Document not found in this contract');
    }
    return this.docGenerator.getSignedDownloadUrl(s3Key);
  }
}
