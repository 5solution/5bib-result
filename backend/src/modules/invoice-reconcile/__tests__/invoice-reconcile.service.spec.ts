/**
 * F-076 TC-11..16 — invoice-reconcile service integration tests.
 *
 * Mock MySQL repo + MISA client + alert service + Redis.
 */
import { InvoiceReconcileService } from '../services/invoice-reconcile.service';
import {
  MisaAuthFailError,
  MisaUnavailableError,
} from '../services/misa-meinvoice.client';
import { env } from 'src/config';

function makeMocks() {
  const repoQuery = jest.fn();
  const orderRepo = {
    manager: { query: repoQuery },
  } as any;

  const misa = {
    isConfigured: jest.fn().mockReturnValue(true),
    listInvoicesByDateRange: jest.fn().mockResolvedValue([]),
    getLastStatus: jest.fn().mockReturnValue('OK'),
    getTokenExpiry: jest.fn().mockResolvedValue(null),
  } as any;

  const alert = {
    emitUrgentAlerts: jest.fn().mockResolvedValue({ sent: 0 }),
    sendHourlyRecap: jest.fn().mockResolvedValue(false),
    sendEodRecap: jest.fn().mockResolvedValue(true),
    sendMisaUnavailable: jest.fn().mockResolvedValue(true),
    sendMisaAuthFail: jest.fn().mockResolvedValue(true),
  } as any;

  const counters = {
    increment: jest.fn().mockResolvedValue(undefined),
    getAll: jest.fn().mockResolvedValue({}),
  } as any;

  const redisStore = new Map<string, string>();
  const redis = {
    get: jest.fn(async (k: string) => redisStore.get(k) ?? null),
    // Honor NX flag (last argument can be 'NX' or undefined)
    set: jest.fn(async (k: string, v: string, ...args: unknown[]) => {
      const isNx = args.includes('NX');
      if (isNx && redisStore.has(k)) return null;
      redisStore.set(k, v);
      return 'OK';
    }),
    del: jest.fn(async (k: string) => {
      redisStore.delete(k);
      return 1;
    }),
    ttl: jest.fn(async () => -1),
  } as any;

  const service = new InvoiceReconcileService(
    orderRepo,
    misa,
    alert,
    counters,
    redis,
  );

  return { service, repoQuery, misa, alert, counters, redis };
}

