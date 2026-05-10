import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Contract,
  ContractDocument,
  ContractStatus,
  ContractType,
  LineItem,
} from '../schemas/contract.schema';
import { CreateContractDto } from '../dto/create-contract.dto';
import { UpdateContractDto } from '../dto/update-contract.dto';
import { ContractFilterDto } from '../dto/contract-filter.dto';
import {
  CreateAcceptanceReportDto,
  CreatePaymentRequestDto,
} from '../dto/acceptance-payment.dto';
import { ContractNumberService } from './contract-number.service';
import {
  DEFAULT_PROVIDER_BY_TYPE,
  getProviderEntity,
  ProviderId,
} from '../constants/provider-entities';

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

@Injectable()
export class ContractsService {
  constructor(
    @InjectModel(Contract.name) private model: Model<ContractDocument>,
    private readonly numberService: ContractNumberService,
  ) {}

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

    const created = await this.model.create({
      contractType,
      documentType,
      status: 'DRAFT',
      providerId,
      provider,
      partnerId: dto.partnerId
        ? new Types.ObjectId(dto.partnerId)
        : undefined,
      client: dto.client,
      raceId: dto.raceId,
      raceName: dto.raceName,
      raceDate: dto.raceDate ? new Date(dto.raceDate) : undefined,
      raceLocation: dto.raceLocation,
      signDate: dto.signDate ? new Date(dto.signDate) : undefined,
      effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      lineItems,
      revenueShare:
        contractType === 'TICKET_SALES' ? dto.revenueShare : undefined,
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
    return created;
  }

  async findAll(filter: ContractFilterDto) {
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
      q.$or = [
        { contractNumber: { $regex: filter.search, $options: 'i' } },
        { 'client.entityName': { $regex: filter.search, $options: 'i' } },
        { raceName: { $regex: filter.search, $options: 'i' } },
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
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(id: string): Promise<Contract> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid contract id');
    }
    const c = await this.model.findOne({ _id: id, deletedAt: null }).lean();
    if (!c) throw new NotFoundException('Contract not found');
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
    return current.toObject();
  }

  async remove(id: string): Promise<{ success: true }> {
    const result = await this.model.updateOne(
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date() } },
    );
    if (result.matchedCount === 0) {
      throw new NotFoundException('Contract not found');
    }
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
    return c.toObject();
  }
}
