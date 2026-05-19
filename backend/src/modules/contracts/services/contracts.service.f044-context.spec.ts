/**
 * F-044 — Test buildRenderContext() flatten extension (BR-44-05/07).
 *
 * Validates:
 *   - TC-44-12: `remainingBalanceInWords` flatten key present when acceptanceReport exists
 *   - TC-44-13: Edge case — remainingBalance = 0 → "Không đồng"
 *   - TC-44-14: Edge case — acceptanceReport null → no flatten keys
 *   - TC-44-15: Asymmetric split (Adjustment #1) — remainingBalance ≠ advancePaid
 */

import { ContractsService } from './contracts.service';

describe('F-044 — ContractsService.buildRenderContext flatten extension', () => {
  let service: ContractsService;

  beforeEach(() => {
    const mockContractModel: unknown = jest.fn();
    const mockPartnerModel: unknown = jest.fn();
    const mockRaceModel: unknown = jest.fn();
    const mockNumberService = { generate: jest.fn() };
    const mockTemplateService = {
      getArticles: jest.fn().mockResolvedValue([]),
    };
    const mockDocGenerator = { renderAndUpload: jest.fn() };
    const mockAuditLog = { emit: jest.fn() };
    const mockRedis = undefined; // @Optional

    service = new ContractsService(
      mockContractModel as never,
      mockPartnerModel as never,
      mockRaceModel as never,
      mockNumberService as never,
      mockTemplateService as never,
      mockDocGenerator as never,
      mockAuditLog as never,
      mockRedis as never,
    );
  });

  describe('TC-44-12: remainingBalanceInWords resolves correctly when acceptanceReport present', () => {
    it('computes VN amount-in-words for non-zero remainingBalance', async () => {
      const mockContract: Record<string, unknown> = {
        _id: 'test-id',
        contractNumber: '10.05/2026/HDDV/CTTFA-5BIB-6',
        contractType: 'RACEKIT',
        signDate: new Date('2026-05-01'),
        provider: { entityName: 'Provider', taxId: '0110398986' },
        client: { entityName: 'Client', taxId: '0123456789' },
        raceName: 'Cát Tiên Trail Family Adventure',
        lineItems: [],
        revenueShare: { feePercentage: 0, feePerAthlete: 0, estimatedAthletes: 0 },
        subtotal: 33500000,
        vatRate: 8,
        vatAmount: 2680000,
        totalAmount: 36180000,
        paymentTerms: { advancePercentage: 50, advanceAmount: 18090000 },
        acceptanceReport: {
          reportDate: new Date('2026-06-20'),
          actualValues: [],
          actualSubtotal: 33500000,
          actualVatAmount: 2680000,
          actualTotalWithVat: 36180000,
          contractSubtotal: 33500000,
          diffAmount: 0,
          advancePaid: 18090000,
          remainingBalance: 18090000,
          verdict: 'ACCEPTED',
          status: 'FINALIZED',
        },
        paymentRequest: null,
        generatedDocuments: [],
      };

      const ctx = await service.buildRenderContext(
        mockContract as never,
        'ACCEPTANCE_REPORT',
      );

      expect(ctx).toHaveProperty('remainingBalanceInWords');
      expect(typeof ctx.remainingBalanceInWords).toBe('string');
      expect((ctx.remainingBalanceInWords as string).length).toBeGreaterThan(0);
      // Verify in-words sentence ends with "đồng" (per vndAmountInWords helper)
      expect(ctx.remainingBalanceInWords).toMatch(/đồng$/);
    });
  });

  describe('TC-44-13: Edge — remainingBalance = 0 → "Không đồng"', () => {
    it('returns "Không đồng" for zero remainingBalance', async () => {
      const mockContract: Record<string, unknown> = {
        _id: 'test-id',
        contractNumber: 'HD/2026/002',
        contractType: 'TIMING',
        signDate: new Date('2026-05-01'),
        provider: { entityName: 'Provider', taxId: '0110398986' },
        client: { entityName: 'Client', taxId: '0123456789' },
        raceName: 'Test Race',
        lineItems: [],
        revenueShare: { feePercentage: 0, feePerAthlete: 0, estimatedAthletes: 0 },
        subtotal: 10000000,
        vatRate: 8,
        vatAmount: 800000,
        totalAmount: 10800000,
        paymentTerms: { advancePercentage: 100, advanceAmount: 10800000 },
        acceptanceReport: {
          reportDate: new Date('2026-06-20'),
          actualValues: [],
          actualSubtotal: 10000000,
          actualVatAmount: 800000,
          actualTotalWithVat: 10800000,
          contractSubtotal: 10000000,
          diffAmount: 0,
          advancePaid: 10800000,
          remainingBalance: 0, // 100% paid upfront
          status: 'FINALIZED',
        },
        paymentRequest: null,
        generatedDocuments: [],
      };

      const ctx = await service.buildRenderContext(
        mockContract as never,
        'ACCEPTANCE_REPORT',
      );

      expect(ctx).toHaveProperty('remainingBalanceInWords', 'Không đồng');
    });
  });

  describe('TC-44-14: Edge — acceptanceReport null → no flatten keys', () => {
    it('does NOT expose remainingBalanceInWords when acceptanceReport missing', async () => {
      const mockContract: Record<string, unknown> = {
        _id: 'test-id',
        contractNumber: 'HD/2026/003',
        contractType: 'TIMING',
        signDate: new Date('2026-05-01'),
        provider: { entityName: 'Provider', taxId: '0110398986' },
        client: { entityName: 'Client', taxId: '0123456789' },
        raceName: 'Test Race',
        lineItems: [],
        revenueShare: { feePercentage: 0, feePerAthlete: 0, estimatedAthletes: 0 },
        subtotal: 10000000,
        vatRate: 8,
        vatAmount: 800000,
        totalAmount: 10800000,
        paymentTerms: { advancePercentage: 50, advanceAmount: 5400000 },
        acceptanceReport: null,
        paymentRequest: null,
        generatedDocuments: [],
      };

      const ctx = await service.buildRenderContext(
        mockContract as never,
        'CONTRACT',
      );

      expect(ctx).not.toHaveProperty('remainingBalanceInWords');
      // F-042 flatten keys also missing (preserve invariant BR-44-06)
      expect(ctx).not.toHaveProperty('actualSubtotal');
      expect(ctx).not.toHaveProperty('actualTotalWithVat');
    });
  });

  describe('TC-44-15: Asymmetric split — Adjustment #1 verification', () => {
    it('returns DIFFERENT in-words for advancePaid vs remainingBalance when split asymmetric', async () => {
      // Critical test for Adjustment #1: the typo bug in acceptance-racekit
      // template manifested only when advancePaid ≠ remainingBalance (50/50
      // split hid the bug numerically). This test exposes via flatten ctx.
      const mockContract: Record<string, unknown> = {
        _id: 'test-id',
        contractNumber: '10.05/2026/HDDV/CTTFA-5BIB-6',
        contractType: 'RACEKIT',
        signDate: new Date('2026-05-01'),
        provider: { entityName: 'Provider', taxId: '0110398986' },
        client: { entityName: 'Client', taxId: '0123456789' },
        raceName: 'Cát Tiên Trail',
        lineItems: [],
        revenueShare: { feePercentage: 0, feePerAthlete: 0, estimatedAthletes: 0 },
        subtotal: 92592593,
        vatRate: 8,
        vatAmount: 7407407,
        totalAmount: 100000000, // 100M total
        paymentTerms: { advancePercentage: 30, advanceAmount: 30000000 },
        acceptanceReport: {
          reportDate: new Date('2026-06-20'),
          actualValues: [],
          actualSubtotal: 92592593,
          actualVatAmount: 7407407,
          actualTotalWithVat: 100000000,
          contractSubtotal: 92592593,
          diffAmount: 0,
          advancePaid: 30000000, // 30% — tạm ứng
          remainingBalance: 70000000, // 70% — còn lại
          status: 'FINALIZED',
        },
        paymentRequest: null,
        generatedDocuments: [],
      };

      const ctx = await service.buildRenderContext(
        mockContract as never,
        'ACCEPTANCE_REPORT',
      );

      // Numeric flatten verifies asymmetric split
      expect(ctx).toHaveProperty('advancePaid', 30000000);
      expect(ctx).toHaveProperty('remainingBalance', 70000000);

      // In-words MUST differ — proves the bug class is now distinguishable
      const remainingInWords = ctx.remainingBalanceInWords as string;
      const actualTotalInWords = ctx.actualTotalWithVatInWords as string;
      expect(remainingInWords).toMatch(/đồng$/);
      expect(remainingInWords).not.toBe('Không đồng');
      // 70M in-words should differ from 100M in-words
      expect(remainingInWords).not.toBe(actualTotalInWords);
      // 70M VN words contains "Bảy mươi" or "Bảy chục" (number 70 prefix)
      expect(remainingInWords).toMatch(/Bảy mươi/);
    });
  });
});
