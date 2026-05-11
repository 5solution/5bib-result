/**
 * F-024 H-03 QC fix — contracts.service.spec.ts lifecycle direct test gap.
 *
 * Coverage adds direct tests cho 4 mutation method (logic CÓ check trong service
 * code nhưng spec cũ chỉ test pure calc):
 *
 * - activate()         — BR-CM-07 lifecycle DRAFT → ACTIVE
 *     happy: DRAFT → ACTIVE, set contractNumber + signDate
 *     unhappy: ACTIVE → ACTIVE throw BadRequestException
 *     unhappy: COMPLETED → ACTIVE throw BadRequestException
 *
 * - convertQuotation() — BR-CM-08 ACCEPTED quotation → CONVERTED_TO_CONTRACT
 *     happy: ACCEPTED quotation → new DRAFT contract w/ sourceQuotationId
 *     unhappy: DRAFT quotation throw BadRequestException
 *     unhappy: SENT quotation throw BadRequestException
 *
 * - markPaymentPaid()  — BR-CM-07 payment flow → COMPLETED
 *     happy: paymentRequest DRAFT → PAID, paidAt set, status → COMPLETED
 *     unhappy: no paymentRequest throw BadRequestException
 *
 * - remove()           — BR-CM-14 soft delete
 *     happy: sets deletedAt
 *     idempotent: 2nd remove on already-deleted throws NotFoundException
 *
 * Mock pattern: Mongoose Model.findOne + .save + .create. Redis + AuditService
 * passed as undefined (Optional).
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { ContractNumberService } from './contract-number.service';

describe('ContractsService — lifecycle (H-03 QC fix)', () => {
  let svc: ContractsService;
  let mockModel: any;
  let mockPartnerModel: any;
  let mockRaceModel: any;
  let mockTemplateService: any;
  let mockDocGenerator: any;
  let numberService: ContractNumberService;

  const buildContract = (overrides: any = {}) => {
    const base: any = {
      _id: 'contract-123',
      status: 'DRAFT',
      documentType: 'CONTRACT',
      contractType: 'TIMING',
      vatRate: 8,
      subtotal: 10_000_000,
      lineItems: [],
      paymentTerms: { advancePercentage: 50, advanceAmount: 5_000_000 },
      client: { entityName: 'ABC Sport' },
      providerId: '5BIB',
      signDate: new Date('2026-05-11'),
      contractNumber: undefined,
      acceptanceReport: undefined,
      paymentRequest: undefined,
      save: jest.fn().mockResolvedValue(undefined),
      toObject: function () {
        const { save, toObject, ...rest } = this;
        return rest;
      },
      ...overrides,
    };
    return base;
  };

  beforeEach(() => {
    mockModel = {
      findOne: jest.fn(),
      create: jest.fn(),
      countDocuments: jest.fn(),
      updateOne: jest.fn(),
    };
    mockPartnerModel = { findOne: jest.fn() };
    mockRaceModel = { findById: jest.fn() };
    mockTemplateService = { getArticles: jest.fn().mockResolvedValue([]) };
    mockDocGenerator = {
      renderAndUpload: jest.fn(),
      getSignedDownloadUrl: jest.fn(),
      getFileBody: jest.fn(),
    };
    // Stub Redis for numberService — sequence gen needs INCR
    const mockRedis: any = {
      incr: jest.fn().mockResolvedValue(1),
      ttl: jest.fn().mockResolvedValue(-1),
      expire: jest.fn().mockResolvedValue(1),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      scanStream: jest.fn().mockReturnValue({
        on: (event: string, cb: any) => {
          if (event === 'end') setTimeout(() => cb(), 0);
          return { on: () => ({}) };
        },
      }),
      pipeline: jest.fn().mockReturnValue({
        del: jest.fn(),
        exec: jest.fn().mockResolvedValue([]),
      }),
    };
    numberService = new ContractNumberService(mockRedis);
    svc = new ContractsService(
      mockModel,
      mockPartnerModel,
      mockRaceModel,
      numberService,
      mockTemplateService,
      mockDocGenerator,
      undefined, // auditLog optional
      undefined, // redis optional in service (read-through skipped)
    );
  });

  // ───────────────────────────────────────────────────────────────
  // activate() — BR-CM-07
  // ───────────────────────────────────────────────────────────────
  describe('activate() — BR-CM-07', () => {
    it('happy: DRAFT → ACTIVE, generates contractNumber if missing', async () => {
      const c = buildContract({ status: 'DRAFT' });
      mockModel.findOne.mockResolvedValue(c);
      const result = await svc.activate('contract-123');
      expect(result.status).toBe('ACTIVE');
      expect(result.contractNumber).toBeTruthy();
      // Contract number format BR-CM-02: DD.MM/YYYY/HDDV/CLIENT-PROVIDER
      expect(result.contractNumber).toMatch(/\d{2}\.\d{2}\/\d{4}\/HDDV\/[A-Z0-9]+-5BIB/);
      expect(c.save).toHaveBeenCalled();
    });

    it('keeps existing contractNumber on activate (no regen)', async () => {
      const c = buildContract({
        status: 'DRAFT',
        contractNumber: '11.05/2026/HDDV/ABC-5BIB',
      });
      mockModel.findOne.mockResolvedValue(c);
      const result = await svc.activate('contract-123');
      expect(result.contractNumber).toBe('11.05/2026/HDDV/ABC-5BIB');
    });

    it('unhappy: ACTIVE → ACTIVE throws BadRequestException', async () => {
      const c = buildContract({ status: 'ACTIVE' });
      mockModel.findOne.mockResolvedValue(c);
      await expect(svc.activate('contract-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('unhappy: COMPLETED → ACTIVE throws BadRequestException', async () => {
      const c = buildContract({ status: 'COMPLETED' });
      mockModel.findOne.mockResolvedValue(c);
      await expect(svc.activate('contract-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('unhappy: QUOTATION cannot activate (must be CONTRACT)', async () => {
      const c = buildContract({ documentType: 'QUOTATION', status: 'DRAFT' });
      mockModel.findOne.mockResolvedValue(c);
      await expect(svc.activate('contract-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('unhappy: not found throws NotFoundException', async () => {
      mockModel.findOne.mockResolvedValue(null);
      await expect(svc.activate('missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // convertQuotation() — BR-CM-08
  // ───────────────────────────────────────────────────────────────
  describe('convertQuotation() — BR-CM-08', () => {
    it('happy: ACCEPTED quotation → new DRAFT contract w/ sourceQuotationId', async () => {
      const quotation = buildContract({
        documentType: 'QUOTATION',
        status: 'ACCEPTED',
        lineItems: [
          {
            stt: 1,
            description: 'Chip',
            quantity: 1,
            unitPrice: 10_000_000,
            discount: 0,
            amount: 10_000_000,
            selected: true,
          },
        ],
        vatRate: 8,
        paymentTerms: { advancePercentage: 50 },
      });
      mockModel.findOne.mockResolvedValue(quotation);
      const created: any = {
        _id: 'new-contract',
        documentType: 'CONTRACT',
        status: 'DRAFT',
        sourceQuotationId: quotation._id,
        toObject() {
          return { ...this };
        },
      };
      mockModel.create.mockResolvedValue(created);
      const result = await svc.convertQuotation('quote-1');
      expect(result.documentType).toBe('CONTRACT');
      expect(result.status).toBe('DRAFT');
      expect(result.sourceQuotationId).toBe(quotation._id);
      // source quotation status should flip
      expect(quotation.status).toBe('CONVERTED_TO_CONTRACT');
      expect(quotation.save).toHaveBeenCalled();
    });

    it('unhappy: DRAFT quotation throws BadRequestException', async () => {
      const q = buildContract({ documentType: 'QUOTATION', status: 'DRAFT' });
      mockModel.findOne.mockResolvedValue(q);
      await expect(svc.convertQuotation('quote-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('unhappy: SENT quotation throws BadRequestException', async () => {
      const q = buildContract({ documentType: 'QUOTATION', status: 'SENT' });
      mockModel.findOne.mockResolvedValue(q);
      await expect(svc.convertQuotation('quote-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('unhappy: source is CONTRACT not QUOTATION throws BadRequestException', async () => {
      const c = buildContract({ documentType: 'CONTRACT', status: 'ACCEPTED' });
      mockModel.findOne.mockResolvedValue(c);
      await expect(svc.convertQuotation('contract-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('unhappy: quotation not found throws NotFoundException', async () => {
      mockModel.findOne.mockResolvedValue(null);
      await expect(svc.convertQuotation('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ───────────────────────────────────────────────────────────────
  // markPaymentPaid() — BR-CM-07 + payment flow
  // ───────────────────────────────────────────────────────────────
  describe('markPaymentPaid()', () => {
    it('happy: paymentRequest DRAFT → PAID, contract status → COMPLETED', async () => {
      const c = buildContract({
        status: 'ACTIVE',
        paymentRequest: {
          status: 'DRAFT',
          totalAmount: 10_800_000,
          paidAt: null,
        },
      });
      mockModel.findOne.mockResolvedValue(c);
      const result = await svc.markPaymentPaid('contract-123');
      expect(result.paymentRequest!.status).toBe('PAID');
      expect(result.paymentRequest!.paidAt).toBeInstanceOf(Date);
      expect(result.status).toBe('COMPLETED');
      expect(c.save).toHaveBeenCalled();
    });

    it('happy: paymentRequest SENT → PAID also OK', async () => {
      const c = buildContract({
        status: 'ACTIVE',
        paymentRequest: { status: 'SENT', totalAmount: 5_000_000 },
      });
      mockModel.findOne.mockResolvedValue(c);
      const result = await svc.markPaymentPaid('contract-123');
      expect(result.paymentRequest!.status).toBe('PAID');
    });

    it('unhappy: no paymentRequest throws BadRequestException', async () => {
      const c = buildContract({ status: 'ACTIVE', paymentRequest: undefined });
      mockModel.findOne.mockResolvedValue(c);
      await expect(svc.markPaymentPaid('contract-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('unhappy: contract not found throws NotFoundException', async () => {
      mockModel.findOne.mockResolvedValue(null);
      await expect(svc.markPaymentPaid('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ───────────────────────────────────────────────────────────────
  // remove() — BR-CM-14 soft delete
  // ───────────────────────────────────────────────────────────────
  describe('remove() — BR-CM-14 soft delete', () => {
    it('happy: sets deletedAt → success', async () => {
      mockModel.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
      const result = await svc.remove('contract-123');
      expect(result).toEqual({ success: true });
      expect(mockModel.updateOne).toHaveBeenCalledWith(
        { _id: 'contract-123', deletedAt: null },
        { $set: { deletedAt: expect.any(Date) } },
      );
    });

    it('idempotent: 2nd remove on already-deleted throws NotFoundException', async () => {
      // First remove succeeds
      mockModel.updateOne.mockResolvedValueOnce({
        matchedCount: 1,
        modifiedCount: 1,
      });
      await svc.remove('contract-123');

      // Second remove: query filter is { _id, deletedAt: null } → no match
      mockModel.updateOne.mockResolvedValueOnce({
        matchedCount: 0,
        modifiedCount: 0,
      });
      await expect(svc.remove('contract-123')).rejects.toThrow(NotFoundException);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // M-03 server-side estimatedFee compute (BR-CM-15)
  // ───────────────────────────────────────────────────────────────
  describe('calcRevenueShareEstimatedFee — BR-CM-15 (M-03)', () => {
    it('formula = athletes × perAthlete + athletes × avgTicket × pct/100', () => {
      // 1000 athletes × 5000 + 1000 × 200000 × 10/100 = 5,000,000 + 20,000,000 = 25,000,000
      const fee = ContractsService.calcRevenueShareEstimatedFee({
        estimatedAthletes: 1000,
        feePerAthlete: 5000,
        feePercentage: 10,
        avgTicketPrice: 200_000,
      });
      expect(fee).toBe(25_000_000);
    });

    it('uses DEFAULT_AVG_TICKET_PRICE 200,000 when avgTicketPrice omitted', () => {
      const fee = ContractsService.calcRevenueShareEstimatedFee({
        estimatedAthletes: 500,
        feePerAthlete: 0,
        feePercentage: 5,
      });
      // 500 × 200,000 × 5/100 = 5,000,000
      expect(fee).toBe(5_000_000);
    });

    it('zero athletes → zero fee', () => {
      const fee = ContractsService.calcRevenueShareEstimatedFee({
        estimatedAthletes: 0,
        feePerAthlete: 10_000,
        feePercentage: 50,
        avgTicketPrice: 500_000,
      });
      expect(fee).toBe(0);
    });

    it('flat-only (no percentage): athletes × perAthlete', () => {
      const fee = ContractsService.calcRevenueShareEstimatedFee({
        estimatedAthletes: 200,
        feePerAthlete: 25_000,
        feePercentage: 0,
        avgTicketPrice: 200_000,
      });
      expect(fee).toBe(5_000_000);
    });
  });
});
