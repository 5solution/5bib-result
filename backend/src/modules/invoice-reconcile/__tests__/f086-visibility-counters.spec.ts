/**
 * F-086 — Invoice Visibility Counters.
 *
 * TC-86-01..09: 3-dòng "Tóm tắt" (tổng/hôm nay/lỗi) vào heartbeat + EOD,
 * error breakdown snapshot (no double-count breached), cumulative refresh
 * idempotent + MISA-fail fallback, backward-compat, heartbeat-MUST-send.
 */
import {
  composeHourlyRecap,
  composeEodRecap,
  computeErrorBreakdown,
} from '../services/alert-composer';
import { DailyCountersService } from '../services/daily-counters.service';
import { InvoiceReconcileService } from '../services/invoice-reconcile.service';
import { MissingInvoiceRowDto } from '../dto/missing-invoice-row.dto';
import { ReconcileReportDto } from '../dto/reconcile-report.dto';

function row(o: Partial<MissingInvoiceRowDto>): MissingInvoiceRowDto {
  return {
    orderId: 200029416,
    orderCode: '#5B200029416IB',
    raceId: 220,
    email: 'a@5bib.com',
    buyerName: 'Test',
    totalPrice: 1200000,
    paymentOn: '2026-06-08T22:00:00Z',
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
    date: '2026-06-16',
    runAt: '2026-06-16T07:00:00Z',
    mode: 'cron',
    raceIdsScanned: [220],
    expectedCount: 5,
    issuedCount: 5,
    missingCount: 0,
    atRiskCount: 0,
    duplicateCount: 0,
    breachedCount: 0,
    missing: [],
    misaOrphan: [],
    layer2Status: 'OK',
    maxSeverity: 'INFO',
    alertSent: false,
    ...o,
  };
}

const URL = 'https://admin.5bib.com/invoice-reconcile';

describe('F-086 — computeErrorBreakdown (TC-86-05)', () => {
  it('errorTotal = unissued + duplicate + orphan + misaFail', () => {
    const r = report({
      missing: [row({ orderId: 1 }), row({ orderId: 2 })], // 2 UNISSUED
      duplicateCount: 1,
      misaOrphan: [{} as any], // 1 orphan
    });
    const b = computeErrorBreakdown(r, 3); // misaFail=3
    expect(b).toEqual({
      unissued: 2,
      duplicate: 1,
      orphan: 1,
      misaFail: 3,
      total: 7,
    });
  });

  it('TC-86-03: breached KHÔNG cộng riêng (breached ⊂ unissued, no double-count)', () => {
    const r = report({
      missing: [
        row({ orderId: 1, breached: true }),
        row({ orderId: 2, breached: true }),
      ],
      breachedCount: 2, // cả 2 đều breached
      misaOrphan: [],
    });
    const b = computeErrorBreakdown(r, 0);
    expect(b.unissued).toBe(2);
    expect(b.total).toBe(2); // KHÔNG phải 4 (breached không cộng đôi)
  });

  it('SYNC_LAG KHÔNG tính vào error (chỉ UNISSUED)', () => {
    const r = report({
      missing: [
        row({ orderId: 1, bucket: 'UNISSUED' }),
        row({ orderId: 2, bucket: 'SYNC_LAG' }),
      ],
    });
    expect(computeErrorBreakdown(r, 0).unissued).toBe(1);
  });
});

