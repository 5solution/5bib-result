/**
 * F-042 — Test buildRenderContext() flatten behavior.
 *
 * Validates BR-42-10:
 *   - acceptanceReport.* fields flattened to top-level when contract has acceptanceReport
 *   - No flattened keys when acceptanceReport null
 *   - Existing nested acceptanceReport object preserved (backward compat)
 */

import { ContractsService } from './contracts.service';

describe('F-042 — ContractsService.buildRenderContext flatten', () => {
  let service: ContractsService;
  // Mock dependencies to construct ContractsService without full DI setup
  // Mocks return shapes that allow buildRenderContext to run.

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
    const mockRedis = undefined;  // @Optional

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

  describe('TC-42-CTX-01: Contract WITH acceptanceReport → flatten keys present', () => {
    it('exposes actualSubtotal/actualVatAmount/actualTotalWithVat/advancePaid/remainingBalance at top level', async () => {
      const mockContract: Record<string, unknown> = {
        _id: 'test-id',
        contractNumber: 'HD/2026/001',
        contractType: 'TIMING',
        signDate: new Date('2026-05-01'),
        provider: { entityName: 'Provider', taxId: '0110398986' },
        client: { entityName: 'Client', taxId: '0123456789' },
        raceName: 'Test Race',
        lineItems: [],
        revenueShare: { feePercentage: 0, feePerAthlete: 0, estimatedAthletes: 0 },
        subtotal: 25870000,
        vatRate: 8,
        vatAmount: 2069600,
        totalAmount: 27939600,
        paymentTerms: { advancePercentage: 50, advanceAmount: 13969800 },
        acceptanceReport: {
          reportDate: new Date('2026-06-20'),
          actualValues: [],
          actualSubtotal: 25870000,
          actualVatAmount: 2069600,
          actualTotalWithVat: 27939600,
          contractSubtotal: 25870000,
          diffAmount: 0,
          advancePaid: 13969800,
          remainingBalance: 13969800,
          verdict: 'ACCEPTED',
          status: 'DRAFT',
        },
        paymentRequest: null,
        generatedDocuments: [],
      };

      const ctx = await service.buildRenderContext(
        mockContract as never,
        'ACCEPTANCE_REPORT',
      );

      // Verify flatten BR-42-10
      expect(ctx).toHaveProperty('actualSubtotal', 25870000);
      expect(ctx).toHaveProperty('actualVatAmount', 2069600);
      expect(ctx).toHaveProperty('actualTotalWithVat', 27939600);
      expect(ctx).toHaveProperty('advancePaid', 13969800);
      expect(ctx).toHaveProperty('remainingBalance', 13969800);
      expect(ctx).toHaveProperty('contractSubtotal', 25870000);
      expect(ctx).toHaveProperty('diffAmount', 0);
      expect(ctx).toHaveProperty('reportDay', '20');
      expect(ctx).toHaveProperty('reportMonth', '06');
      expect(ctx).toHaveProperty('reportYear', '2026');
      expect(typeof ctx.actualTotalWithVatInWords).toBe('string');
      expect((ctx.actualTotalWithVatInWords as string).length).toBeGreaterThan(0);

      // Verify backward compat: nested acceptanceReport object STILL present
      expect(ctx).toHaveProperty('acceptanceReport');
      expect((ctx.acceptanceReport as { actualSubtotal: number }).actualSubtotal).toBe(25870000);
    });
  });

  describe('TC-42-CTX-02: Contract WITHOUT acceptanceReport → no flatten keys', () => {
    it('does not expose flatten keys when acceptanceReport is null', async () => {
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
        paymentTerms: { advancePercentage: 50, advanceAmount: 5400000 },
        acceptanceReport: null,
        paymentRequest: null,
        generatedDocuments: [],
      };

      const ctx = await service.buildRenderContext(
        mockContract as never,
        'CONTRACT',
      );

      expect(ctx).not.toHaveProperty('actualSubtotal');
      expect(ctx).not.toHaveProperty('actualVatAmount');
      expect(ctx).not.toHaveProperty('actualTotalWithVat');
      expect(ctx).not.toHaveProperty('advancePaid');
      expect(ctx).not.toHaveProperty('remainingBalance');
      expect(ctx).toHaveProperty('acceptanceReport', null);
    });
  });

  describe('TC-42-CTX-03: Flatten preserves contract.subtotal/vatAmount/totalAmount', () => {
    it('contract-level fields unchanged after acceptanceReport flatten extension', async () => {
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
        subtotal: 25870000,
        vatRate: 8,
        vatAmount: 2069600,
        totalAmount: 27939600,
        paymentTerms: { advancePercentage: 50, advanceAmount: 13969800 },
        acceptanceReport: {
          reportDate: new Date('2026-06-20'),
          actualValues: [],
          actualSubtotal: 30000000,  // Differs from contract subtotal
          actualVatAmount: 2400000,
          actualTotalWithVat: 32400000,
          contractSubtotal: 25870000,
          diffAmount: 4130000,
          advancePaid: 13969800,
          remainingBalance: 18430200,
          status: 'DRAFT',
        },
        paymentRequest: null,
        generatedDocuments: [],
      };

      const ctx = await service.buildRenderContext(
        mockContract as never,
        'ACCEPTANCE_REPORT',
      );

      // Contract-level fields untouched
      expect(ctx).toHaveProperty('subtotal', 25870000);
      expect(ctx).toHaveProperty('vatAmount', 2069600);
      expect(ctx).toHaveProperty('totalAmount', 27939600);
      // Acceptance flatten fields differ
      expect(ctx).toHaveProperty('actualSubtotal', 30000000);
      expect(ctx).toHaveProperty('actualVatAmount', 2400000);
      expect(ctx).toHaveProperty('actualTotalWithVat', 32400000);
      expect(ctx).toHaveProperty('diffAmount', 4130000);
    });
  });
});
