/**
 * F-088 — Dashboard control: enrichReport (cumulative + breakdown + counters +
 * resolved flags), markOrderResolved (SADD/SREM), throttled cumulative refresh.
 */
import { InvoiceReconcileService } from '../services/invoice-reconcile.service';
import { MissingInvoiceRowDto } from '../dto/missing-invoice-row.dto';
import { ReconcileReportDto } from '../dto/reconcile-report.dto';

function row(o: Partial<MissingInvoiceRowDto>): MissingInvoiceRowDto {
  return {
    orderId: 1,
    orderCode: '#5B1IB',
    raceId: 220,
    email: 'a@5bib.com',
    buyerName: 'Test',
    totalPrice: 1000,
    paymentOn: '2026-06-16T22:00:00Z',
    orderCategory: 'ORDINARY',
    ageHours: 10,
    bucket: 'UNISSUED',
    severity: 'WARN',
    breached: false,
    misaInvNo: null,
    duplicateCount: undefined,
    ...o,
  };
}

function report(o: Partial<ReconcileReportDto>): ReconcileReportDto {
  return {
    date: '2026-06-17',
    runAt: '2026-06-17T07:00:00Z',
    mode: 'cron',
    raceIdsScanned: [220],
    expectedCount: 5,
    issuedCount: 3,
    missingCount: 2,
    atRiskCount: 0,
    duplicateCount: 1,
    breachedCount: 0,
    missing: [row({ orderId: 1 }), row({ orderId: 2 })],
    misaOrphan: [{} as any],
    layer2Status: 'OK',
    maxSeverity: 'WARN',
    alertSent: false,
    ...o,
  };
}

function makeService(opts: {
  smembers?: string[];
  throttleAcquired?: boolean;
  countImpl?: jest.Mock;
  cumulativePersisted?: number;
  counters?: Record<string, number>;
} = {}) {
  const orderRepo = { manager: { query: jest.fn().mockResolvedValue([]) } } as any;
  const misa = {
    isConfigured: jest.fn().mockReturnValue(true),
    listInvoicesByDateRange: jest.fn().mockResolvedValue([]),
    countInvoicesInRange: opts.countImpl ?? jest.fn().mockResolvedValue(120),
    getLastStatus: jest.fn().mockReturnValue('OK'),
  } as any;
  const setCumulative = jest.fn().mockResolvedValue(undefined);
  const counters = {
    increment: jest.fn().mockResolvedValue(undefined),
    getAll: jest.fn().mockResolvedValue(opts.counters ?? { 'misa-fail': 0 }),
    getCumulativeIssued: jest.fn().mockResolvedValue(opts.cumulativePersisted ?? 98),
    setCumulativeIssued: setCumulative,
  } as any;
  const alert = {
    emitUrgentAlerts: jest.fn().mockResolvedValue({ sent: 0 }),
    sendHourlyRecap: jest.fn().mockResolvedValue(true),
    sendEodRecap: jest.fn().mockResolvedValue(true),
  } as any;
  const sadd = jest.fn().mockResolvedValue(1);
  const srem = jest.fn().mockResolvedValue(1);
  const expire = jest.fn().mockResolvedValue(1);
  const redis = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(opts.throttleAcquired === false ? null : 'OK'),
    del: jest.fn().mockResolvedValue(1),
    smembers: jest.fn().mockResolvedValue(opts.smembers ?? []),
    sadd,
    srem,
    expire,
  } as any;
  const resolver = { getRaceTitlesByMysqlIds: jest.fn().mockResolvedValue(new Map()) } as any;
  const service = new InvoiceReconcileService(orderRepo, misa, alert, counters, redis, resolver);
  return { service, misa, counters, setCumulative, sadd, srem, redis };
}

describe('F-088 — enrichReport', () => {
  it('thêm cumulativeIssued + errorBreakdown + dailyCounters', async () => {
    const { service } = makeService({
      throttleAcquired: true,
      countImpl: jest.fn().mockResolvedValue(120),
      counters: { 'misa-fail': 1, 'scan-ticks': 96 },
    });
    const out = await service.enrichReport('2026-06-17', report({}));
    // throttle acquired → fresh MISA = 120
    expect(out.cumulativeIssued).toBe(120);
    // breakdown: unissued 2 + duplicate 1 + orphan 1 + misaFail 1 = 5
    expect(out.errorBreakdown).toEqual({
      unissued: 2,
      duplicate: 1,
      orphan: 1,
      misaFail: 1,
      total: 5,
    });
    expect(out.dailyCounters).toEqual({ 'misa-fail': 1, 'scan-ticks': 96 });
  });

  it('throttle KHÔNG acquire → đọc persisted (không gọi MISA)', async () => {
    const { service, misa } = makeService({
      throttleAcquired: false,
      cumulativePersisted: 98,
    });
    const out = await service.enrichReport('2026-06-17', report({}));
    expect(out.cumulativeIssued).toBe(98);
    expect(misa.countInvoicesInRange).not.toHaveBeenCalled();
  });

  it('resolved flag: đơn trong SET → resolved=true, ngoài → false', async () => {
    const { service } = makeService({ smembers: ['2'] });
    const out = await service.enrichReport('2026-06-17', report({}));
    const r1 = out.missing.find((m) => m.orderId === 1);
    const r2 = out.missing.find((m) => m.orderId === 2);
    expect(r1?.resolved).toBe(false);
    expect(r2?.resolved).toBe(true);
  });

  it('KHÔNG mutate report gốc (cache vẫn raw)', async () => {
    const { service } = makeService();
    const original = report({});
    await service.enrichReport('2026-06-17', original);
    expect(original.cumulativeIssued).toBeUndefined();
    expect(original.missing[0].resolved).toBeUndefined();
  });

  it('best-effort: counters.getAll throw → dailyCounters {} + vẫn enrich', async () => {
    const { service, counters } = makeService();
    counters.getAll.mockRejectedValueOnce(new Error('redis dead'));
    const out = await service.enrichReport('2026-06-17', report({}));
    expect(out.dailyCounters).toEqual({});
    expect(out.errorBreakdown).toBeDefined();
  });
});

describe('F-088 — markOrderResolved', () => {
  it('resolved=true → SADD key scope-by-date + EXPIRE TTL', async () => {
    const { service, sadd, srem, redis } = makeService();
    await service.markOrderResolved('2026-06-17', 123, true);
    expect(sadd).toHaveBeenCalledWith('invoice-reconcile:resolved:2026-06-17', '123');
    expect(redis.expire).toHaveBeenCalledWith(
      'invoice-reconcile:resolved:2026-06-17',
      7 * 24 * 3600,
    );
    expect(srem).not.toHaveBeenCalled();
  });

  it('resolved=false → SREM (không EXPIRE)', async () => {
    const { service, sadd, srem } = makeService();
    await service.markOrderResolved('2026-06-17', 123, false);
    expect(srem).toHaveBeenCalledWith('invoice-reconcile:resolved:2026-06-17', '123');
    expect(sadd).not.toHaveBeenCalled();
  });

  it('redis throw → KHÔNG crash', async () => {
    const { service, sadd } = makeService();
    sadd.mockRejectedValueOnce(new Error('boom'));
    await expect(
      service.markOrderResolved('2026-06-17', 123, true),
    ).resolves.toBeUndefined();
  });
});
