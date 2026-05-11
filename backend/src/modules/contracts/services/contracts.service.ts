import {
  BadRequestException,
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
    TICKET_SALES: 'acceptance-timing.docx', // fallback
  },
  PAYMENT_REQUEST: {
    TIMING: 'payment-request.docx',
    RACEKIT: 'payment-request.docx',
    OPERATIONS: 'payment-request.docx',
    TICKET_SALES: 'payment-request.docx',
  },
};

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
    let raceFill: {
      raceName?: string;
      raceDate?: Date;
      raceLocation?: string;
    } = {};
    if (dto.raceId) {
      try {
        const race = await this.raceModel
          .findById(dto.raceId)
          .select('title startDate location')
          .lean();
        if (race) {
          raceFill = {
            raceName: dto.raceName ?? (race as any).title,
            raceDate: dto.raceDate
              ? new Date(dto.raceDate)
              : (race as any).startDate,
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

    // Compute line item amounts + totals
    const lineItems = (dto.lineItems ?? []).map((li) => ({
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
      raceDate: raceFill.raceDate ?? (dto.raceDate ? new Date(dto.raceDate) : undefined),
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
    if (TERMINAL_STATES.includes(current.status)) {
      throw new BadRequestException(
        'Không thể chỉnh sửa hợp đồng ở trạng thái terminal (COMPLETED/CANCELLED/...)',
      );
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
    const simpleFields: (keyof UpdateContractDto)[] = [
      'client',
      'raceId',
      'raceName',
      'raceLocation',
      'templateOverrides',
    ];
    for (const f of simpleFields) {
      if (dto[f] !== undefined) (current as any)[f] = dto[f];
    }
    if (dto.raceDate) current.raceDate = new Date(dto.raceDate);
    if (dto.signDate) current.signDate = new Date(dto.signDate);
    if (dto.effectiveDate) current.effectiveDate = new Date(dto.effectiveDate);
    if (dto.endDate) current.endDate = new Date(dto.endDate);

    await current.save();
    await this.invalidateContractsCache();
    await this.emitAudit('contract.update', current, 'admin');
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
      const clientShort =
        (c.client?.entityName ?? 'CLIENT')
          .split(/\s+/)
          .map((w) => w[0])
          .join('')
          .replace(/[^A-Za-z0-9]/g, '')
          .toUpperCase()
          .slice(0, 8) || 'CLIENT';
      const { contractNumber } = await this.numberService.generateNumber(
        signDate,
        clientShort,
        c.providerId,
      );
      c.contractNumber = contractNumber;
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
    return {
      contractNumber: contract.contractNumber ?? '',
      contractType: contract.contractType,
      documentType: contract.documentType,
      signDate,
      signDay: String(signDate.getDate()).padStart(2, '0'),
      signMonth: String(signDate.getMonth() + 1).padStart(2, '0'),
      signYear: signDate.getFullYear(),
      effectiveDate: contract.effectiveDate,
      endDate: contract.endDate,
      provider: contract.provider,
      client: contract.client,
      raceName: contract.raceName ?? '',
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
      paymentRequest: contract.paymentRequest ?? null,
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

    // Push entries vào generatedDocuments + tăng version
    const existingDocx = (c.generatedDocuments ?? []).filter(
      (g) => g.docType === docType && g.format === 'DOCX',
    );
    const existingPdf = (c.generatedDocuments ?? []).filter(
      (g) => g.docType === docType && g.format === 'PDF',
    );
    const now = new Date();
    c.generatedDocuments.push({
      docType,
      generatedAt: now,
      s3Key: result.docxKey,
      format: 'DOCX',
      version: existingDocx.length + 1,
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
    // L-03 QC fix: defense-in-depth filename whitelist — chỉ chấp nhận
    // safe-chars + extension docx/pdf. Strip path components, fallback 'document'.
    const rawName = s3Key.split('/').pop() ?? 'document';
    const filename = /^[\w.-]+\.(docx|pdf)$/i.test(rawName) ? rawName : 'document';
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
