/**
 * QC E2E TC-24..30 + 10x stability (TC-29).
 *
 * Controller integration tests — uses Nest test bed (override LogtoFinanceGuard
 * F-078 renamed from LogtoAdminGuard + AuditLogService + all deps with mocks). Verifies:
 *  - TC-24 GET /today returns ReconcileReportDto
 *  - TC-27 POST /trigger returns 200 + report
 *  - TC-28 POST /trigger 409 when lock held
 *  - TC-29 10× concurrent POST /trigger: exactly 1× success + 9× 409
 *  - TC-30 GET /health masks sensitive fields
 *
 * KHÔNG test 401/403 ở đây vì LogtoFinanceGuard mocked thành allow-all
 * (testing controller logic, not guard). Guard tested separately trong
 * `logto-finance.guard.spec.ts` (F-078 BR-78-04 + TC-01..04).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { ThrottlerGuard } from '@nestjs/throttler';
import { InvoiceReconcileController } from '../invoice-reconcile.controller';
import { InvoiceReconcileService } from '../services/invoice-reconcile.service';
import { MisaMeinvoiceClient } from '../services/misa-meinvoice.client';
import { InvoiceTelegramClient } from '../services/invoice-telegram.client';
import { LogtoFinanceGuard } from '../../logto-auth';
import { AuditLogService } from '../../audit/services/audit-log.service';
import { env } from 'src/config';
import type { ReconcileReportDto } from '../dto/reconcile-report.dto';

function makeFakeReport(overrides: Partial<ReconcileReportDto> = {}): ReconcileReportDto {
  return {
    date: '2026-06-09',
    runAt: '2026-06-09T07:00:00.000Z',
    mode: 'cron',
    raceIdsScanned: [140, 220],
    expectedCount: 4,
    issuedCount: 3,
    missingCount: 1,
    atRiskCount: 0,
    duplicateCount: 0,
    breachedCount: 0,
    missing: [],
    misaOrphan: [],
    layer2Status: 'OK',
    maxSeverity: 'INFO',
    alertSent: false,
    ...overrides,
  };
}

describe('InvoiceReconcileController (E2E controller integration)', () => {
  let app: INestApplication;
  let mockReconcile: {
    getCachedReport: jest.Mock;
    scan: jest.Mock;
    tryAcquireLock: jest.Mock;
    releaseLock: jest.Mock;
    getLastScanTickAt: jest.Mock;
    getEnabledRaceIds: jest.Mock;
  };
  let mockMisa: {
    getTokenExpiry: jest.Mock;
    getLastStatus: jest.Mock;
    isConfigured: jest.Mock;
  };
  let mockTelegram: {
    isConfigured: jest.Mock;
    getChatIdMasked: jest.Mock;
  };
  let mockAudit: { emit: jest.Mock };

  beforeEach(async () => {
    mockReconcile = {
      getCachedReport: jest.fn(),
      scan: jest.fn(),
      tryAcquireLock: jest.fn(),
      releaseLock: jest.fn().mockResolvedValue(undefined),
      getLastScanTickAt: jest.fn().mockReturnValue(null),
      getEnabledRaceIds: jest.fn().mockReturnValue([140, 220]),
    };
    mockMisa = {
      getTokenExpiry: jest.fn().mockResolvedValue(null),
      getLastStatus: jest.fn().mockReturnValue('OK'),
      isConfigured: jest.fn().mockReturnValue(true),
    };
    mockTelegram = {
      isConfigured: jest.fn().mockReturnValue(true),
      getChatIdMasked: jest.fn().mockReturnValue('-100***7167'),
    };
    mockAudit = { emit: jest.fn().mockResolvedValue(undefined) };

    env.invoiceReconcile.alertEmails = ['danny@5bib.com', 'ketoan@5bib.com'];

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [InvoiceReconcileController],
      providers: [
        { provide: InvoiceReconcileService, useValue: mockReconcile },
        { provide: MisaMeinvoiceClient, useValue: mockMisa },
        { provide: InvoiceTelegramClient, useValue: mockTelegram },
        { provide: AuditLogService, useValue: mockAudit },
      ],
    })
      .overrideGuard(LogtoFinanceGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('TC-24 — GET /today', () => {
    it('returns 200 with cached report when cache hit', async () => {
      const report = makeFakeReport({ expectedCount: 10 });
      mockReconcile.getCachedReport.mockResolvedValue(report);

      const res = await request(app.getHttpServer())
        .get('/admin/invoice-reconcile/today')
        .expect(200);

      expect(res.body).toMatchObject({
        date: '2026-06-09',
        expectedCount: 10,
        layer2Status: 'OK',
      });
      expect(mockReconcile.scan).not.toHaveBeenCalled();
    });

    it('falls back to scan inline when cache miss + lock available', async () => {
      mockReconcile.getCachedReport.mockResolvedValue(null);
      mockReconcile.tryAcquireLock.mockResolvedValue(true);
      mockReconcile.scan.mockResolvedValue(makeFakeReport());

      const res = await request(app.getHttpServer())
        .get('/admin/invoice-reconcile/today')
        .expect(200);

      expect(mockReconcile.scan).toHaveBeenCalledWith(
        expect.any(String),
        'cron',
      );
      expect(mockReconcile.releaseLock).toHaveBeenCalled();
      expect(res.body.date).toBeDefined();
    });

    it('returns empty placeholder when cache miss + lock held', async () => {
      mockReconcile.getCachedReport.mockResolvedValue(null);
      mockReconcile.tryAcquireLock.mockResolvedValue(false);

      const res = await request(app.getHttpServer())
        .get('/admin/invoice-reconcile/today')
        .expect(200);

      expect(res.body).toMatchObject({
        expectedCount: 0,
        raceIdsScanned: [140, 220],
        layer2Status: 'OK',
      });
    });

    it('accepts optional date query param', async () => {
      mockReconcile.getCachedReport.mockResolvedValue(
        makeFakeReport({ date: '2026-06-08' }),
      );
      await request(app.getHttpServer())
        .get('/admin/invoice-reconcile/today')
        .query({ date: '2026-06-08' })
        .expect(200);
      expect(mockReconcile.getCachedReport).toHaveBeenCalledWith('2026-06-08');
    });

    it('rejects malformed date query (falls back to today)', async () => {
      mockReconcile.getCachedReport.mockResolvedValue(makeFakeReport());
      await request(app.getHttpServer())
        .get('/admin/invoice-reconcile/today')
        .query({ date: 'evil-input' })
        .expect(200);
      // Should NOT pass 'evil-input' through — controller resolveDate sanitizes
      const passedDate = mockReconcile.getCachedReport.mock.calls[0][0];
      expect(passedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('TC-27 — POST /trigger happy path', () => {
    it('returns 200 with report + emits audit log', async () => {
      mockReconcile.tryAcquireLock.mockResolvedValue(true);
      mockReconcile.scan.mockResolvedValue(
        makeFakeReport({ missingCount: 2, atRiskCount: 1, duplicateCount: 0 }),
      );

      const res = await request(app.getHttpServer())
        .post('/admin/invoice-reconcile/trigger')
        .expect(200);

      expect(res.body.missingCount).toBe(2);
      expect(res.body.atRiskCount).toBe(1);
      expect(mockReconcile.scan).toHaveBeenCalledWith(
        expect.any(String),
        'manual',
      );
      expect(mockAudit.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'invoice_reconcile.triggered',
          entity: expect.objectContaining({ type: 'invoice-reconcile' }),
          metadata: expect.objectContaining({
            missingCount: 2,
            atRiskCount: 1,
          }),
        }),
      );
      expect(mockReconcile.releaseLock).toHaveBeenCalled();
    });
  });

  describe('TC-28 — POST /trigger 409 lock held', () => {
    it('returns 409 with proper VN error message', async () => {
      mockReconcile.tryAcquireLock.mockResolvedValue(false);

      const res = await request(app.getHttpServer())
        .post('/admin/invoice-reconcile/trigger')
        .expect(409);

      expect(res.body).toMatchObject({
        code: 'RECONCILE_IN_PROGRESS',
        message: 'Đang có cron khác chạy, thử lại sau 5 phút',
      });
      expect(mockReconcile.scan).not.toHaveBeenCalled();
    });
  });

  describe('TC-29 — Concurrent POST /trigger 10× stability', () => {
    it('exactly 1 succeeds and 9 get 409 when lock is acquired by exactly one', async () => {
      let lockHolder: string | null = null;
      mockReconcile.tryAcquireLock.mockImplementation(async () => {
        if (lockHolder === null) {
          lockHolder = 'me';
          return true;
        }
        return false;
      });
      mockReconcile.releaseLock.mockImplementation(async () => {
        lockHolder = null;
      });
      mockReconcile.scan.mockImplementation(async () => {
        // Hold "in-progress" briefly so concurrent calls see locked state
        await new Promise((res) => setTimeout(res, 50));
        return makeFakeReport();
      });

      const promises = Array.from({ length: 10 }, () =>
        request(app.getHttpServer()).post('/admin/invoice-reconcile/trigger'),
      );
      const results = await Promise.all(promises);
      const statuses = results.map((r) => r.status);
      const successes = statuses.filter((s) => s === 200).length;
      const conflicts = statuses.filter((s) => s === 409).length;

      expect(successes).toBe(1);
      expect(conflicts).toBe(9);
    });
  });

  describe('TC-30 — GET /health (masks sensitive)', () => {
    it('returns health response with masked secrets', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/invoice-reconcile/health')
        .expect(200);

      expect(res.body).toMatchObject({
        enabledRaceIds: [140, 220],
        misaConfigured: true,
        telegramConfigured: true,
        telegramChatIdMasked: '-100***7167',
        thresholds: {
          warnHours: expect.any(Number),
          criticalHours: expect.any(Number),
          breachedHours: expect.any(Number),
        },
      });

      // MUST NOT leak raw token, full chat_id, raw email
      const body = JSON.stringify(res.body);
      expect(body).not.toMatch(/8804367165/); // bot token leak
      expect(body).not.toMatch(/-1003743947167/); // full chat_id leak
      expect(res.body.emailRecipientsMasked).toEqual([
        'da***@5bib.com',
        'ke***@5bib.com',
      ]);
    });

    it('masks email when local-part shorter than 2 chars', async () => {
      env.invoiceReconcile.alertEmails = ['a@5bib.com'];
      const res = await request(app.getHttpServer())
        .get('/admin/invoice-reconcile/health')
        .expect(200);
      expect(res.body.emailRecipientsMasked).toEqual(['a@5bib.com']);
    });
  });
});