describe('F-086 — composeHourlyRecap summary block', () => {
  it('TC-86-01: All-OK → 3 dòng tóm tắt với cumulative + lỗi 0', () => {
    const html = composeHourlyRecap(
      report({ missingCount: 0, issuedCount: 5, expectedCount: 5 }),
      [],
      URL,
      new Map(),
      { cumulativeIssued: 147, misaFailToday: 0 },
    );
    expect(html).toContain('📦 Hôm nay: <b>5</b>/5 đã xuất');
    expect(html).toContain('⚠️ Đang lỗi: <b>0</b>');
    expect(html).toContain('📈 Tổng từ 08/06: <b>147</b> hóa đơn');
  });

  it('TC-86-02: Có-issue → errorTotal + breakdown đúng', () => {
    const html = composeHourlyRecap(
      report({
        missingCount: 2,
        issuedCount: 20,
        expectedCount: 23,
        missing: [
          row({ orderId: 1, bucket: 'UNISSUED' }),
          row({ orderId: 2, bucket: 'UNISSUED' }),
        ],
        duplicateCount: 1,
        misaOrphan: [{} as any],
      }),
      [],
      URL,
      new Map(),
      { cumulativeIssued: 200, misaFailToday: 0 },
    );
    expect(html).toContain(
      '⚠️ Đang lỗi: <b>4</b> (UNISSUED 2 · trùng 1 · orphan 1 · MISA-fail 0)',
    );
    expect(html).toContain('📈 Tổng từ 08/06: <b>200</b> hóa đơn');
  });

  it('TC-86-07: extras default {0,0} → backward-compat, summary vẫn render 0', () => {
    const html = composeHourlyRecap(
      report({ missingCount: 0, issuedCount: 5, expectedCount: 5 }),
      [],
      URL,
      // KHÔNG truyền extras (call F-079 cũ)
    );
    expect(html).toContain('📈 Tổng từ 08/06: <b>0</b> hóa đơn');
    // F-079 content giữ nguyên
    expect(html).toContain('All OK');
  });

  it('misaFailToday phản ánh vào dòng lỗi', () => {
    const html = composeHourlyRecap(
      report({ missingCount: 0, issuedCount: 5, expectedCount: 5 }),
      [],
      URL,
      new Map(),
      { cumulativeIssued: 10, misaFailToday: 2 },
    );
    expect(html).toContain('⚠️ Đang lỗi: <b>2</b> (UNISSUED 0 · trùng 0 · orphan 0 · MISA-fail 2)');
  });
});

describe('F-086 — composeEodRecap (TC-86-04)', () => {
  it('có dòng cumulative + error tổng', () => {
    const html = composeEodRecap(
      report({ expectedCount: 23, issuedCount: 21, missingCount: 1, missing: [row({ orderId: 1 })] }),
      { 'scan-ticks': 100, 'misa-fail': 1 },
      URL,
      { cumulativeIssued: 147, misaFailToday: 0 },
    );
    expect(html).toContain('📈 Tổng từ 08/06:');
    expect(html).toContain('147');
    expect(html).toContain('⚠️ Đang lỗi (tổng):');
    // misaFail đọc từ dailyCounters (1) → total = unissued(1)+0+0+1 = 2
    expect(html).toContain('<b>2</b> đơn (UNISSUED 1 · trùng 0 · orphan 0 · MISA-fail 1)');
  });

  it('EOD backward-compat without extras → cumulative 0', () => {
    const html = composeEodRecap(report({}), {}, URL);
    expect(html).toContain('📈 Tổng từ 08/06:      <b>0</b> hóa đơn');
  });
});

describe('F-086 — DailyCountersService cumulative (TC-86-05)', () => {
  function makeCounters() {
    const store = new Map<string, string>();
    const redis = {
      set: jest.fn(async (k: string, v: string) => {
        store.set(k, v);
        return 'OK';
      }),
      get: jest.fn(async (k: string) => store.get(k) ?? null),
    } as any;
    return { svc: new DailyCountersService(redis), store, redis };
  }

  it('set + get round-trip', async () => {
    const { svc } = makeCounters();
    await svc.setCumulativeIssued(147);
    expect(await svc.getCumulativeIssued()).toBe(147);
  });

  it('idempotent: set 2 lần cùng số → vẫn 147 (SET không INCR)', async () => {
    const { svc } = makeCounters();
    await svc.setCumulativeIssued(147);
    await svc.setCumulativeIssued(147);
    expect(await svc.getCumulativeIssued()).toBe(147);
  });

  it('get khi chưa set → 0', async () => {
    const { svc } = makeCounters();
    expect(await svc.getCumulativeIssued()).toBe(0);
  });

  it('no redis → 0 (best-effort, không throw)', async () => {
    const svc = new DailyCountersService(undefined);
    await expect(svc.setCumulativeIssued(5)).resolves.toBeUndefined();
    expect(await svc.getCumulativeIssued()).toBe(0);
  });

  it('negative coerced → 0 (defensive)', async () => {
    const { svc, store } = makeCounters();
    store.set('invoice-reconcile:cumulative:issued', '-5');
    expect(await svc.getCumulativeIssued()).toBe(0);
  });
});

