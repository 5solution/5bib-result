/**
 * F-069 M2b-1 — QC ADVERSARIAL spec (No Mercy Protocol Phase 2/3).
 *
 * Probes gaps NOT covered by Coder's merchant-portal.service.spec.ts:
 *  - Attack #1: exclude precedence — raceId in BOTH include & exclude → MUST be excluded
 *  - Attack #2: include override pointing to a DRAFT race → MUST NOT be granted
 *    (admin cannot accidentally leak a draft via per-race include)
 *  - Attack #3: per-user cache isolation — cache key namespaced by userId (no IDOR bleed)
 *  - Attack #4: corrupt Redis payload → graceful fallback to source-of-truth (no crash)
 *  - Attack #5: getRaces tenant filter does NOT leak races of a tenant outside filter
 */

import { ForbiddenException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { getDataSourceToken } from '@nestjs/typeorm';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';
import { Test, TestingModule } from '@nestjs/testing';

import { FeeService } from '../../finance/services/fee.service';
import { MerchantPortalAccess } from '../schemas/merchant-portal-access.schema';
import { MerchantRaceTarget } from '../schemas/merchant-race-target.schema';
import { MerchantPortalService } from './merchant-portal.service';

function makeConfigDoc(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'logto_user_a',
    userName: 'Nguyễn Văn A',
    email: 'a@btc.vn',
    tenantIds: [42],
    raceOverrides: { include: [], exclude: [] },
    permissions: ['ticket_report'],
    isActive: true,
    ...overrides,
  };
}

