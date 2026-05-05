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
