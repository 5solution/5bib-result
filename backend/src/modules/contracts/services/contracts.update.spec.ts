/**
 * F-024 Fix 1 + Fix 2 — manual race input + DRAFT-only edit.
 *
 * Coverage:
 * - update() DRAFT → success (all editable fields)
 * - update() ACTIVE → BadRequestException
 * - update() COMPLETED → BadRequestException
 * - update() raceDate free-format string (no Date coercion)
 * - update() CANCELLED-only status update OK from ACTIVE
 * - create() manual race (no raceId) saves raceName/raceDate/raceLocation
 * - create() raceDate free-format string preserves as-is
 */
import { BadRequestException } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { ContractNumberService } from './contract-number.service';

describe('ContractsService — F-024 update + manual race input', () => {
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
      provider: { entityName: '5BIB', taxId: '0100000000' },
      signDate: new Date('2026-05-11'),
      raceName: undefined,
      raceDate: undefined,
      raceLocation: undefined,
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
    mockTemplateService = {
      getArticles: jest.fn().mockResolvedValue([]),
      getLineItems: jest.fn().mockResolvedValue([]),
    };
    mockDocGenerator = {
      renderAndUpload: jest.fn(),
      getSignedDownloadUrl: jest.fn(),
      getFileBody: jest.fn(),
    };
    const mockRedis: any = {
      incr: jest.fn().mockResolvedValue(1),
      ttl: jest.fn().mockResolvedValue(-1),
      expire: jest.fn().mockResolvedValue(1),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
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
      undefined, // redis optional
    );
  });

  // ───────────────────────────────────────────────────────────────
  // Fix 2 — DRAFT-only edit
  // ───────────────────────────────────────────────────────────────

  describe('update() — Fix 2 DRAFT-only edit gate', () => {
    it('happy: DRAFT contract updates client.entityName + raceName', async () => {
      const c = buildContract({ status: 'DRAFT' });
      mockModel.findOne.mockResolvedValue(c);
      const result = await svc.update('contract-123', {
        client: { entityName: 'XYZ Sport' },
        raceName: 'New Race 2026',
      } as any);
      expect(result.client.entityName).toBe('XYZ Sport');
      expect(result.raceName).toBe('New Race 2026');
      expect(c.save).toHaveBeenCalled();
    });

    it('unhappy: ACTIVE contract update throws BadRequestException', async () => {
      const c = buildContract({ status: 'ACTIVE' });
      mockModel.findOne.mockResolvedValue(c);
      await expect(
        svc.update('contract-123', { raceName: 'Cannot Change' } as any),
      ).rejects.toThrow(BadRequestException);
      expect(c.save).not.toHaveBeenCalled();
    });

    it('unhappy: COMPLETED contract update throws BadRequestException', async () => {
      const c = buildContract({ status: 'COMPLETED' });
      mockModel.findOne.mockResolvedValue(c);
      await expect(
        svc.update('contract-123', { raceName: 'Cannot Change' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('unhappy: CANCELLED contract update throws BadRequestException', async () => {
      const c = buildContract({ status: 'CANCELLED' });
      mockModel.findOne.mockResolvedValue(c);
      await expect(
        svc.update('contract-123', { raceName: 'Cannot Change' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('escape hatch: ACTIVE → CANCELLED status-only update OK', async () => {
      const c = buildContract({ status: 'ACTIVE' });
      mockModel.findOne.mockResolvedValue(c);
      const result = await svc.update('contract-123', {
        status: 'CANCELLED',
      } as any);
      expect(result.status).toBe('CANCELLED');
      expect(c.save).toHaveBeenCalled();
    });

    it('does NOT allow status update other than CANCELLED', async () => {
      const c = buildContract({ status: 'ACTIVE' });
      mockModel.findOne.mockResolvedValue(c);
      // Pass status=COMPLETED + extra field → fails block ACTIVE non-cancel.
      await expect(
        svc.update('contract-123', {
          status: 'COMPLETED' as any,
          raceName: 'X',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // Fix 1 — manual race input
  // ───────────────────────────────────────────────────────────────

  describe('update() — Fix 1 manual race input', () => {
    it('saves raceDate as free-format string without Date coercion', async () => {
      const c = buildContract({ status: 'DRAFT' });
      mockModel.findOne.mockResolvedValue(c);
      const freeFormat =
        '06:00 ngày 15/06/2026 đến 12:00 ngày 16/06/2026';
      const result = await svc.update('contract-123', {
        raceName: 'Race nhiều ngày',
        raceDate: freeFormat,
        raceLocation: 'Đà Lạt',
      } as any);
      expect(result.raceName).toBe('Race nhiều ngày');
      // CRITICAL: raceDate phải là string nguyên gốc, KHÔNG bị new Date() → "Invalid Date"
      expect(result.raceDate).toBe(freeFormat);
      expect(typeof result.raceDate).toBe('string');
      expect(result.raceLocation).toBe('Đà Lạt');
    });

    it('saves raceDate ISO string from race picker as-is', async () => {
      const c = buildContract({ status: 'DRAFT' });
      mockModel.findOne.mockResolvedValue(c);
      const result = await svc.update('contract-123', {
        raceDate: '2026-06-15',
      } as any);
      expect(result.raceDate).toBe('2026-06-15');
    });
  });

  // ───────────────────────────────────────────────────────────────
  // F-028 — MySQL platform linking (linkedTenantId + linkedMysqlRaceId)
  // Q3.A: edit anytime kể cả ACTIVE/COMPLETED (metadata, không affect amount).
  // Q2: chỉ TICKET_SALES mới được set.
  // ───────────────────────────────────────────────────────────────

  describe('update() — F-028 MySQL linking', () => {
    it('happy: TICKET_SALES DRAFT — set linkedTenantId + linkedMysqlRaceId', async () => {
      const c = buildContract({ status: 'DRAFT', contractType: 'TICKET_SALES' });
      mockModel.findOne.mockResolvedValue(c);
      const result = await svc.update('contract-123', {
        linkedTenantId: 12,
        linkedMysqlRaceId: 148,
      } as any);
      expect((result as any).linkedTenantId).toBe(12);
      expect((result as any).linkedMysqlRaceId).toBe(148);
      expect(c.save).toHaveBeenCalled();
    });

    it('happy: TICKET_SALES ACTIVE — set link works (Q3.A edit anytime)', async () => {
      const c = buildContract({ status: 'ACTIVE', contractType: 'TICKET_SALES' });
      mockModel.findOne.mockResolvedValue(c);
      const result = await svc.update('contract-123', {
        linkedTenantId: 12,
        linkedMysqlRaceId: 148,
      } as any);
      expect((result as any).linkedTenantId).toBe(12);
      expect((result as any).linkedMysqlRaceId).toBe(148);
      expect(c.save).toHaveBeenCalled();
    });

    it('happy: TICKET_SALES COMPLETED — set link works (Q3.A terminal state OK)', async () => {
      const c = buildContract({
        status: 'COMPLETED',
        contractType: 'TICKET_SALES',
      });
      mockModel.findOne.mockResolvedValue(c);
      const result = await svc.update('contract-123', {
        linkedTenantId: 12,
        linkedMysqlRaceId: 148,
      } as any);
      expect((result as any).linkedTenantId).toBe(12);
      expect((result as any).linkedMysqlRaceId).toBe(148);
    });

    it('happy: unlink (null) khi đã linked', async () => {
      const c = buildContract({
        status: 'ACTIVE',
        contractType: 'TICKET_SALES',
        linkedTenantId: 12,
        linkedMysqlRaceId: 148,
      });
      mockModel.findOne.mockResolvedValue(c);
      const result = await svc.update('contract-123', {
        linkedTenantId: null,
        linkedMysqlRaceId: null,
      } as any);
      expect((result as any).linkedTenantId).toBeUndefined();
      expect((result as any).linkedMysqlRaceId).toBeUndefined();
    });

    it('unhappy: non-TICKET_SALES contract type → BadRequestException', async () => {
      const c = buildContract({ status: 'DRAFT', contractType: 'TIMING' });
      mockModel.findOne.mockResolvedValue(c);
      await expect(
        svc.update('contract-123', {
          linkedTenantId: 12,
          linkedMysqlRaceId: 148,
        } as any),
      ).rejects.toThrow(/TICKET_SALES/);
      expect(c.save).not.toHaveBeenCalled();
    });

    it('unhappy: RACEKIT contract → reject link', async () => {
      const c = buildContract({ status: 'DRAFT', contractType: 'RACEKIT' });
      mockModel.findOne.mockResolvedValue(c);
      await expect(
        svc.update('contract-123', { linkedTenantId: 12 } as any),
      ).rejects.toThrow(/TICKET_SALES/);
    });

    it('unhappy: OPERATIONS contract → reject link', async () => {
      const c = buildContract({ status: 'DRAFT', contractType: 'OPERATIONS' });
      mockModel.findOne.mockResolvedValue(c);
      await expect(
        svc.update('contract-123', {
          linkedMysqlRaceId: 148,
        } as any),
      ).rejects.toThrow(/TICKET_SALES/);
    });

    it('emits audit log "contract.linkMysql" khi set link', async () => {
      const auditMock = { emit: jest.fn().mockResolvedValue(undefined) };
      svc = new ContractsService(
        mockModel,
        mockPartnerModel,
        mockRaceModel,
        numberService,
        mockTemplateService,
        mockDocGenerator,
        auditMock as any,
        undefined,
      );
      const c = buildContract({
        status: 'ACTIVE',
        contractType: 'TICKET_SALES',
      });
      mockModel.findOne.mockResolvedValue(c);
      await svc.update('contract-123', {
        linkedTenantId: 12,
        linkedMysqlRaceId: 148,
      } as any);
      expect(auditMock.emit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'contract.linkMysql' }),
      );
    });

    it('emits audit log "contract.unlinkMysql" khi cả 2 null', async () => {
      const auditMock = { emit: jest.fn().mockResolvedValue(undefined) };
      svc = new ContractsService(
        mockModel,
        mockPartnerModel,
        mockRaceModel,
        numberService,
        mockTemplateService,
        mockDocGenerator,
        auditMock as any,
        undefined,
      );
      const c = buildContract({
        status: 'ACTIVE',
        contractType: 'TICKET_SALES',
        linkedTenantId: 12,
        linkedMysqlRaceId: 148,
      });
      mockModel.findOne.mockResolvedValue(c);
      await svc.update('contract-123', {
        linkedTenantId: null,
        linkedMysqlRaceId: null,
      } as any);
      expect(auditMock.emit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'contract.unlinkMysql' }),
      );
    });
  });

  describe('create() — Fix 1 manual race input', () => {
    it('happy: create contract without raceId saves raceName/raceDate/raceLocation from DTO', async () => {
      const created: any = {
        _id: 'new-contract',
        status: 'DRAFT',
        raceName: 'Manual Race',
        raceDate: '06:00 ngày 15/06/2026 đến 12:00 ngày 16/06/2026',
        raceLocation: 'Mộc Châu',
        toObject() {
          return { ...this };
        },
      };
      mockModel.create.mockResolvedValue(created);
      const result = await svc.create({
        contractType: 'OPERATIONS',
        documentType: 'CONTRACT',
        client: { entityName: 'Test Sport Co' },
        raceName: 'Manual Race',
        raceDate: '06:00 ngày 15/06/2026 đến 12:00 ngày 16/06/2026',
        raceLocation: 'Mộc Châu',
        lineItems: [
          {
            stt: 1,
            description: 'Vận hành',
            unit: 'gói',
            quantity: 1,
            unitPrice: 100_000_000,
          },
        ],
      } as any);
      expect(mockModel.create).toHaveBeenCalled();
      const callArg = mockModel.create.mock.calls[0][0];
      expect(callArg.raceId).toBeUndefined();
      expect(callArg.raceName).toBe('Manual Race');
      expect(callArg.raceDate).toBe(
        '06:00 ngày 15/06/2026 đến 12:00 ngày 16/06/2026',
      );
      expect(callArg.raceLocation).toBe('Mộc Châu');
      // raceDate KHÔNG được wrap trong new Date()
      expect(callArg.raceDate instanceof Date).toBe(false);
      expect(result._id).toBe('new-contract');
    });
  });
});
