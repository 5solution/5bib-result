/**
 * F-024 contracts.acceptance.spec.ts
 *
 * Coverage:
 * - HP-06 actual = contract → diff = 0
 * - HP-07 actual > contract (phát sinh) → diff dương
 * - HP-08 actual < contract (giảm) → diff âm
 * - UP-02 acceptance for DRAFT contract → fail (must be ACTIVE)
 * - BR-CM-09 remainingBalance < 0 (provider owes client — flag warning)
 *
 * Pattern: pure calculation logic from contracts.service.upsertAcceptanceReport
 * extracted to a helper-style test (mocking model.findOne + .save).
 */
import { BadRequestException } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { ContractNumberService } from './contract-number.service';

describe('ContractsService — acceptance report (BR-CM-09)', () => {
  let svc: ContractsService;
  let mockModel: any;
  let mockPartnerModel: any;
  let mockRaceModel: any;
  let mockTemplateService: any;
  let mockDocGenerator: any;
  let numberService: ContractNumberService;

  const buildContract = (overrides: any = {}) => {
    const base = {
      _id: 'contract-123',
      status: 'ACTIVE',
      vatRate: 8,
      subtotal: 33_500_000,
      paymentTerms: { advanceAmount: 18_090_000 },
      acceptanceReport: undefined,
      save: jest.fn().mockResolvedValue(undefined),
      toObject: function () {
        return { ...this };
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
    numberService = new ContractNumberService(undefined);
    svc = new ContractsService(
      mockModel,
      mockPartnerModel,
      mockRaceModel,
      numberService,
      mockTemplateService,
      mockDocGenerator,
      undefined, // auditLog optional
      undefined, // redis optional
    );
  });

  describe('HP-06: actual = contract', () => {
    it('diff = 0, remainingBalance = total - advance', async () => {
      const c = buildContract();
      mockModel.findOne.mockResolvedValue(c);
      const result = await svc.upsertAcceptanceReport('contract-123', {
        actualValues: [
          { stt: 1, description: 'Chip', quantity: 1, unitPrice: 33_500_000 },
        ],
      });
      expect(result.acceptanceReport!.diffAmount).toBe(0);
      // 33,500,000 + 8% VAT = 36,180,000; advance 18,090,000 → remaining 18,090,000
      expect(result.acceptanceReport!.actualTotalWithVat).toBe(36_180_000);
      expect(result.acceptanceReport!.remainingBalance).toBe(18_090_000);
    });
  });

  describe('HP-07: actual > contract (phát sinh)', () => {
    it('diff is positive', async () => {
      const c = buildContract();
      mockModel.findOne.mockResolvedValue(c);
      const result = await svc.upsertAcceptanceReport('contract-123', {
        actualValues: [
          { stt: 1, description: 'Chip', quantity: 1, unitPrice: 40_000_000 },
        ],
      });
      expect(result.acceptanceReport!.diffAmount).toBe(40_000_000 - 33_500_000);
      expect(result.acceptanceReport!.diffAmount).toBeGreaterThan(0);
    });
  });

  describe('HP-08: actual < contract (giảm)', () => {
    it('diff is negative', async () => {
      const c = buildContract();
      mockModel.findOne.mockResolvedValue(c);
      const result = await svc.upsertAcceptanceReport('contract-123', {
        actualValues: [
          { stt: 1, description: 'Chip', quantity: 1, unitPrice: 25_000_000 },
        ],
      });
      expect(result.acceptanceReport!.diffAmount).toBeLessThan(0);
      expect(result.acceptanceReport!.diffAmount).toBe(25_000_000 - 33_500_000);
    });
  });

  describe('UP-02: contract must be ACTIVE', () => {
    it('rejects acceptance report for DRAFT contract', async () => {
      const c = buildContract({ status: 'DRAFT' });
      mockModel.findOne.mockResolvedValue(c);
      await expect(
        svc.upsertAcceptanceReport('contract-123', {
          actualValues: [],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects for COMPLETED contract', async () => {
      const c = buildContract({ status: 'COMPLETED' });
      mockModel.findOne.mockResolvedValue(c);
      await expect(
        svc.upsertAcceptanceReport('contract-123', {
          actualValues: [],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('BR-CM-09: remainingBalance < 0 (excess advance — provider owes client)', () => {
    it('flagged when actual << contract advance paid', async () => {
      // contract: subtotal 33.5M, advance 18.09M
      // actual: 5M only → with 8% VAT = 5.4M; remaining = 5.4M - 18.09M = NEGATIVE
      const c = buildContract();
      mockModel.findOne.mockResolvedValue(c);
      const result = await svc.upsertAcceptanceReport('contract-123', {
        actualValues: [
          { stt: 1, description: 'Reduced scope', quantity: 1, unitPrice: 5_000_000 },
        ],
      });
      expect(result.acceptanceReport!.remainingBalance).toBeLessThan(0);
    });
  });
});
