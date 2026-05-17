// Stub `src/config` (env loader) to avoid pulling real dotenv in unit tests.
jest.mock(
  'src/config',
  () => ({
    env: {
      s3: {
        bucket: 'test-bucket',
        region: 'ap-southeast-1',
        accessKeyId: 'test',
        secretAccessKey: 'test',
      },
    },
  }),
  { virtual: true },
);

// Stub @aws-sdk/client-s3 to avoid network init.
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
  PutObjectCommand: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReconciliationService } from './reconciliation.service';
import { Reconciliation } from './schemas/reconciliation.schema';
import { MerchantConfig } from '../merchant/schemas/merchant-config.schema';
import { ReconciliationCronLog } from './schemas/reconciliation-cron-log.schema';
import { Tenant } from '../merchant/entities/tenant.entity';
import { ReconciliationQueryService } from './services/reconciliation-query.service';
import { ReconciliationCalcService } from './services/reconciliation-calc.service';
import { ReconciliationPreflightService } from './services/reconciliation-preflight.service';
import { XlsxService } from './services/xlsx.service';
import { DocxService } from './services/docx.service';

describe('ReconciliationService — auditPeriodBoundary (BR-10)', () => {
  let service: ReconciliationService;
  let mockReconciliationModel: any;

  beforeEach(async () => {
    mockReconciliationModel = {
      find: jest.fn().mockReturnThis(),
      lean: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReconciliationService,
        { provide: ReconciliationQueryService, useValue: {} },
        { provide: ReconciliationCalcService, useValue: {} },
        { provide: ReconciliationPreflightService, useValue: {} },
        { provide: XlsxService, useValue: {} },
        { provide: DocxService, useValue: {} },
        { provide: getModelToken(Reconciliation.name), useValue: mockReconciliationModel },
        { provide: getModelToken(MerchantConfig.name), useValue: {} },
        { provide: getModelToken(ReconciliationCronLog.name), useValue: {} },
        { provide: getRepositoryToken(Tenant, 'platform'), useValue: {} },
      ],
    }).compile();

    service = module.get<ReconciliationService>(ReconciliationService);
  });

  it('returns total=0, items=[] when DB empty', async () => {
    mockReconciliationModel.lean.mockResolvedValue([]);
    const result = await service.auditPeriodBoundary();
    expect(result.total).toBe(0);
    expect(result.items).toEqual([]);
  });

  it('does NOT flag a single-month doc that snaps to month-boundary', async () => {
    mockReconciliationModel.lean.mockResolvedValue([
      {
        _id: 'rec1',
        tenant_id: 47,
        tenant_name: 'Vu Media',
        race_title: 'Race A',
        period_start: '2026-04-01',
        period_end: '2026-04-30',
      },
    ]);
    const result = await service.auditPeriodBoundary();
    expect(result.total).toBe(0);
  });

  it('does NOT flag a multi-month doc with correct boundary (Jan→Mar 2026)', async () => {
    mockReconciliationModel.lean.mockResolvedValue([
      {
        _id: 'rec2',
        tenant_id: 47,
        tenant_name: 'Vu Media',
        race_title: 'Q1 ticket sale',
        period_start: '2026-01-01',
        period_end: '2026-03-31',
      },
    ]);
    const result = await service.auditPeriodBoundary();
    expect(result.total).toBe(0);
  });

  it('FLAGS a doc with period_start lệch ngày 01 (e.g. 2025-12-31 thay vì 2026-01-01)', async () => {
    mockReconciliationModel.lean.mockResolvedValue([
      {
        _id: 'rec3',
        tenant_id: 47,
        tenant_name: 'Vu Media',
        race_title: 'Race A',
        period_start: '2025-12-31',
        period_end: '2026-01-30',
      },
    ]);
    const result = await service.auditPeriodBoundary();
    expect(result.total).toBe(1);
    expect(result.items[0].id).toBe('rec3');
    // stored=2025-12-31 vs expected=2025-12-01 → deviation = +30 days from start of month
    expect(result.items[0].deviation_start_days).toBe(30);
    expect(result.items[0].expected_period_start).toBe('2025-12-01');
  });

  it('FLAGS multi-month doc with period_end lệch (Jan→Mar but stored 2026-03-30)', async () => {
    mockReconciliationModel.lean.mockResolvedValue([
      {
        _id: 'rec4',
        tenant_id: 47,
        tenant_name: 'Vu Media',
        race_title: 'Q1',
        period_start: '2026-01-01',
        period_end: '2026-03-30',
      },
    ]);
    const result = await service.auditPeriodBoundary();
    expect(result.total).toBe(1);
    expect(result.items[0].deviation_end_days).toBe(-1);
    expect(result.items[0].expected_period_end).toBe('2026-03-31');
  });

  it('returns correct total when 5 docs OK + 2 docs lệch', async () => {
    mockReconciliationModel.lean.mockResolvedValue([
      { _id: 'a', tenant_id: 1, tenant_name: 'T', race_title: 'R', period_start: '2026-04-01', period_end: '2026-04-30' },
      { _id: 'b', tenant_id: 1, tenant_name: 'T', race_title: 'R', period_start: '2026-05-01', period_end: '2026-05-31' },
      { _id: 'c', tenant_id: 1, tenant_name: 'T', race_title: 'R', period_start: '2025-12-31', period_end: '2026-01-30' }, // both lệch
      { _id: 'd', tenant_id: 1, tenant_name: 'T', race_title: 'R', period_start: '2026-06-01', period_end: '2026-06-30' },
      { _id: 'e', tenant_id: 1, tenant_name: 'T', race_title: 'R', period_start: '2026-01-01', period_end: '2026-03-30' }, // end lệch
      { _id: 'f', tenant_id: 1, tenant_name: 'T', race_title: 'R', period_start: '2026-07-01', period_end: '2026-07-31' },
      { _id: 'g', tenant_id: 1, tenant_name: 'T', race_title: 'R', period_start: '2026-08-01', period_end: '2026-08-31' },
    ]);
    const result = await service.auditPeriodBoundary();
    expect(result.total).toBe(2);
    expect(result.items.map((i) => i.id).sort()).toEqual(['c', 'e']);
  });

  it('skips documents with malformed period strings (defensive)', async () => {
    mockReconciliationModel.lean.mockResolvedValue([
      { _id: 'bad1', tenant_id: 1, tenant_name: 'T', race_title: 'R', period_start: 'not-a-date', period_end: '2026-01-30' },
      { _id: 'bad2', tenant_id: 1, tenant_name: 'T', race_title: 'R', period_start: '', period_end: '' },
    ]);
    const result = await service.auditPeriodBoundary();
    expect(result.total).toBe(0);
  });
});