describe('InvoiceReconcileService', () => {
  beforeEach(() => {
    env.invoiceReconcile.enabledRaceIds = [140, 220];
    env.invoiceReconcile.ageWarnHours = 12;
    env.invoiceReconcile.ageCriticalHours = 20;
    env.invoiceReconcile.ageBreachedHours = 24;
  });

  // TC-11 — Happy path
  it('TC-11: scan() with 1 OK + 1 SYNC_LAG + 1 UNISSUED 22h', async () => {
    const { service, repoQuery, misa } = makeMocks();
    const now = new Date();
    const paid76h = new Date(now.getTime() - 76 * 3_600_000);
    const paid22h = new Date(now.getTime() - 22 * 3_600_000);

    repoQuery.mockResolvedValue([
      {
        id: 200029420,
        raceId: 140,
        name: '#5B200029420IB',
        email: 'a@x',
        firstName: null,
        lastName: null,
        financialStatus: 'paid',
        internalStatus: 'COMPLETE',
        orderCategory: 'ORDINARY',
        paymentOn: paid76h,
        totalPrice: 12000,
        vatRef: '00000023',
      },
      {
        id: 200029416,
        raceId: 140,
        name: '#5B200029416IB',
        email: 'b@x',
        firstName: null,
        lastName: null,
        financialStatus: 'paid',
        internalStatus: 'COMPLETE',
        orderCategory: 'ORDINARY',
        paymentOn: paid76h,
        totalPrice: 12000,
        vatRef: null,
      },
      {
        id: 999,
        raceId: 220,
        name: '#5B999IB',
        email: 'c@x',
        firstName: null,
        lastName: null,
        financialStatus: 'paid',
        internalStatus: 'COMPLETE',
        orderCategory: 'ORDINARY',
        paymentOn: paid22h,
        totalPrice: 1200000,
        vatRef: null,
      },
    ]);

    misa.listInvoicesByDateRange.mockResolvedValue([
      {
        RefID: '200029420-20260608172739',
        InvNo: '00000023',
        InvSeries: '1C26MBB',
        InvDate: '2026-06-08T00:00:00+07:00',
        TotalAmount: 12000,
        BuyerFullName: 'A',
        ReferenceType: null,
      },
      {
        RefID: '200029416-20260608110754',
        InvNo: '00000018',
        InvSeries: '1C26MBB',
        InvDate: '2026-06-08T00:00:00+07:00',
        TotalAmount: 12000,
        BuyerFullName: 'B',
        ReferenceType: null,
      },
    ]);

    const report = await service.scan('2026-06-09', 'manual');
    expect(report.expectedCount).toBe(3);
    expect(report.issuedCount).toBe(1);
    expect(report.missingCount).toBe(2); // 1 SYNC_LAG + 1 UNISSUED (not DUPLICATE)
    expect(report.atRiskCount).toBe(1); // 22h UNISSUED is CRITICAL
    expect(report.maxSeverity).toBe('CRITICAL');
    expect(report.layer2Status).toBe('OK');
    expect(report.mode).toBe('manual');
  });

  // TC-12 — Layer 2 timeout still emits report (DEGRADED handled in client)
  it('TC-12: continues with empty MISA if listInvoices throws non-auth/unreachable', async () => {
    const { service, repoQuery, misa } = makeMocks();
    repoQuery.mockResolvedValue([]);
    misa.listInvoicesByDateRange.mockRejectedValue(
      new Error('temporary 5xx'),
    );
    const report = await service.scan('2026-06-09', 'cron');
    expect(report.layer2Status).toBe('UNAVAILABLE');
    expect(report.expectedCount).toBe(0);
  });

  // TC-13 — Layer 2 all retries exhaust → UNAVAILABLE + alert
  it('TC-13: MisaUnavailableError triggers UNAVAILABLE + alert', async () => {
    const { service, repoQuery, misa, alert } = makeMocks();
    repoQuery.mockResolvedValue([]);
    misa.listInvoicesByDateRange.mockRejectedValue(
      new MisaUnavailableError('ECONNREFUSED'),
    );
    const report = await service.scan('2026-06-09', 'cron');
    expect(report.layer2Status).toBe('UNAVAILABLE');
    expect(alert.sendMisaUnavailable).toHaveBeenCalledWith(
      '2026-06-09',
      'ECONNREFUSED',
    );
  });

  // Auth fail path
  it('MisaAuthFailError triggers sendMisaAuthFail alert', async () => {
    const { service, repoQuery, misa, alert } = makeMocks();
    repoQuery.mockResolvedValue([]);
    misa.listInvoicesByDateRange.mockRejectedValue(
      new MisaAuthFailError('401 InvalidTokenCode'),
    );
    const report = await service.scan('2026-06-09', 'cron');
    expect(report.layer2Status).toBe('UNAVAILABLE');
    expect(alert.sendMisaAuthFail).toHaveBeenCalled();
  });

  // TC-15 (lock acquisition)
  it('TC-15: tryAcquireLock returns true once + false on second concurrent', async () => {
    const { service } = makeMocks();
    const a = await service.tryAcquireLock();
    const b = await service.tryAcquireLock();
    expect(a).toBe(true);
    expect(b).toBe(false);
    await service.releaseLock();
    const c = await service.tryAcquireLock();
    expect(c).toBe(true);
  });

  // Empty config skip
  it('Empty enabledRaceIds returns empty report without DB call', async () => {
    const { service, repoQuery } = makeMocks();
    env.invoiceReconcile.enabledRaceIds = [];
    const report = await service.scan('2026-06-09', 'cron');
    expect(report.expectedCount).toBe(0);
    expect(report.raceIdsScanned).toEqual([]);
    expect(repoQuery).not.toHaveBeenCalled();
  });
});
