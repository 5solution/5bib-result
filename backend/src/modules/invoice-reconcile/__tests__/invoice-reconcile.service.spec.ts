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

/**
 * F-079 — runHourlyRecap integration tests with race title resolver.
 *
 * Coverage map:
 *   TC-79-05 Skip removed verify (sendHourlyRecap CALLED kể cả missing=0)
 *   TC-79-06 Telegram dispatch fail → service handle gracefully
 *   TC-79-08 runHourlyRecap end-to-end với resolver wired
 *   TC-79-10 10x concurrent runHourlyRecap → no duplicate (Redis snapshot guard)
 *   TC-79-11 Resolver cache hit verify
 *   TC-79-12 Resolver cache miss → Mongo fallback verify (via mock)
 *   TC-79-13 Resolver throws → graceful empty Map fallback (BR-79-23)
 *   TC-79-14 Resolver returns partial Map (some IDs missing) → composer fallback
 */
function makeMocksWithResolver(resolverImpl?: {
  getRaceTitlesByMysqlIds?: jest.Mock;
}) {
  const repoQuery = jest.fn();
  const orderRepo = { manager: { query: repoQuery } } as any;
  const misa = {
    isConfigured: jest.fn().mockReturnValue(true),
    listInvoicesByDateRange: jest.fn().mockResolvedValue([]),
    getLastStatus: jest.fn().mockReturnValue('OK'),
    getTokenExpiry: jest.fn().mockResolvedValue(null),
  } as any;
  const alert = {
    emitUrgentAlerts: jest.fn().mockResolvedValue({ sent: 0 }),
    sendHourlyRecap: jest.fn().mockResolvedValue(true),
    sendEodRecap: jest.fn().mockResolvedValue(true),
  } as any;
  const counters = {
    increment: jest.fn().mockResolvedValue(undefined),
    getAll: jest.fn().mockResolvedValue({}),
  } as any;
  const redisStore = new Map<string, string>();
  const redis = {
    get: jest.fn(async (k: string) => redisStore.get(k) ?? null),
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

  const resolver = {
    getRaceTitlesByMysqlIds:
      resolverImpl?.getRaceTitlesByMysqlIds ??
      jest.fn().mockResolvedValue(
        new Map<number, string>([
          [140, '5BIB x COROS'],
          [220, 'LÀO CAI MARATHON 2026 - DÒNG CHẢY BIÊN CƯƠNG'],
        ]),
      ),
  } as any;

  const service = new InvoiceReconcileService(
    orderRepo,
    misa,
    alert,
    counters,
    redis,
    resolver,
  );

  return { service, alert, redis, redisStore, resolver };
}

describe('F-079 — runHourlyRecap + race title resolver', () => {
  const today = '2026-06-09';

  function cachedReport(overrides: Record<string, unknown> = {}): unknown {
    return {
      date: today,
      runAt: '2026-06-09T07:00:00Z',
      mode: 'cron',
      raceIdsScanned: [220],
      expectedCount: 23,
      issuedCount: 23,
      skippedCount: 2,
      missingCount: 0,
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

  describe('TC-79-05 — Skip removed: sendHourlyRecap CALLED kể cả missing=0', () => {
    it('dispatches Telegram even when missing=0 AND diff=[]', async () => {
      const { service, alert, redisStore } = makeMocksWithResolver();
      redisStore.set(
        `invoice-reconcile:last-run:${today}`,
        JSON.stringify(cachedReport()),
      );
      const result = await service.runHourlyRecap(today);
      expect(result.sent).toBe(true);
      expect(alert.sendHourlyRecap).toHaveBeenCalledTimes(1);
    });
  });

  describe('TC-79-06 — Telegram dispatch fail → service handle gracefully', () => {
    it('returns sent=false but does not throw', async () => {
      const { service, alert, redisStore } = makeMocksWithResolver();
      alert.sendHourlyRecap.mockResolvedValueOnce(false);
      redisStore.set(
        `invoice-reconcile:last-run:${today}`,
        JSON.stringify(cachedReport()),
      );
      const result = await service.runHourlyRecap(today);
      expect(result.sent).toBe(false);
      expect(result.report).not.toBeNull();
    });
  });

  describe('TC-79-08 — runHourlyRecap passes resolved titles to alert', () => {
    it('calls sendHourlyRecap with raceTitlesByid Map populated', async () => {
      const { service, alert, redisStore, resolver } = makeMocksWithResolver();
      redisStore.set(
        `invoice-reconcile:last-run:${today}`,
        JSON.stringify(cachedReport({ raceIdsScanned: [140, 220] })),
      );
      await service.runHourlyRecap(today);
      expect(resolver.getRaceTitlesByMysqlIds).toHaveBeenCalledWith([
        140, 220,
      ]);
      const [, , raceTitlesByid] = alert.sendHourlyRecap.mock.calls[0];
      expect(raceTitlesByid).toBeInstanceOf(Map);
      expect(raceTitlesByid.get(140)).toBe('5BIB x COROS');
      expect(raceTitlesByid.get(220)).toBe(
        'LÀO CAI MARATHON 2026 - DÒNG CHẢY BIÊN CƯƠNG',
      );
    });
  });

  describe('TC-79-10 — 10x concurrent runHourlyRecap', () => {
    it('handles 10 concurrent calls without throwing', async () => {
      const { service, redisStore } = makeMocksWithResolver();
      redisStore.set(
        `invoice-reconcile:last-run:${today}`,
        JSON.stringify(cachedReport()),
      );
      const results = await Promise.all(
        Array.from({ length: 10 }, () => service.runHourlyRecap(today)),
      );
      // All should complete with report not-null
      results.forEach((r) => expect(r.report).not.toBeNull());
    });
  });

  describe('TC-79-11/12 — Resolver cache behavior delegated to F-049 (verify call)', () => {
    it('invokes resolver exactly once per tick (resolver internally caches)', async () => {
      const { service, redisStore, resolver } = makeMocksWithResolver();
      redisStore.set(
        `invoice-reconcile:last-run:${today}`,
        JSON.stringify(cachedReport()),
      );
      await service.runHourlyRecap(today);
      expect(resolver.getRaceTitlesByMysqlIds).toHaveBeenCalledTimes(1);
      // Note: TC-79-11 cache hit + TC-79-12 cache miss → Mongo fallback are
      // F-049 unit-tested in athlete-identity-clustering.service.spec.ts.
      // F-079 only verifies the integration call.
    });
  });

  describe('TC-79-13 — Resolver throws → graceful empty Map fallback (BR-79-23)', () => {
    it('catches error + sends Telegram with empty Map (composer falls back Race {id})', async () => {
      const { service, alert, redisStore } = makeMocksWithResolver({
        getRaceTitlesByMysqlIds: jest
          .fn()
          .mockRejectedValue(new Error('Mongo down')),
      });
      redisStore.set(
        `invoice-reconcile:last-run:${today}`,
        JSON.stringify(cachedReport()),
      );
      const result = await service.runHourlyRecap(today);
      // Heartbeat MUST still dispatch (defensive — KHÔNG block alert flow)
      expect(result.sent).toBe(true);
      const [, , raceTitlesByid] = alert.sendHourlyRecap.mock.calls[0];
      expect(raceTitlesByid).toBeInstanceOf(Map);
      expect(raceTitlesByid.size).toBe(0);
    });
  });

  describe('TC-79-14 — Resolver returns partial Map (some IDs missing)', () => {
    it('composer falls back Race {id} for missing entries (handled by composer test)', async () => {
      const { service, alert, redisStore } = makeMocksWithResolver({
        getRaceTitlesByMysqlIds: jest.fn().mockResolvedValue(
          // Only race 140 resolved, 220 missing
          new Map<number, string>([[140, '5BIB x COROS']]),
        ),
      });
      redisStore.set(
        `invoice-reconcile:last-run:${today}`,
        JSON.stringify(cachedReport({ raceIdsScanned: [140, 220] })),
      );
      await service.runHourlyRecap(today);
      const [, , raceTitlesByid] = alert.sendHourlyRecap.mock.calls[0];
      expect(raceTitlesByid.size).toBe(1);
      expect(raceTitlesByid.has(140)).toBe(true);
      expect(raceTitlesByid.has(220)).toBe(false);
      // Composer test TC-79-16 verifies Race 220 fallback render.
    });
  });

  describe('Resolver not wired (boot without RaceMasterDataModule)', () => {
    it('returns empty Map gracefully + heartbeat still sends', async () => {
      // makeMocksWithResolver returns shared redisStore-backed mock — populate
      // cached report directly via store, then construct fresh service without resolver.
      const { redisStore, redis } = makeMocksWithResolver();
      redisStore.set(
        `invoice-reconcile:last-run:${today}`,
        JSON.stringify(cachedReport()),
      );
      const orderRepo = { manager: { query: jest.fn() } } as any;
      const misa = {
        isConfigured: jest.fn().mockReturnValue(true),
        listInvoicesByDateRange: jest.fn().mockResolvedValue([]),
        getLastStatus: jest.fn().mockReturnValue('OK'),
      } as any;
      const counters = {
        increment: jest.fn(),
        getAll: jest.fn().mockResolvedValue({}),
      } as any;
      const standaloneAlert = {
        emitUrgentAlerts: jest.fn().mockResolvedValue({ sent: 0 }),
        sendHourlyRecap: jest.fn().mockResolvedValue(true),
        sendEodRecap: jest.fn().mockResolvedValue(true),
      } as any;
      const noResolverService = new InvoiceReconcileService(
        orderRepo,
        misa,
        standaloneAlert,
        counters,
        redis,
        // No 6th arg = no raceTitleResolver (Optional inject undefined)
      );
      const result = await noResolverService.runHourlyRecap(today);
      expect(result.sent).toBe(true);
      const [, , raceTitlesByid] = standaloneAlert.sendHourlyRecap.mock.calls[0];
      expect(raceTitlesByid).toBeInstanceOf(Map);
      expect(raceTitlesByid.size).toBe(0);
    });
  });
});

/**
 * F-080 — Layer 3 MySQL platform fallback trong resolveRaceTitlesSafe.
 *
 * Resolver chain: Redis(F-049) → MongoDB(F-049) → MySQL platform(F-080)
 * → composer fallback `Race {id}` (F-079 BR-79-23).
 *
 * Coverage: TC-80-01..07 per PRD.
 */
describe('F-080 — Layer 3 MySQL race title fallback', () => {
  const today = '2026-06-09';
  const TITLE_LCM = 'LÀO CAI MARATHON 2026 - DÒNG CHẢY BIÊN CƯƠNG';
  const TITLE_COROS = '5BIB x COROS';

  function makeF080Mocks(opts: {
    resolverResult?: Map<number, string> | Error;
    mysqlRows?: Array<{ raceId: number; title: string | null }> | Error;
    redisSetexThrows?: boolean;
  }) {
    const repoQuery = jest.fn();
    if (opts.mysqlRows instanceof Error) {
      repoQuery.mockRejectedValue(opts.mysqlRows);
    } else {
      repoQuery.mockResolvedValue(opts.mysqlRows ?? []);
    }
    const orderRepo = { manager: { query: repoQuery } } as any;
    const misa = {
      isConfigured: jest.fn().mockReturnValue(true),
      listInvoicesByDateRange: jest.fn().mockResolvedValue([]),
      getLastStatus: jest.fn().mockReturnValue('OK'),
    } as any;
    const alert = {
      emitUrgentAlerts: jest.fn().mockResolvedValue({ sent: 0 }),
      sendHourlyRecap: jest.fn().mockResolvedValue(true),
      sendEodRecap: jest.fn().mockResolvedValue(true),
    } as any;
    const counters = {
      increment: jest.fn(),
      getAll: jest.fn().mockResolvedValue({}),
    } as any;
    const redisStore = new Map<string, string>();
    const setexMock = opts.redisSetexThrows
      ? jest.fn().mockRejectedValue(new Error('redis down'))
      : jest.fn(async (k: string, _ttl: number, v: string) => {
          redisStore.set(k, v);
          return 'OK';
        });
    const redis = {
      get: jest.fn(async (k: string) => redisStore.get(k) ?? null),
      set: jest.fn(async (k: string, v: string) => {
        redisStore.set(k, v);
        return 'OK';
      }),
      setex: setexMock,
      del: jest.fn(async () => 1),
      ttl: jest.fn(async () => -1),
    } as any;
    const resolver = {
      getRaceTitlesByMysqlIds:
        opts.resolverResult instanceof Error
          ? jest.fn().mockRejectedValue(opts.resolverResult)
          : jest
              .fn()
              .mockResolvedValue(
                opts.resolverResult ?? new Map<number, string>(),
              ),
    } as any;
    const service = new InvoiceReconcileService(
      orderRepo,
      misa,
      alert,
      counters,
      redis,
      resolver,
    );
    // Seed cached report cho runHourlyRecap path
    redisStore.set(
      `invoice-reconcile:last-run:${today}`,
      JSON.stringify({
        date: today,
        runAt: '2026-06-09T07:00:00Z',
        mode: 'cron',
        raceIdsScanned: [140, 220],
        expectedCount: 29,
        issuedCount: 29,
        skippedCount: 0,
        missingCount: 0,
        atRiskCount: 0,
        duplicateCount: 0,
        breachedCount: 0,
        missing: [],
        misaOrphan: [],
        layer2Status: 'OK',
        maxSeverity: 'INFO',
        alertSent: false,
      }),
    );
    return { service, repoQuery, alert, redis, setexMock, resolver };
  }

  async function getDispatchedMap(mocks: {
    service: InvoiceReconcileService;
    alert: { sendHourlyRecap: jest.Mock };
  }): Promise<Map<number, string>> {
    await mocks.service.runHourlyRecap(today);
    return mocks.alert.sendHourlyRecap.mock.calls[0][2];
  }

  it('TC-80-01: F-049 đủ Map → MySQL KHÔNG query (BR-80-05)', async () => {
    const m = makeF080Mocks({
      resolverResult: new Map([
        [140, TITLE_COROS],
        [220, TITLE_LCM],
      ]),
    });
    const map = await getDispatchedMap(m);
    expect(map.size).toBe(2);
    expect(m.repoQuery).not.toHaveBeenCalled();
  });

  it('TC-80-02: F-049 empty → MySQL fills + Redis warm 2 lần TTL 3600', async () => {
    const m = makeF080Mocks({
      resolverResult: new Map(),
      mysqlRows: [
        { raceId: 140, title: TITLE_COROS },
        { raceId: 220, title: TITLE_LCM },
      ],
    });
    const map = await getDispatchedMap(m);
    expect(map.get(140)).toBe(TITLE_COROS);
    expect(map.get(220)).toBe(TITLE_LCM);
    expect(m.repoQuery).toHaveBeenCalledWith(
      expect.stringContaining('SELECT race_id AS raceId, title FROM races'),
      [[140, 220]],
    );
    expect(m.setexMock).toHaveBeenCalledWith(
      'races:title:byMysqlId:140',
      3600,
      TITLE_COROS,
    );
    expect(m.setexMock).toHaveBeenCalledWith(
      'races:title:byMysqlId:220',
      3600,
      TITLE_LCM,
    );
  });

  it('TC-80-03: F-049 partial (140 only) → MySQL query [220] only', async () => {
    const m = makeF080Mocks({
      resolverResult: new Map([[140, TITLE_COROS]]),
      mysqlRows: [{ raceId: 220, title: TITLE_LCM }],
    });
    const map = await getDispatchedMap(m);
    expect(map.size).toBe(2);
    expect(m.repoQuery).toHaveBeenCalledWith(expect.any(String), [[220]]);
  });

  it('TC-80-04: MySQL throw → partial F-049 giữ nguyên, KHÔNG throw', async () => {
    const m = makeF080Mocks({
      resolverResult: new Map([[140, TITLE_COROS]]),
      mysqlRows: new Error('mysql connection refused'),
    });
    const map = await getDispatchedMap(m);
    expect(map.size).toBe(1);
    expect(map.get(140)).toBe(TITLE_COROS);
    expect(map.has(220)).toBe(false);
  });

  it('TC-80-05: MySQL title rỗng → skip set + skip warm (BR-80-03)', async () => {
    const m = makeF080Mocks({
      resolverResult: new Map(),
      mysqlRows: [
        { raceId: 140, title: '   ' },
        { raceId: 220, title: TITLE_LCM },
      ],
    });
    const map = await getDispatchedMap(m);
    expect(map.has(140)).toBe(false);
    expect(map.get(220)).toBe(TITLE_LCM);
    expect(m.setexMock).toHaveBeenCalledTimes(1); // chỉ warm 220
  });

  it('TC-80-06: F-049 throw + MySQL throw → empty Map, heartbeat vẫn sent', async () => {
    const m = makeF080Mocks({
      resolverResult: new Error('mongo down'),
      mysqlRows: new Error('mysql down'),
    });
    const result = await m.service.runHourlyRecap(today);
    expect(result.sent).toBe(true); // BR-79-23 — KHÔNG block
    const map = m.alert.sendHourlyRecap.mock.calls[0][2];
    expect(map.size).toBe(0);
  });

  it('TC-80-07: Redis setex throw khi warm → Map VẪN filled, KHÔNG throw', async () => {
    const m = makeF080Mocks({
      resolverResult: new Map(),
      mysqlRows: [{ raceId: 220, title: TITLE_LCM }],
      redisSetexThrows: true,
    });
    const map = await getDispatchedMap(m);
    expect(map.get(220)).toBe(TITLE_LCM); // warm best-effort
  });
});