describe('F-086 — refreshCumulativeIssued qua runHourlyRecap (TC-86-05/08/09)', () => {
  const today = '2026-06-16';

  function makeService(opts: {
    countImpl?: jest.Mock;
    getCumulativeImpl?: jest.Mock;
    getAllImpl?: jest.Mock;
  } = {}) {
    const repoQuery = jest.fn();
    const orderRepo = { manager: { query: repoQuery } } as any;
    const misa = {
      isConfigured: jest.fn().mockReturnValue(true),
      listInvoicesByDateRange: jest.fn().mockResolvedValue([]),
      countInvoicesInRange:
        opts.countImpl ?? jest.fn().mockResolvedValue(147),
      getLastStatus: jest.fn().mockReturnValue('OK'),
    } as any;
    const setCumulative = jest.fn().mockResolvedValue(undefined);
    const counters = {
      increment: jest.fn().mockResolvedValue(undefined),
      getAll: opts.getAllImpl ?? jest.fn().mockResolvedValue({}),
      getCumulativeIssued:
        opts.getCumulativeImpl ?? jest.fn().mockResolvedValue(0),
      setCumulativeIssued: setCumulative,
    } as any;
    const alert = {
      emitUrgentAlerts: jest.fn().mockResolvedValue({ sent: 0 }),
      sendHourlyRecap: jest.fn().mockResolvedValue(true),
      sendEodRecap: jest.fn().mockResolvedValue(true),
    } as any;
    const store = new Map<string, string>();
    const redis = {
      get: jest.fn(async (k: string) => store.get(k) ?? null),
      set: jest.fn(async (k: string, v: string) => {
        store.set(k, v);
        return 'OK';
      }),
      del: jest.fn(async () => 1),
    } as any;
    const resolver = {
      getRaceTitlesByMysqlIds: jest.fn().mockResolvedValue(new Map()),
    } as any;
    const service = new InvoiceReconcileService(
      orderRepo,
      misa,
      alert,
      counters,
      redis,
      resolver,
    );
    store.set(
      `invoice-reconcile:last-run:${today}`,
      JSON.stringify(report({ raceIdsScanned: [220] })),
    );
    return { service, alert, misa, counters, setCumulative };
  }

  it('TC-86-05a: MISA OK → set + truyền cumulative vào sendHourlyRecap', async () => {
    const { service, alert, misa, setCumulative } = makeService();
    await service.runHourlyRecap(today);
    expect(misa.countInvoicesInRange).toHaveBeenCalledWith('2026-06-08', today);
    expect(setCumulative).toHaveBeenCalledWith(147);
    const extras = alert.sendHourlyRecap.mock.calls[0][3];
    expect(extras.cumulativeIssued).toBe(147);
  });

  it('TC-86-05b: MISA throw → giữ value persisted cũ, KHÔNG overwrite', async () => {
    const { service, alert, setCumulative } = makeService({
      countImpl: jest.fn().mockRejectedValue(new Error('MISA down')),
      getCumulativeImpl: jest.fn().mockResolvedValue(100),
    });
    await service.runHourlyRecap(today);
    expect(setCumulative).not.toHaveBeenCalled();
    const extras = alert.sendHourlyRecap.mock.calls[0][3];
    expect(extras.cumulativeIssued).toBe(100);
  });

  it('misaFailToday đọc từ daily counters', async () => {
    const { service, alert } = makeService({
      getAllImpl: jest.fn().mockResolvedValue({ 'misa-fail': 4 }),
    });
    await service.runHourlyRecap(today);
    expect(alert.sendHourlyRecap.mock.calls[0][3].misaFailToday).toBe(4);
  });

  it('TC-86-09: countInvoicesInRange + getCumulativeIssued đều throw → heartbeat VẪN gửi (extras 0/0)', async () => {
    const { service, alert } = makeService({
      countImpl: jest.fn().mockRejectedValue(new Error('boom')),
      getCumulativeImpl: jest.fn().mockRejectedValue(new Error('redis dead')),
    });
    const res = await service.runHourlyRecap(today);
    expect(res.sent).toBe(true); // MUST send
    expect(alert.sendHourlyRecap.mock.calls[0][3]).toEqual({
      cumulativeIssued: 0,
      misaFailToday: 0,
    });
  });

  it('MISA not configured → đọc persisted, KHÔNG gọi countInvoicesInRange', async () => {
    const { service, misa } = makeService();
    misa.isConfigured.mockReturnValue(false);
    await service.runHourlyRecap(today);
    expect(misa.countInvoicesInRange).not.toHaveBeenCalled();
  });
});