// ============================================================
// FEATURE-025 — deleteMany() bulk delete
// ============================================================

describe('ReconciliationService.deleteMany — FEATURE-025 bulk delete', () => {
  let service: ReconciliationService;
  let mockReconciliationModel: { deleteMany: jest.Mock; find: jest.Mock };
  let loggerWarnSpy: jest.SpyInstance;

  beforeEach(async () => {
    mockReconciliationModel = {
      deleteMany: jest.fn(),
      // F-040 — `.find()` called before deleteMany to capture (tenant,race)
      // pairs for cache flush. Default returns empty array (no flush fired).
      find: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReconciliationService,
        { provide: ReconciliationQueryService, useValue: {} },
        { provide: ReconciliationCalcService, useValue: {} },
        { provide: ReconciliationPreflightService, useValue: {} },
        { provide: XlsxService, useValue: {} },
        { provide: DocxService, useValue: {} },
        { provide: getModelToken(Reconciliation.name), useValue: mockReconciliationModel },
        { provide: getModelToken(MerchantConfig.name), useValue: {} },
        { provide: getModelToken(ReconciliationCronLog.name), useValue: {} },
        { provide: getRepositoryToken(Tenant, 'platform'), useValue: {} },
      ],
    }).compile();

    service = module.get<ReconciliationService>(ReconciliationService);

    // Spy on Logger.warn — Logger instance is private but jest spy on prototype works.
    // ReconciliationService uses `private readonly logger = new Logger(...)` instance.
    // Access through any-cast for testing purposes only (Hard Rule allowance: jest mock).
    const loggerInstance = (service as unknown as { logger: { warn: jest.Mock } }).logger;
    loggerWarnSpy = jest.spyOn(loggerInstance, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    loggerWarnSpy.mockRestore();
  });

  it('TC-DM-01 happy path: 5 IDs all exist → { deleted: 5, not_found: 0 }', async () => {
    mockReconciliationModel.deleteMany.mockResolvedValue({ deletedCount: 5 });
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const result = await service.deleteMany(ids);
    expect(result).toEqual({ deleted: 5, not_found: 0 });
    expect(mockReconciliationModel.deleteMany).toHaveBeenCalledWith({
      _id: { $in: ids },
    });
  });

  it('TC-DM-02 mixed: 3 exist + 2 missing → { deleted: 3, not_found: 2 }', async () => {
    mockReconciliationModel.deleteMany.mockResolvedValue({ deletedCount: 3 });
    const result = await service.deleteMany(['a', 'b', 'c', 'd', 'e']);
    expect(result).toEqual({ deleted: 3, not_found: 2 });
  });

  it('TC-DM-03 all missing: 0 exist (idempotent re-delete) → { deleted: 0, not_found: 5 }', async () => {
    mockReconciliationModel.deleteMany.mockResolvedValue({ deletedCount: 0 });
    const result = await service.deleteMany(['a', 'b', 'c', 'd', 'e']);
    expect(result).toEqual({ deleted: 0, not_found: 5 });
    // KHÔNG throw NotFoundException (khác delete() single)
  });

  it('TC-DM-04 boundary: 1 ID single delete → { deleted: 1, not_found: 0 }', async () => {
    mockReconciliationModel.deleteMany.mockResolvedValue({ deletedCount: 1 });
    const result = await service.deleteMany(['solo-id']);
    expect(result).toEqual({ deleted: 1, not_found: 0 });
  });

  it('TC-DM-05 audit: Logger.warn called with correct payload', async () => {
    mockReconciliationModel.deleteMany.mockResolvedValue({ deletedCount: 7 });
    await service.deleteMany(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']);
    expect(loggerWarnSpy).toHaveBeenCalledTimes(1);
    expect(loggerWarnSpy).toHaveBeenCalledWith('reconciliation_bulk_delete', {
      ids_count: 10,
      deleted_count: 7,
      not_found_count: 3,
    });
  });

  // ============================================================
  // QC adversarial tests — FEATURE-025
  // ============================================================

  it('TC-QC-DM-06 10x stability: 10 concurrent bulk delete calls không corrupt state', async () => {
    // Mỗi call mock trả "đúng deletedCount như nếu chỉ call mình nó".
    // Mongoose deleteMany atomic per-doc — concurrency safe.
    let deletedSoFar = 0;
    mockReconciliationModel.deleteMany.mockImplementation(async () => {
      // simulate atomic decrement — first call gets all, sau đó 0
      const result = deletedSoFar === 0 ? { deletedCount: 5 } : { deletedCount: 0 };
      deletedSoFar = 5;
      return result;
    });

    const promises = Array.from({ length: 10 }, () =>
      service.deleteMany(['id1', 'id2', 'id3', 'id4', 'id5']),
    );
    const results = await Promise.all(promises);

    // Exactly 1 winner (deleted=5, not_found=0), rest deleted=0, not_found=5
    const winners = results.filter((r) => r.deleted === 5);
    const losers = results.filter((r) => r.deleted === 0 && r.not_found === 5);
    expect(winners.length).toBe(1);
    expect(losers.length).toBe(9);
  });

  it('TC-QC-DM-07 idempotent: gọi lại cùng IDs sau khi đã xóa → trả deleted=0, not_found=N', async () => {
    // First call: deletes all
    mockReconciliationModel.deleteMany.mockResolvedValueOnce({ deletedCount: 3 });
    const first = await service.deleteMany(['a', 'b', 'c']);
    expect(first).toEqual({ deleted: 3, not_found: 0 });

    // Second call (same IDs, already deleted): deletedCount = 0
    mockReconciliationModel.deleteMany.mockResolvedValueOnce({ deletedCount: 0 });
    const second = await service.deleteMany(['a', 'b', 'c']);
    expect(second).toEqual({ deleted: 0, not_found: 3 });

    // Logger called twice
    expect(loggerWarnSpy).toHaveBeenCalledTimes(2);
  });

  it('TC-QC-DM-08 logger payload structure không leak recon content', async () => {
    mockReconciliationModel.deleteMany.mockResolvedValue({ deletedCount: 2 });
    await service.deleteMany([
      '69f9488ab13b71f5c5f970ec',
      '69fdbab606b3935acf24ccf6',
    ]);

    const [event, payload] = loggerWarnSpy.mock.calls[0];
    expect(event).toBe('reconciliation_bulk_delete');
    // Payload có ids_count NHƯNG KHÔNG có recon body / tenant_name / race_title
    expect(Object.keys(payload).sort()).toEqual([
      'deleted_count',
      'ids_count',
      'not_found_count',
    ]);
    // Verify payload không leak raw IDs
    expect(JSON.stringify(payload)).not.toContain('69f9488ab13b71f5c5f970ec');
    expect(JSON.stringify(payload)).not.toContain('69fdbab606b3935acf24ccf6');
  });
});
