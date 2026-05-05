// QC FEATURE-003 — Controller-level integration test focused on:
//   (a) ValidationPipe enforces PRD validators on new endpoints (TC-VAL-*)
//   (b) Route ordering correctness (audit/period-boundary BEFORE :id)
//   (c) 10x stability for audit + preflight/range
//
// Stubs `src/config` and `@aws-sdk/client-s3` so we don't pull external deps.

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

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
  PutObjectCommand: jest.fn(),
}));

// Bypass LogtoAdminGuard — auth is enforced upstream, not in scope of these tests.
jest.mock('../logto-auth', () => ({
  LogtoAdminGuard: class {
    canActivate() {
      return true;
    }
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { ReconciliationController } from './reconciliation.controller';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationQueryService } from './services/reconciliation-query.service';
import { ReconciliationPreflightService } from './services/reconciliation-preflight.service';
import { XlsxService } from './services/xlsx.service';
import { DocxService } from './services/docx.service';
import { BatchExportService } from './export/batch-export.service';

describe('ReconciliationController — FEATURE-003 validation + new endpoints', () => {
  let app: INestApplication;
  let mockReconciliationService: any;
  let mockPreflightService: any;

  beforeAll(async () => {
    mockReconciliationService = {
      auditPeriodBoundary: jest.fn().mockResolvedValue({ total: 0, items: [] }),
      batchCreate: jest.fn().mockResolvedValue({ created: 0, skipped: 0, failed: 0, results: [] }),
      preview: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({ _id: 'rec-id' }),
      getAllMerchantIds: jest.fn().mockResolvedValue([]),
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      findOne: jest.fn(),
      updateStatus: jest.fn(),
      delete: jest.fn(),
      regenerate: jest.fn(),
      getCronLogs: jest.fn().mockResolvedValue([]),
    };
    mockPreflightService = {
      run: jest.fn().mockResolvedValue({}),
      runRange: jest
        .fn()
        .mockResolvedValue({ overlap_warnings: [], warnings: [], can_create: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReconciliationController],
      providers: [
        { provide: ReconciliationService, useValue: mockReconciliationService },
        { provide: ReconciliationQueryService, useValue: { getRacesByTenant: jest.fn() } },
        { provide: ReconciliationPreflightService, useValue: mockPreflightService },
        { provide: XlsxService, useValue: {} },
        { provide: DocxService, useValue: {} },
        { provide: BatchExportService, useValue: { triggerByIds: jest.fn(), triggerByPeriod: jest.fn(), getJobStatus: jest.fn() } },
      ],
    }).compile();

    app = module.createNestApplication();
    // Match production global pipe config (main.ts).
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // -------------------------------------------------------------------------
  // POST /reconciliations/batch — TC-VAL-01..03 (period regex)
  // -------------------------------------------------------------------------
  describe('POST /reconciliations/batch — period validation', () => {
    it('TC-VAL-01: rejects period "2026-13" with 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/reconciliations/batch')
        .send({ period: '2026-13', merchant_ids: 'all' });
      expect(res.status).toBe(400);
    });

    it('TC-VAL-02: rejects period "26-04" with 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/reconciliations/batch')
        .send({ period: '26-04', merchant_ids: 'all' });
      expect(res.status).toBe(400);
    });

    it('TC-VAL-03: rejects period "2026-04-22" (with day) with 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/reconciliations/batch')
        .send({ period: '2026-04-22', merchant_ids: 'all' });
      expect(res.status).toBe(400);
    });

    it('rejects period < 2020 with 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/reconciliations/batch')
        .send({ period: '2019-12', merchant_ids: 'all' });
      expect(res.status).toBe(400);
    });

    it('accepts valid period "2026-04"', async () => {
      const res = await request(app.getHttpServer())
        .post('/reconciliations/batch')
        .send({ period: '2026-04', merchant_ids: 'all' });
      expect(res.status).toBe(201);
    });
  });

  // -------------------------------------------------------------------------
  // POST /reconciliations/preflight/batch — period validation parity
  // -------------------------------------------------------------------------
  describe('POST /reconciliations/preflight/batch — period validation', () => {
    it('rejects malformed period', async () => {
      const res = await request(app.getHttpServer())
        .post('/reconciliations/preflight/batch')
        .send({ period: 'bad', merchant_ids: 'all' });
      expect(res.status).toBe(400);
    });

    it('accepts valid YYYY-MM period', async () => {
      const res = await request(app.getHttpServer())
        .post('/reconciliations/preflight/batch')
        .send({ period: '2026-04', merchant_ids: [] });
      expect(res.status).toBe(201);
    });
  });

  // -------------------------------------------------------------------------
  // POST /reconciliations/preflight/range — TC-VAL-04..08, TC-VAL-11..12
  // -------------------------------------------------------------------------
  describe('POST /reconciliations/preflight/range — boundary + range validation', () => {
    const baseBody = {
      tenant_id: 47,
      mysql_race_id: 148,
    };

    it('TC-VAL-04: rejects period_start not on day 01 (e.g. 2026-04-22)', async () => {
      const res = await request(app.getHttpServer())
        .post('/reconciliations/preflight/range')
        .send({
          ...baseBody,
          period_start: '2026-04-22',
          period_end: '2026-04-30',
        });
      expect(res.status).toBe(400);
    });

    it('TC-VAL-05: rejects period_end not on lastDay (e.g. 2026-04-25)', async () => {
      const res = await request(app.getHttpServer())
        .post('/reconciliations/preflight/range')
        .send({
          ...baseBody,
          period_start: '2026-04-01',
          period_end: '2026-04-25',
        });
      expect(res.status).toBe(400);
    });

    it('TC-VAL-06: ACCEPTS multi-month range Mar→Apr 2026 (BR-01 mới)', async () => {
      const res = await request(app.getHttpServer())
        .post('/reconciliations/preflight/range')
        .send({
          ...baseBody,
          period_start: '2026-03-01',
          period_end: '2026-04-30',
        });
      expect(res.status).toBe(201);
    });

    it('TC-VAL-07: ACCEPTS leap-year Feb 2024-02-01 → 2024-02-29', async () => {
      const res = await request(app.getHttpServer())
        .post('/reconciliations/preflight/range')
        .send({
          ...baseBody,
          period_start: '2024-02-01',
          period_end: '2024-02-29',
        });
      expect(res.status).toBe(201);
    });

    it('TC-VAL-08: rejects 2026-02-29 (non-leap year)', async () => {
      const res = await request(app.getHttpServer())
        .post('/reconciliations/preflight/range')
        .send({
          ...baseBody,
          period_start: '2026-02-01',
          period_end: '2026-02-29',
        });
      expect(res.status).toBe(400);
    });

    it('TC-VAL-11: rejects range > 12 months (Jan 2025 → Feb 2026 = 14 months)', async () => {
      const res = await request(app.getHttpServer())
        .post('/reconciliations/preflight/range')
        .send({
          ...baseBody,
          period_start: '2025-01-01',
          period_end: '2026-02-28',
        });
      expect(res.status).toBe(400);
    });

    it('TC-VAL-12: rejects period_end < period_start', async () => {
      const res = await request(app.getHttpServer())
        .post('/reconciliations/preflight/range')
        .send({
          ...baseBody,
          period_start: '2026-05-01',
          period_end: '2026-03-31',
        });
      expect(res.status).toBe(400);
    });

    it('rejects forbidNonWhitelisted: extra unknown field', async () => {
      const res = await request(app.getHttpServer())
        .post('/reconciliations/preflight/range')
        .send({
          ...baseBody,
          period_start: '2026-04-01',
          period_end: '2026-04-30',
          attacker_field: '<script>alert(1)</script>',
        });
      expect(res.status).toBe(400);
    });

    it('happy path: valid range body returns 201 and calls service', async () => {
      const res = await request(app.getHttpServer())
        .post('/reconciliations/preflight/range')
        .send({
          ...baseBody,
          period_start: '2026-01-01',
          period_end: '2026-03-31',
        });
      expect(res.status).toBe(201);
      expect(mockPreflightService.runRange).toHaveBeenCalledWith({
        tenant_id: 47,
        mysql_race_id: 148,
        period_start: '2026-01-01',
        period_end: '2026-03-31',
      });
    });
  });

  // -------------------------------------------------------------------------
  // GET /reconciliations/audit/period-boundary
  // -------------------------------------------------------------------------
  describe('GET /reconciliations/audit/period-boundary', () => {
    it('returns 200 with audit shape', async () => {
      mockReconciliationService.auditPeriodBoundary.mockResolvedValueOnce({
        total: 2,
        items: [
          {
            id: 'rec-a',
            tenant_id: 1,
            tenant_name: 'T',
            race_title: 'R',
            period_start: '2025-12-31',
            period_end: '2026-01-30',
            expected_period_start: '2025-12-01',
            expected_period_end: '2025-12-31',
            deviation_start_days: 30,
            deviation_end_days: -1,
          },
          {
            id: 'rec-b',
            tenant_id: 2,
            tenant_name: 'T2',
            race_title: 'R2',
            period_start: '2026-01-01',
            period_end: '2026-03-30',
            expected_period_start: '2026-01-01',
            expected_period_end: '2026-03-31',
            deviation_start_days: 0,
            deviation_end_days: -1,
          },
        ],
      });
      const res = await request(app.getHttpServer())
        .get('/reconciliations/audit/period-boundary');
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
      expect(res.body.items).toHaveLength(2);
    });

    it('route resolves "audit/period-boundary" — does NOT match :id route', async () => {
      // If routing was wrong, controller would try to call findOne('audit') instead.
      mockReconciliationService.auditPeriodBoundary.mockResolvedValueOnce({ total: 0, items: [] });
      mockReconciliationService.findOne.mockRejectedValue(new Error('should not be called'));
      const res = await request(app.getHttpServer())
        .get('/reconciliations/audit/period-boundary');
      expect(res.status).toBe(200);
      expect(mockReconciliationService.auditPeriodBoundary).toHaveBeenCalled();
      expect(mockReconciliationService.findOne).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 10x stability for audit + preflight/range (Phase 4)
  // -------------------------------------------------------------------------
  describe('10x stability', () => {
    it('audit endpoint returns identical shape on 10 consecutive calls', async () => {
      mockReconciliationService.auditPeriodBoundary.mockResolvedValue({ total: 0, items: [] });
      const statuses: number[] = [];
      for (let i = 0; i < 10; i++) {
        const res = await request(app.getHttpServer())
          .get('/reconciliations/audit/period-boundary');
        statuses.push(res.status);
      }
      expect(new Set(statuses).size).toBe(1);
      expect(statuses[0]).toBe(200);
    });

    it('preflight/range with INVALID period_end rejects 10 times consistently', async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 10; i++) {
        const res = await request(app.getHttpServer())
          .post('/reconciliations/preflight/range')
          .send({
            tenant_id: 47,
            mysql_race_id: 148,
            period_start: '2026-04-01',
            period_end: '2026-04-25', // not lastDay
          });
        statuses.push(res.status);
      }
      expect(new Set(statuses).size).toBe(1);
      expect(statuses[0]).toBe(400);
    });

    it('batch with INVALID period rejects 10 times consistently (no ghost data)', async () => {
      // Reset call history so we measure ONLY calls during the 10x loop.
      mockReconciliationService.batchCreate.mockClear();
      const statuses: number[] = [];
      for (let i = 0; i < 10; i++) {
        const res = await request(app.getHttpServer())
          .post('/reconciliations/batch')
          .send({ period: '2026-13', merchant_ids: 'all' });
        statuses.push(res.status);
      }
      expect(new Set(statuses).size).toBe(1);
      expect(statuses[0]).toBe(400);
      // Verify service.batchCreate was NEVER called when validation fails (no ghost docs).
      expect(mockReconciliationService.batchCreate).not.toHaveBeenCalled();
    });
  });
});
