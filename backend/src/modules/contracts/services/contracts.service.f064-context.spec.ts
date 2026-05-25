/**
 * F-064 — Test buildRenderContext() Phase 4 extension (BR-64-C1..C7).
 *
 * Validates the 8 new flat keys + fallback derive rules:
 *   - eventStartDate / eventEndDate (raceDate ISO parse fallback)
 *   - setupDate (raceDate - 3 days)
 *   - expoDate (raceDate - 1 day)
 *   - eventLocation (raceLocation fallback)
 *   - athleteCount (line items quantity sum match)
 *   - contractSignDate / acceptanceSignDate (separate per PAUSE-64-05 = B)
 *
 * Anti-leak rule: free-form raceDate → null setup/expo (NO hardcoded
 * fallback like "29/05/2026").
 */

import { ContractsService } from './contracts.service';

describe('F-064 — ContractsService.buildRenderContext Phase 4 extension', () => {
  let service: ContractsService;

  const mockContractModel: unknown = jest.fn();
  const mockPartnerModel: unknown = jest.fn();
  const mockRaceModel: unknown = jest.fn();
  const mockNumberService = { generate: jest.fn() };
  const mockTemplateService = {
    getArticles: jest.fn().mockResolvedValue([]),
  };
  const mockDocGenerator = { renderAndUpload: jest.fn() };
  const mockAuditLog = { emit: jest.fn() };

  beforeEach(() => {
    service = new ContractsService(
      mockContractModel as never,
      mockPartnerModel as never,
      mockRaceModel as never,
      mockNumberService as never,
      mockTemplateService as never,
      mockDocGenerator as never,
      mockAuditLog as never,
      undefined as never,
    );
  });

  const baseContract = (): Record<string, unknown> => ({
    _id: 'test-id',
    contractNumber: 'TEST/2026/F064',
    contractType: 'OPERATIONS',
    signDate: new Date('2026-06-01'),
    provider: { entityName: 'Provider', taxId: '0110398986' },
    client: { entityName: 'Client', taxId: '0123456789' },
    raceName: 'VCB KID RUN 2026',
    raceDate: '2026-05-31',
    raceLocation: 'Hồ Hoàn Kiếm',
    lineItems: [],
    subtotal: 0,
    vatRate: 8,
    vatAmount: 0,
    totalAmount: 0,
    paymentTerms: {},
    generatedDocuments: [],
  });

  describe('TC-64-CTX-01: 8 new keys present in render context', () => {
    it('emits eventStartDate, eventEndDate, setupDate, expoDate, eventLocation, athleteCount, contractSignDate, acceptanceSignDate', async () => {
      const ctx = await service.buildRenderContext(
        baseContract() as never,
        'CONTRACT',
      );
      expect(ctx).toHaveProperty('eventStartDate');
      expect(ctx).toHaveProperty('eventEndDate');
      expect(ctx).toHaveProperty('setupDate');
      expect(ctx).toHaveProperty('expoDate');
      expect(ctx).toHaveProperty('eventLocation');
      expect(ctx).toHaveProperty('athleteCount');
      expect(ctx).toHaveProperty('contractSignDate');
      expect(ctx).toHaveProperty('acceptanceSignDate');
    });
  });

  describe('TC-64-CTX-02: eventStartDate/eventEndDate fallback raceDate ISO', () => {
    it('uses raceDate parsed when admin omits explicit', async () => {
      const ctx = await service.buildRenderContext(
        baseContract() as never,
        'CONTRACT',
      );
      expect(ctx.eventStartDate).toBeInstanceOf(Date);
      expect((ctx.eventStartDate as Date).toISOString().slice(0, 10)).toBe(
        '2026-05-31',
      );
      expect(ctx.eventEndDate).toBeInstanceOf(Date);
    });

    it('uses explicit override when admin nhập', async () => {
      const c = baseContract();
      c.eventStartDate = new Date('2026-06-10');
      c.eventEndDate = new Date('2026-06-12');
      const ctx = await service.buildRenderContext(c as never, 'CONTRACT');
      expect((ctx.eventStartDate as Date).toISOString().slice(0, 10)).toBe(
        '2026-06-10',
      );
      expect((ctx.eventEndDate as Date).toISOString().slice(0, 10)).toBe(
        '2026-06-12',
      );
    });
  });

  describe('TC-64-CTX-03: setupDate/expoDate fallback derive (raceDate - N days)', () => {
    it('derives setup = raceDate - 3d, expo = raceDate - 1d for ISO raceDate', async () => {
      const ctx = await service.buildRenderContext(
        baseContract() as never,
        'CONTRACT',
      );
      // raceDate = 2026-05-31 → setup = 2026-05-28, expo = 2026-05-30
      expect((ctx.setupDate as Date).toISOString().slice(0, 10)).toBe(
        '2026-05-28',
      );
      expect((ctx.expoDate as Date).toISOString().slice(0, 10)).toBe(
        '2026-05-30',
      );
    });

    it('returns null for free-format raceDate (NO hardcoded fallback)', async () => {
      const c = baseContract();
      c.raceDate = '06:00 ngày 15/06/2026 đến 12:00 ngày 16/06/2026';
      const ctx = await service.buildRenderContext(c as never, 'CONTRACT');
      // Anti-leak: free-form → null setup/expo, NOT "29/05/2026" hardcoded.
      expect(ctx.setupDate).toBeNull();
      expect(ctx.expoDate).toBeNull();
      // eventStartDate falls back to null too (parseRaceDateIso rejects)
      expect(ctx.eventStartDate).toBeNull();
    });

    it('uses explicit setupDate/expoDate override', async () => {
      const c = baseContract();
      c.setupDate = new Date('2026-05-25');
      c.expoDate = new Date('2026-05-29');
      const ctx = await service.buildRenderContext(c as never, 'CONTRACT');
      expect((ctx.setupDate as Date).toISOString().slice(0, 10)).toBe(
        '2026-05-25',
      );
      expect((ctx.expoDate as Date).toISOString().slice(0, 10)).toBe(
        '2026-05-29',
      );
    });
  });

  describe('TC-64-CTX-04: eventLocation fallback raceLocation', () => {
    it('uses raceLocation when eventLocation empty', async () => {
      const ctx = await service.buildRenderContext(
        baseContract() as never,
        'CONTRACT',
      );
      expect(ctx.eventLocation).toBe('Hồ Hoàn Kiếm');
    });

    it('uses eventLocation override when admin nhập', async () => {
      const c = baseContract();
      c.eventLocation = 'Bãi biển Mỹ Khê';
      c.raceLocation = 'Đà Nẵng';
      const ctx = await service.buildRenderContext(c as never, 'CONTRACT');
      expect(ctx.eventLocation).toBe('Bãi biển Mỹ Khê');
    });

    it('returns empty when both empty', async () => {
      const c = baseContract();
      c.eventLocation = '';
      c.raceLocation = '';
      const ctx = await service.buildRenderContext(c as never, 'CONTRACT');
      expect(ctx.eventLocation).toBe('');
    });
  });

  describe('TC-64-CTX-05: athleteCount derive from lineItems', () => {
    it('sums quantity of athlete-keyword items', async () => {
      const c = baseContract();
      c.lineItems = [
        { description: 'Bib chính thức', quantity: 5000 },
        { description: 'Banner sponsor', quantity: 10 },
      ];
      const ctx = await service.buildRenderContext(c as never, 'CONTRACT');
      expect(ctx.athleteCount).toBe(5000);
    });

    it('uses expectedAthleteCount override', async () => {
      const c = baseContract();
      c.lineItems = [{ description: 'Bib chính thức', quantity: 5000 }];
      c.expectedAthleteCount = 4800;
      const ctx = await service.buildRenderContext(c as never, 'CONTRACT');
      expect(ctx.athleteCount).toBe(4800);
    });

    it('returns 0 for no matching items (NO hardcoded 3000 leak)', async () => {
      const c = baseContract();
      c.lineItems = [{ description: 'MC race day', quantity: 1 }];
      const ctx = await service.buildRenderContext(c as never, 'CONTRACT');
      expect(ctx.athleteCount).toBe(0);
    });
  });

  describe('TC-64-CTX-06: contractSignDate + acceptanceSignDate separate (PAUSE-64-05 = B)', () => {
    it('contractSignDate = signDate', async () => {
      const ctx = await service.buildRenderContext(
        baseContract() as never,
        'CONTRACT',
      );
      expect((ctx.contractSignDate as Date).toISOString().slice(0, 10)).toBe(
        '2026-06-01',
      );
    });

    it('acceptanceSignDate = acceptanceReport.reportDate (different from sign)', async () => {
      const c = baseContract();
      c.acceptanceReport = {
        reportDate: new Date('2026-06-08'),
        actualValues: [],
        actualSubtotal: 0,
        actualVatAmount: 0,
        actualTotalWithVat: 0,
        contractSubtotal: 0,
        diffAmount: 0,
        advancePaid: 0,
        remainingBalance: 0,
        verdict: 'ACCEPTED',
        status: 'FINALIZED',
      };
      const ctx = await service.buildRenderContext(
        c as never,
        'ACCEPTANCE_REPORT',
      );
      expect((ctx.acceptanceSignDate as Date).toISOString().slice(0, 10)).toBe(
        '2026-06-08',
      );
      // BBNT date different from contract sign date
      expect(ctx.contractSignDate).not.toEqual(ctx.acceptanceSignDate);
    });

    it('acceptanceSignDate null when no acceptanceReport', async () => {
      const ctx = await service.buildRenderContext(
        baseContract() as never,
        'CONTRACT',
      );
      expect(ctx.acceptanceSignDate).toBeNull();
    });
  });

  describe('TC-64-CTX-07: Backward compat — old contracts (6 fields undefined)', () => {
    it('renders fields without crash when all 6 new fields undefined', async () => {
      const c = baseContract();
      // 6 new fields explicitly undefined (simulates pre-F-064 contract)
      delete c.eventStartDate;
      delete c.eventEndDate;
      delete c.setupDate;
      delete c.expoDate;
      delete c.eventLocation;
      delete c.expectedAthleteCount;

      const ctx = await service.buildRenderContext(c as never, 'CONTRACT');
      // ISO raceDate still drives eventStart/End/setup/expo derive
      expect(ctx.eventStartDate).toBeInstanceOf(Date);
      expect(ctx.setupDate).toBeInstanceOf(Date);
      expect(ctx.expoDate).toBeInstanceOf(Date);
      // eventLocation falls back raceLocation
      expect(ctx.eventLocation).toBe('Hồ Hoàn Kiếm');
      // athleteCount = 0 (empty line items)
      expect(ctx.athleteCount).toBe(0);
    });
  });
});