describe('MerchantPortalService — ADVERSARIAL (QC)', () => {
  let service: MerchantPortalService;
  let mockModel: { findOne: jest.Mock };
  let mockTargetModel: { findOne: jest.Mock; findOneAndUpdate: jest.Mock };
  let mockDb: { query: jest.Mock };
  let mockRedis: { get: jest.Mock; set: jest.Mock; del: jest.Mock };
  let mockFee: { computeFeeForOrdersAggregate: jest.Mock };

  beforeEach(async () => {
    mockModel = { findOne: jest.fn() };
    mockTargetModel = {
      findOne: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(null) }),
      }),
      findOneAndUpdate: jest.fn().mockReturnValue({
        exec: () => Promise.resolve(null),
      }),
    };
    mockDb = { query: jest.fn() };
    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };
    mockFee = {
      computeFeeForOrdersAggregate: jest.fn().mockResolvedValue({
        tenantId: 42,
        totalServiceFee: 0,
        totalManualFee: 0,
        totalVat: 0,
        totalFee: 0,
        totalNetGmv: 0,
        feeSourceBreakdown: [],
        appliedOverrides: [],
        warnings: [],
      }),
    };
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        MerchantPortalService,
        { provide: getModelToken(MerchantPortalAccess.name), useValue: mockModel },
        { provide: getModelToken(MerchantRaceTarget.name), useValue: mockTargetModel },
        { provide: getDataSourceToken('platform'), useValue: mockDb },
        { provide: getRedisConnectionToken(), useValue: mockRedis },
        { provide: FeeService, useValue: mockFee },
      ],
    }).compile();
    service = moduleRef.get(MerchantPortalService);
  });

  function mockConfigFound(overrides: Record<string, unknown> = {}) {
    mockModel.findOne.mockReturnValue({
      lean: () => ({ exec: () => Promise.resolve(makeConfigDoc(overrides)) }),
    });
  }

  it('Attack #1 — exclude WINS over include (same raceId in both → excluded)', async () => {
    mockConfigFound({
      tenantIds: [],
      raceOverrides: { include: [601], exclude: [601] },
    });
    // include query returns the race (it exists, non-draft)
    mockDb.query.mockResolvedValueOnce([{ race_id: 601 }]);
    const set = await service.resolveAccessibleRaces('logto_user_a');
    expect(set.has(601)).toBe(false); // exclude applied LAST → wins
    expect(set.size).toBe(0);
  });

  it('Attack #2 — include override pointing to DRAFT race is NOT granted (SQL filters it)', async () => {
    mockConfigFound({
      tenantIds: [],
      raceOverrides: { include: [999], exclude: [] },
    });
    // race 999 is DRAFT → include query (which has status != 'DRAFT') returns EMPTY
    mockDb.query.mockResolvedValueOnce([]);
    const set = await service.resolveAccessibleRaces('logto_user_a');
    expect(set.has(999)).toBe(false);
    // Verify include query carries the draft filter (defense, not just empty mock)
    expect(mockDb.query.mock.calls[0][0]).toMatch(/status != 'DRAFT'/);
  });

  it('Attack #3 — cache key namespaced per-user (no cross-user IDOR bleed)', async () => {
    mockConfigFound({ tenantIds: [42] });
    mockDb.query.mockResolvedValueOnce([{ race_id: 501 }]);
    await service.resolveAccessibleRaces('logto_user_VICTIM');
    // every redis.get/set MUST contain the victim's userId, never a bare key
    const allKeys = [
      ...mockRedis.get.mock.calls.map((c) => c[0]),
      ...mockRedis.set.mock.calls.map((c) => c[0]),
    ];
    expect(allKeys.length).toBeGreaterThan(0);
    for (const k of allKeys) {
      expect(k).toContain('logto_user_VICTIM');
    }
  });

  it('Attack #4 — corrupt Redis payload → graceful fallback to DB, no crash', async () => {
    mockRedis.get.mockResolvedValue('{not-valid-json');
    mockConfigFound({ tenantIds: [42] });
    mockDb.query.mockResolvedValueOnce([{ race_id: 501 }]);
    const set = await service.resolveAccessibleRaces('logto_user_a');
    expect([...set]).toEqual([501]); // recovered from MySQL
  });

  it('Attack #5 — getRaces tenant filter does NOT return races of another tenant', async () => {
    // user has 2 tenants; filter to tenant 42; race 777 belongs to tenant 99
    mockConfigFound({ tenantIds: [42, 99] });
    mockDb.query
      .mockResolvedValueOnce([{ race_id: 501 }, { race_id: 777 }]) // resolve (both tenants)
      .mockResolvedValueOnce([
        {
          race_id: 501,
          title: 'Race tenant 42',
          status: 'COMPLETE',
          event_start_date: new Date('2026-01-01'),
          tenant_id: 42,
        },
      ]) // metadata query filtered AND r.tenant_id = 42 → only 501
      .mockResolvedValueOnce([{ race_id: 501, ticket_count: 10 }]);
    const result = await service.getRaces('logto_user_a', 42);
    expect(result.races.every((r) => r.tenantId === 42)).toBe(true);
    expect(result.races.find((r) => r.raceId === 777)).toBeUndefined();
    // Verify the metadata SQL actually carried the tenant filter param
    const metaCall = mockDb.query.mock.calls[1];
    expect(metaCall[0]).toMatch(/AND r\.tenant_id = \?/);
    expect(metaCall[1]).toContain(42);
  });

  it('Attack #5b — getRaces rejects tenantId outside user scope BEFORE any SQL', async () => {
    mockConfigFound({ tenantIds: [42] });
    await expect(service.getRaces('logto_user_a', 999)).rejects.toThrow(
      ForbiddenException,
    );
    // MUST short-circuit — no race resolution SQL leaked
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  // ── M2b-2 ticket-sales attack surface ──

  it('Attack #6 — ticket-sales raceId is a BOUND param, never string-interpolated (SQLi)', async () => {
    mockConfigFound({ tenantIds: [42] });
    mockDb.query
      .mockResolvedValueOnce([{ race_id: 501 }]) // scope
      .mockResolvedValueOnce([]); // summary
    await service.getTicketSalesSummary('logto_user_a', 501);
    const summaryCall = mockDb.query.mock.calls[1];
    expect(summaryCall[0]).toMatch(/om\.race_id = \?/); // placeholder, not value
    expect(summaryCall[0]).not.toMatch(/501/); // raceId NOT baked into SQL text
    expect(summaryCall[1]).toEqual([501]); // value via params array
  });

  it('Attack #7 — ticket-sales cache keys namespaced per-user AND per-race (no bleed)', async () => {
    mockConfigFound({ tenantIds: [42] });
    mockDb.query
      .mockResolvedValueOnce([{ race_id: 501 }])
      .mockResolvedValueOnce([]);
    await service.getTicketSalesByCourse('logto_user_VICTIM', 501);
    const ticketKeys = [
      ...mockRedis.get.mock.calls.map((c) => c[0]),
      ...mockRedis.set.mock.calls.map((c) => c[0]),
    ].filter((k) => k.includes('ticket-by-course'));
    expect(ticketKeys.length).toBeGreaterThan(0);
    for (const k of ticketKeys) {
      expect(k).toContain('logto_user_VICTIM'); // per-user
      expect(k).toContain('501'); // per-race — a different race can't read this
    }
  });

  it('Attack #8 — corrupt ticket-sales cache → recompute, no crash', async () => {
    mockConfigFound({ tenantIds: [42] });
    mockRedis.get
      .mockResolvedValueOnce(JSON.stringify([501])) // scope cache OK
      .mockResolvedValueOnce('{broken-json'); // summary cache corrupt
    mockDb.query.mockResolvedValueOnce([
      { financial_status: 'paid', order_count: 3, ticket_count: 4 },
    ]);
    const r = await service.getTicketSalesSummary('logto_user_a', 501);
    expect(r.totalTickets).toBe(4); // recovered from DB
  });

  // ── M2b-3 revenue attack surface ──

  it('Attack #9 — viewer (ticket_report only) CANNOT reach revenue (perm gate before SQL)', async () => {
    // Even if guard were bypassed, service-layer permission check blocks viewer.
    mockConfigFound({ tenantIds: [42], permissions: ['ticket_report'] });
    await expect(
      service.getRevenueSummary('logto_user_a', 501),
    ).rejects.toThrow(ForbiddenException);
    expect(mockDb.query).not.toHaveBeenCalled(); // zero data access for unauthorized
  });

  it('Attack #10 — revenue cache key namespaced per-user+per-race (no cross bleed)', async () => {
    mockConfigFound({ tenantIds: [42], permissions: ['revenue_report'] });
    mockDb.query
      .mockResolvedValueOnce([{ race_id: 501 }]) // scope
      .mockResolvedValueOnce([]); // no orders
    await service.getRevenueSummary('logto_user_VICTIM', 501);
    const revKeys = [
      ...mockRedis.get.mock.calls.map((c) => c[0]),
      ...mockRedis.set.mock.calls.map((c) => c[0]),
    ].filter((k) => k.includes('revenue-summary'));
    expect(revKeys.length).toBeGreaterThan(0);
    for (const k of revKeys) {
      expect(k).toContain('logto_user_VICTIM');
      expect(k).toContain('501');
    }
  });

  // ── M2b-3b cross-tenant + breakdown attack surface ──

  it('Attack #11 — aggregate EXCLUDES an exclude-override race (no revenue leak)', async () => {
    // accessible resolves to {501} only (502 excluded). Tenant pull returns BOTH.
    mockConfigFound({
      tenantIds: [42],
      permissions: ['revenue_report'],
      raceOverrides: { include: [], exclude: [502] },
    });
    mockDb.query.mockResolvedValueOnce([{ race_id: 501 }, { race_id: 502 }]); // tenant races
    // (resolveAccessibleRaces then subtracts 502 → accessible = {501})
    mockDb.query.mockResolvedValueOnce([
      { id: 1, tenant_id: 42, race_id: 501, total_price: 100000, total_discounts: 0, order_category: 'ORDINARY', payment_on: new Date(), payment_ref: 'r1', manual_ticket_count: 1 },
      { id: 2, tenant_id: 42, race_id: 502, total_price: 888888, total_discounts: 0, order_category: 'ORDINARY', payment_on: new Date(), payment_ref: 'r2', manual_ticket_count: 1 },
    ]);
    mockFee.computeFeeForOrdersAggregate.mockResolvedValueOnce({
      tenantId: 42, totalServiceFee: 5500, totalManualFee: 0, totalVat: 0, totalFee: 5500, totalNetGmv: 0, feeSourceBreakdown: [], appliedOverrides: [], warnings: [],
    });
    const r = await service.getRevenueAggregate('logto_user_a');
    expect(r.gmv).toBe(100000); // 502's 888888 MUST be excluded
    expect(r.byTenant[0].orderCount).toBe(1);
  });

  it('Attack #12 — by-category viewer (no revenue_report) → 403, zero data', async () => {
    mockConfigFound({ tenantIds: [42], permissions: ['ticket_report'] });
    await expect(
      service.getRevenueByCategory('logto_user_a', 501),
    ).rejects.toThrow(ForbiddenException);
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  // ── M2b-2b ticket-chart attack surface ──

  it('Attack #13 — order-table SQL: total_price NEVER selected (financial); email/phone allowed (Danny show-full)', async () => {
    mockConfigFound({ tenantIds: [42] });
    mockDb.query
      .mockResolvedValueOnce([{ race_id: 138 }]) // scope
      .mockResolvedValueOnce([{ total: 0 }]) // count
      .mockResolvedValueOnce([]); // rows
    await service.getTicketSalesOrders('logto_user_a', 138, 1, 20);
    const dataSql = (mockDb.query.mock.calls[2][0] as string);
    // FINANCIAL still forbidden (BR-MP-09 ticket module = no money)
    expect(dataSql).not.toMatch(/om\.total_price/);
    expect(dataSql).not.toMatch(/om\.total_discounts/);
    // buyer contact INCLUDED per Danny 2026-06-05 (BTC owns race customer data)
    expect(dataSql).toMatch(/om\.first_name/);
    expect(dataSql).toMatch(/om\.email/);
    expect(dataSql).toMatch(/om\.phone_number/);
  });

  it('Attack #14 — ticket-trend cache key namespaced per-user+race+period+granularity', async () => {
    mockConfigFound({ tenantIds: [42] });
    mockDb.query
      .mockResolvedValueOnce([{ race_id: 138 }])
      .mockResolvedValueOnce([]);
    await service.getTicketSalesTrend('logto_user_VICTIM', 138, '30d', 'daily', new Date('2026-03-15T00:00:00Z'));
    const keys = [
      ...mockRedis.get.mock.calls.map((c) => c[0]),
      ...mockRedis.set.mock.calls.map((c) => c[0]),
    ].filter((k) => k.includes('ticket-trend'));
    expect(keys.length).toBeGreaterThan(0);
    for (const k of keys) {
      expect(k).toContain('logto_user_VICTIM');
      expect(k).toContain('138');
      expect(k).toContain('daily');
    }
  });

  // ── F-070 adversarial ──────────────────────────────────────────

  it('Attack #15 — forecast NEVER leaks financial fields (gmv/fee/price)', async () => {
    mockConfigFound({ tenantIds: [42] });
    mockDb.query
      .mockResolvedValueOnce([{ race_id: 138 }])
      .mockResolvedValueOnce([
        { d: '2026-03-01', n: 5 },
        { d: '2026-03-02', n: 5 },
        { d: '2026-03-03', n: 5 },
        { d: '2026-03-04', n: 5 },
        { d: '2026-03-05', n: 5 },
        { d: '2026-03-06', n: 5 },
        { d: '2026-03-07', n: 5 },
        { d: '2026-03-08', n: 5 },
      ])
      .mockResolvedValueOnce([
        { event_start_date: new Date('2026-04-01T00:00:00Z'), status: 'ONGOING' },
      ]);
    const r = await service.getTicketForecast(
      'logto_user_a',
      138,
      new Date('2026-03-10T00:00:00Z'),
    );
    expect(JSON.stringify(r)).not.toMatch(/gmv|fee|price|total_price|net\b/i);
    // forecast SQL parameterizes raceId (no interpolation)
    expect(mockDb.query.mock.calls[1][1]).toEqual([138]);
    expect(mockDb.query.mock.calls[1][0]).toContain('?');
  });

  it('Attack #16 — heatmap dow=0/8 (out-of-range) defensively skipped, no crash', async () => {
    mockConfigFound({ tenantIds: [42] });
    mockDb.query
      .mockResolvedValueOnce([{ race_id: 138 }])
      .mockResolvedValueOnce([
        { dow: 0, hr: 5, n: 99 }, // invalid dow → skipped
        { dow: 8, hr: 5, n: 99 }, // invalid dow → skipped
        { dow: 2, hr: 25, n: 99 }, // invalid hr → skipped
        { dow: 2, hr: 5, n: 7 }, // valid Mon 05h → row0 bucket0
      ]);
    const r = await service.getTicketHeatmap('logto_user_a', 138);
    expect(r.grid[0][0]).toBe(7);
    expect(r.max).toBe(7); // the 99s never landed
  });

  it('Attack #17 — setTicketTarget cannot upsert a race OUTSIDE access (IDOR pre-check)', async () => {
    mockConfigFound({ tenantIds: [42] });
    mockDb.query.mockResolvedValueOnce([{ race_id: 138 }]); // accessible {138}
    await expect(
      service.setTicketTarget('logto_user_a', { raceId: 7777, target: 9000 }),
    ).rejects.toThrow(ForbiddenException);
    expect(mockTargetModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('Attack #18 — corrupt forecast cache payload → graceful fallback recompute, no crash', async () => {
    mockConfigFound({ tenantIds: [42] });
    mockRedis.get.mockImplementation((key: string) => {
      if (key === 'merchant-portal:forecast:138') {
        return Promise.resolve('{not json'); // poisoned entry
      }
      return Promise.resolve(null);
    });
    mockDb.query
      .mockResolvedValueOnce([{ race_id: 138 }])
      .mockResolvedValueOnce([{ d: '2026-03-01', n: 3 }])
      .mockResolvedValueOnce([
        { event_start_date: new Date('2026-04-01T00:00:00Z'), status: 'ONGOING' },
      ]);
    const r = await service.getTicketForecast(
      'logto_user_a',
      138,
      new Date('2026-03-10T00:00:00Z'),
    );
    // Recomputed from DB despite corrupt cache.
    expect(r.cumulative).toEqual([{ date: '2026-03-01', value: 3 }]);
    // And refreshed the poisoned key.
    expect(mockRedis.set).toHaveBeenCalledWith(
      'merchant-portal:forecast:138',
      expect.any(String),
      'EX',
      300,
    );
  });
});
