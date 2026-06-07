/**
 * F-069 M2b-1 — MerchantPortalService unit tests.
 *
 * Coverage (BR-MP-05/06/26 + R3 schema):
 *  - getAccessConfig: cache hit/miss, 404 no config, 403 inactive
 *  - resolveAccessibleRaces: tenant scope, include ∪, exclude −, draft filter,
 *    cache hit, empty set
 *  - assertRaceAccessible: IDOR 403
 *  - getMe: profile + real assignedRaceCount
 *  - getRaces: enriched list + ticket count + tenantId cross-scope 403
 *
 * MySQL via mocked DataSource.query (R3 canonical SQL). Redis mocked.
 */

import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { getDataSourceToken } from '@nestjs/typeorm';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';
import { Test, TestingModule } from '@nestjs/testing';

import { FeeService } from '../../finance/services/fee.service';
import type { LogtoUser } from '../../logto-auth/types';
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

describe('MerchantPortalService', () => {
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
      get: jest.fn().mockResolvedValue(null), // default cache miss
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

  // ──────────────────────────────────────────────────────────
  // getAccessConfig
  // ──────────────────────────────────────────────────────────
  describe('getAccessConfig()', () => {
    it('happy path → returns config + caches 300s', async () => {
      mockConfigFound();
      const cfg = await service.getAccessConfig('logto_user_a');
      expect(cfg.userId).toBe('logto_user_a');
      expect(cfg.tenantIds).toEqual([42]);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'merchant-portal:access:logto_user_a',
        expect.any(String),
        'EX',
        300,
      );
    });

    it('cache hit → returns cached, no Mongo query', async () => {
      mockRedis.get.mockResolvedValue(
        JSON.stringify({
          userId: 'logto_user_a',
          userName: 'A',
          email: 'a@b.com',
          tenantIds: [42],
          include: [],
          exclude: [],
          permissions: ['ticket_report'],
          isActive: true,
        }),
      );
      const cfg = await service.getAccessConfig('logto_user_a');
      expect(cfg.tenantIds).toEqual([42]);
      expect(mockModel.findOne).not.toHaveBeenCalled();
    });

    it('no config → 404 `404_NO_CONFIG`', async () => {
      mockModel.findOne.mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(null) }),
      });
      await expect(service.getAccessConfig('logto_unknown')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('inactive config → 403 `403_INACTIVE`', async () => {
      mockConfigFound({ isActive: false });
      await expect(service.getAccessConfig('logto_user_a')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('inactive from cache → still 403 (assertActive on cache path)', async () => {
      mockRedis.get.mockResolvedValue(
        JSON.stringify({
          userId: 'x',
          userName: 'X',
          email: 'x@b.com',
          tenantIds: [42],
          include: [],
          exclude: [],
          permissions: ['ticket_report'],
          isActive: false,
        }),
      );
      await expect(service.getAccessConfig('x')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ──────────────────────────────────────────────────────────
  // resolveAccessibleRaces
  // ──────────────────────────────────────────────────────────
  describe('resolveAccessibleRaces()', () => {
    it('tenant scope only → Set of non-draft tenant races', async () => {
      mockConfigFound({ tenantIds: [42] });
      mockDb.query.mockResolvedValueOnce([
        { race_id: 501 },
        { race_id: 502 },
      ]); // tenant races
      const set = await service.resolveAccessibleRaces('logto_user_a');
      expect([...set].sort()).toEqual([501, 502]);
      // Verify SQL filters draft + is_delete
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("status != 'DRAFT'"),
        [42],
      );
    });

    it('include override → adds races outside tenant', async () => {
      mockConfigFound({
        tenantIds: [42],
        raceOverrides: { include: [601], exclude: [] },
      });
      mockDb.query
        .mockResolvedValueOnce([{ race_id: 501 }]) // tenant races
        .mockResolvedValueOnce([{ race_id: 601 }]); // validated include
      const set = await service.resolveAccessibleRaces('logto_user_a');
      expect([...set].sort()).toEqual([501, 601]);
    });

    it('exclude override → removes race from set', async () => {
      mockConfigFound({
        tenantIds: [42],
        raceOverrides: { include: [], exclude: [502] },
      });
      mockDb.query.mockResolvedValueOnce([
        { race_id: 501 },
        { race_id: 502 },
      ]);
      const set = await service.resolveAccessibleRaces('logto_user_a');
      expect([...set]).toEqual([501]);
      expect(set.has(502)).toBe(false);
    });

    it('draft races never in set (SQL filter) — verified via excluded result', async () => {
      mockConfigFound({ tenantIds: [42] });
      // SQL already filters DRAFT — mock returns only non-draft
      mockDb.query.mockResolvedValueOnce([{ race_id: 501 }]);
      const set = await service.resolveAccessibleRaces('logto_user_a');
      expect(set.has(501)).toBe(true);
      // assert SQL contains draft filter (proves filter applied at query level)
      expect(mockDb.query.mock.calls[0][0]).toMatch(/status != 'DRAFT'/);
    });

    it('cache hit → returns cached Set, no SQL', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify([501, 502]));
      const set = await service.resolveAccessibleRaces('logto_user_a');
      expect([...set].sort()).toEqual([501, 502]);
      expect(mockDb.query).not.toHaveBeenCalled();
      expect(mockModel.findOne).not.toHaveBeenCalled();
    });

    it('empty scope (no tenant, no include) → empty Set', async () => {
      mockConfigFound({
        tenantIds: [],
        raceOverrides: { include: [], exclude: [] },
      });
      const set = await service.resolveAccessibleRaces('logto_user_a');
      expect(set.size).toBe(0);
      expect(mockDb.query).not.toHaveBeenCalled(); // no tenant + no include → skip SQL
    });

    it('inactive user → 403 (via getAccessConfig)', async () => {
      mockConfigFound({ isActive: false });
      await expect(
        service.resolveAccessibleRaces('logto_user_a'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ──────────────────────────────────────────────────────────
  // assertRaceAccessible (IDOR BR-MP-06)
  // ──────────────────────────────────────────────────────────
  describe('assertRaceAccessible()', () => {
    it('race in set → no throw', () => {
      const set = new Set([501, 502]);
      expect(() => service.assertRaceAccessible(set, 501)).not.toThrow();
    });

    it('race NOT in set → 403 `403_NO_RACE` (IDOR)', () => {
      const set = new Set([501]);
      expect(() => service.assertRaceAccessible(set, 999)).toThrow(
        ForbiddenException,
      );
    });
  });

  // ──────────────────────────────────────────────────────────
  // getMe
  // ──────────────────────────────────────────────────────────
  describe('getMe()', () => {
    it('returns profile + real assignedRaceCount + NO financial fields', async () => {
      mockConfigFound({ tenantIds: [42], permissions: ['ticket_report'] });
      mockDb.query.mockResolvedValueOnce([
        { race_id: 501 },
        { race_id: 502 },
      ]);
      const user = { userId: 'logto_user_a' } as LogtoUser;
      const me = await service.getMe(user);
      expect(me.assignedRaceCount).toBe(2);
      expect(me.permissions).toEqual(['ticket_report']);
      expect(me.tenantIds).toEqual([42]);
      // MUST NOT leak
      expect(me).not.toHaveProperty('gmv');
      expect(me).not.toHaveProperty('_id');
      expect(me).not.toHaveProperty('createdBy');
    });
  });

  // ──────────────────────────────────────────────────────────
  // getRaces
  // ──────────────────────────────────────────────────────────
  describe('getRaces()', () => {
    it('returns enriched race list + ticket count', async () => {
      mockConfigFound({ tenantIds: [42] });
      mockDb.query
        .mockResolvedValueOnce([{ race_id: 501 }, { race_id: 502 }]) // resolveAccessibleRaces tenant
        .mockResolvedValueOnce([
          {
            race_id: 501,
            title: 'Trail Đà Lạt 2026',
            status: 'GENERATED_CODE',
            event_start_date: new Date('2026-08-01'),
            tenant_id: 42,
          },
          {
            race_id: 502,
            title: 'Marathon Sài Gòn',
            status: 'COMPLETE',
            event_start_date: new Date('2026-03-01'),
            tenant_id: 42,
          },
        ]) // race metadata
        .mockResolvedValueOnce([
          { race_id: 501, ticket_count: 1234 },
          { race_id: 502, ticket_count: 5678 },
        ]); // ticket counts
      const result = await service.getRaces('logto_user_a');
      expect(result.total).toBe(2);
      expect(result.races[0].ticketsSold).toBe(1234);
      expect(result.races[0].status).toBe('GENERATED_CODE');
      // NO financial fields leaked
      expect(result.races[0]).not.toHaveProperty('gmv');
      expect(result.races[0]).not.toHaveProperty('total_price');
    });

    it('tenantId not in user scope → 403 `403_NO_TENANT`', async () => {
      mockConfigFound({ tenantIds: [42] });
      await expect(service.getRaces('logto_user_a', 99)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('empty accessible set → empty list (no metadata query)', async () => {
      mockConfigFound({
        tenantIds: [],
        raceOverrides: { include: [], exclude: [] },
      });
      const result = await service.getRaces('logto_user_a');
      expect(result.races).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('race with 0 paid tickets → ticketsSold 0 (LEFT JOIN COALESCE)', async () => {
      mockConfigFound({ tenantIds: [42] });
      mockDb.query
        .mockResolvedValueOnce([{ race_id: 501 }]) // resolve
        .mockResolvedValueOnce([
          {
            race_id: 501,
            title: 'New Race',
            status: 'GENERATED_CODE',
            event_start_date: new Date('2026-12-01'),
            tenant_id: 42,
          },
        ]) // metadata
        .mockResolvedValueOnce([]); // no ticket rows
      const result = await service.getRaces('logto_user_a');
      expect(result.races[0].ticketsSold).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────────
  // M2b-2 — Ticket Sales (summary + course/type breakdown)
  // ──────────────────────────────────────────────────────────
  describe('getTicketSalesSummary()', () => {
    // helper: scope resolution (config + tenant-race query) returns race 501
    function mockScope501() {
      mockConfigFound({ tenantIds: [42] });
      mockDb.query.mockResolvedValueOnce([{ race_id: 501 }]); // resolveAccessibleRaces
    }

    it('happy path → totalTickets all-status + byStatus has 3 canonical', async () => {
      mockScope501();
      mockDb.query.mockResolvedValueOnce([
        { financial_status: 'paid', order_count: 1000, ticket_count: 1500 },
        { financial_status: 'voided', order_count: 200, ticket_count: 300 },
      ]); // summary query (no pending row)
      const r = await service.getTicketSalesSummary('logto_user_a', 501);
      expect(r.raceId).toBe(501);
      expect(r.totalTickets).toBe(1800); // 1500 + 300 (+ 0 pending)
      expect(r.totalOrders).toBe(1200);
      // 3 canonical always present, in order, pending 0-filled
      expect(r.byStatus.map((b) => b.financialStatus)).toEqual([
        'paid',
        'voided',
        'pending',
      ]);
      expect(r.byStatus[2]).toEqual({
        financialStatus: 'pending',
        orderCount: 0,
        ticketCount: 0,
      });
    });

    it('unknown status from DB → appended after canonical 3', async () => {
      mockScope501();
      mockDb.query.mockResolvedValueOnce([
        { financial_status: 'paid', order_count: 10, ticket_count: 10 },
        { financial_status: 'weird', order_count: 1, ticket_count: 2 },
      ]);
      const r = await service.getTicketSalesSummary('logto_user_a', 501);
      expect(r.byStatus.map((b) => b.financialStatus)).toEqual([
        'paid',
        'voided',
        'pending',
        'weird',
      ]);
      expect(r.totalTickets).toBe(12);
    });

    it('empty race → all zero, no leak', async () => {
      mockScope501();
      mockDb.query.mockResolvedValueOnce([]); // no orders
      const r = await service.getTicketSalesSummary('logto_user_a', 501);
      expect(r.totalTickets).toBe(0);
      expect(r.byStatus).toHaveLength(3);
      expect(r).not.toHaveProperty('gmv');
      expect(r).not.toHaveProperty('total_price');
    });

    it('IDOR → race NOT in scope → 403 before summary SQL', async () => {
      mockConfigFound({ tenantIds: [42] });
      mockDb.query.mockResolvedValueOnce([{ race_id: 501 }]); // scope = {501}
      await expect(
        service.getTicketSalesSummary('logto_user_a', 999),
      ).rejects.toThrow(ForbiddenException);
      // only the resolve query ran — summary SQL NOT reached
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('cache hit → returns cached, no scope/SQL re-run', async () => {
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify([501])) // resolveAccessibleRaces cache
        .mockResolvedValueOnce(
          JSON.stringify({
            raceId: 501,
            totalTickets: 5,
            totalOrders: 5,
            byStatus: [],
          }),
        ); // summary cache
      mockConfigFound({ tenantIds: [42] });
      const r = await service.getTicketSalesSummary('logto_user_a', 501);
      expect(r.totalTickets).toBe(5);
      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  describe('getTicketSalesByCourse()', () => {
    it('groups by course, dup names kept distinct (by id), sorted, total base', async () => {
      mockConfigFound({ tenantIds: [42] });
      mockDb.query
        .mockResolvedValueOnce([{ race_id: 501 }]) // scope
        .mockResolvedValueOnce([
          { course_id: 540, course_name: '2,9 km', order_count: 100, ticket_count: 150 },
          { course_id: 515, course_name: '2,9 km', order_count: 50, ticket_count: 80 },
        ]); // two distinct courses, same label
      const r = await service.getTicketSalesByCourse('logto_user_a', 501);
      expect(r.items).toHaveLength(2);
      expect(r.items.map((i) => i.id)).toEqual([540, 515]); // distinct ids preserved
      expect(r.totalTickets).toBe(230);
      expect(r).not.toHaveProperty('total_price');
    });

    it('IDOR → 403 before breakdown SQL', async () => {
      mockConfigFound({ tenantIds: [42] });
      mockDb.query.mockResolvedValueOnce([{ race_id: 501 }]);
      await expect(
        service.getTicketSalesByCourse('logto_user_a', 999),
      ).rejects.toThrow(ForbiddenException);
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('SQL uses paid filter + chain (not om.race_course_id)', async () => {
      mockConfigFound({ tenantIds: [42] });
      mockDb.query
        .mockResolvedValueOnce([{ race_id: 501 }])
        .mockResolvedValueOnce([]);
      await service.getTicketSalesByCourse('logto_user_a', 501);
      const sql = mockDb.query.mock.calls[1][0] as string;
      expect(sql).toMatch(/financial_status = 'paid'/);
      expect(sql).toMatch(/JOIN ticket_type tt/);
      expect(sql).toMatch(/JOIN race_course rc/);
      expect(sql).not.toMatch(/om\.race_course_id/); // DISC-1 — must NOT exist
    });
  });

  describe('getTicketSalesByType()', () => {
    it('groups by ticket type, type_name display, sorted DESC', async () => {
      mockConfigFound({ tenantIds: [42] });
      mockDb.query
        .mockResolvedValueOnce([{ race_id: 501 }])
        .mockResolvedValueOnce([
          { ticket_type_id: 7, ticket_type_name: 'Standard 21K', order_count: 200, ticket_count: 260 },
          { ticket_type_id: 9, ticket_type_name: 'VIP 21K', order_count: 10, ticket_count: 12 },
        ]);
      const r = await service.getTicketSalesByType('logto_user_a', 501);
      expect(r.items[0].name).toBe('Standard 21K');
      expect(r.items[0].id).toBe(7);
      expect(r.totalTickets).toBe(272);
    });

    it('null type_name → empty string fallback', async () => {
      mockConfigFound({ tenantIds: [42] });
      mockDb.query
        .mockResolvedValueOnce([{ race_id: 501 }])
        .mockResolvedValueOnce([
          { ticket_type_id: 7, ticket_type_name: null, order_count: 1, ticket_count: 1 },
        ]);
      const r = await service.getTicketSalesByType('logto_user_a', 501);
      expect(r.items[0].name).toBe('');
    });
  });

  // ──────────────────────────────────────────────────────────
  // M2b-3 — Revenue (permission-gated, GMV + fee + net)
  // ──────────────────────────────────────────────────────────
  describe('getRevenueSummary()', () => {
    // raw rows in the shape pullOrdersForFeeAggregate expects from db.query
    const ordersRows = [
      {
        id: 1,
        tenant_id: 42,
        race_id: 501,
        total_price: 100000,
        total_discounts: 10000,
        order_category: 'ORDINARY',
        payment_on: new Date('2026-03-01'),
        payment_ref: 'ref1',
        manual_ticket_count: 2,
      },
      {
        id: 2,
        tenant_id: 42,
        race_id: 501,
        total_price: 60000,
        total_discounts: 0,
        order_category: 'ORDINARY',
        payment_on: new Date('2026-03-02'),
        payment_ref: 'ref2',
        manual_ticket_count: 1,
      },
    ];

    it('happy path → GMV = Σ(price−discount), net = GMV − fee', async () => {
      mockConfigFound({ tenantIds: [42], permissions: ['ticket_report', 'revenue_report'] });
      mockDb.query
        .mockResolvedValueOnce([{ race_id: 501 }]) // resolveAccessibleRaces
        .mockResolvedValueOnce(ordersRows); // pullOrdersForFeeAggregate
      mockFee.computeFeeForOrdersAggregate.mockResolvedValueOnce({
        tenantId: 42,
        totalServiceFee: 8000,
        totalManualFee: 0,
        totalVat: 800,
        totalFee: 8800,
        totalNetGmv: 0,
        feeSourceBreakdown: [],
        appliedOverrides: [],
        warnings: [],
      });
      const r = await service.getRevenueSummary('logto_user_a', 501);
      // GMV = (100000-10000) + (60000-0) = 150000
      expect(r.gmv).toBe(150000);
      expect(r.totalFee).toBe(8800);
      expect(r.net).toBe(150000 - 8800);
      expect(r.orderCount).toBe(2);
      expect(r.raceId).toBe(501);
    });

    it('viewer WITHOUT revenue_report permission → 403 before any SQL', async () => {
      mockConfigFound({ tenantIds: [42], permissions: ['ticket_report'] }); // no revenue_report
      await expect(
        service.getRevenueSummary('logto_user_a', 501),
      ).rejects.toThrow(ForbiddenException);
      expect(mockDb.query).not.toHaveBeenCalled(); // short-circuit, no data pulled
    });

    it('IDOR → race not accessible → 403, no orders pulled', async () => {
      mockConfigFound({ tenantIds: [42], permissions: ['revenue_report'] });
      mockDb.query.mockResolvedValueOnce([{ race_id: 501 }]); // scope = {501}
      await expect(
        service.getRevenueSummary('logto_user_a', 999),
      ).rejects.toThrow(ForbiddenException);
      // only resolve query ran (revenue pull NOT reached)
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('missing MerchantConfig → propagates FeeService Tier-3 warning', async () => {
      mockConfigFound({ tenantIds: [42], permissions: ['revenue_report'] });
      mockDb.query
        .mockResolvedValueOnce([{ race_id: 501 }])
        .mockResolvedValueOnce(ordersRows);
      mockFee.computeFeeForOrdersAggregate.mockResolvedValueOnce({
        tenantId: 42,
        totalServiceFee: 8250,
        totalManualFee: 0,
        totalVat: 0,
        totalFee: 8250,
        totalNetGmv: 0,
        feeSourceBreakdown: [],
        appliedOverrides: [],
        warnings: ['MerchantConfig không tồn tại cho tenantId=42 — fallback Tier 3'],
      });
      const r = await service.getRevenueSummary('logto_user_a', 501);
      expect(r.warnings.length).toBeGreaterThan(0);
      expect(r.warnings[0]).toMatch(/Tier 3/);
    });

    it('empty race (no paid orders) → all zero, no leak', async () => {
      mockConfigFound({ tenantIds: [42], permissions: ['revenue_report'] });
      mockDb.query
        .mockResolvedValueOnce([{ race_id: 501 }])
        .mockResolvedValueOnce([]); // no orders
      const r = await service.getRevenueSummary('logto_user_a', 501);
      expect(r.gmv).toBe(0);
      expect(r.totalFee).toBe(0);
      expect(r.net).toBe(0);
      expect(r.orderCount).toBe(0);
      expect(mockFee.computeFeeForOrdersAggregate).not.toHaveBeenCalled(); // no tenant in map
    });

    it('inactive account → 403 (via getAccessConfig) before permission check', async () => {
      mockConfigFound({ isActive: false, permissions: ['revenue_report'] });
      await expect(
        service.getRevenueSummary('logto_user_a', 501),
      ).rejects.toThrow(ForbiddenException);
    });

    it('cache hit → returns cached revenue, no fee recompute', async () => {
      // getRevenueSummary reads 3 caches in order: access → races → revenue
      mockRedis.get
        .mockResolvedValueOnce(
          JSON.stringify({
            userId: 'logto_user_a',
            userName: 'A',
            email: 'a@b.com',
            tenantIds: [42],
            include: [],
            exclude: [],
            permissions: ['revenue_report'],
            isActive: true,
          }),
        ) // access config cache hit
        .mockResolvedValueOnce(JSON.stringify([501])) // resolveAccessibleRaces cache hit
        .mockResolvedValueOnce(
          JSON.stringify({ raceId: 501, gmv: 150000, totalFee: 8800, net: 141200, orderCount: 2, totalServiceFee: 8000, totalManualFee: 0, totalVat: 800, warnings: [] }),
        ); // revenue cache hit
      const r = await service.getRevenueSummary('logto_user_a', 501);
      expect(r.net).toBe(141200);
      expect(mockFee.computeFeeForOrdersAggregate).not.toHaveBeenCalled();
      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────
  // M2b-3b — Revenue breakdown (Option A) + cross-tenant aggregate
  // ──────────────────────────────────────────────────────────
  describe('getRevenueByCategory()', () => {
    function rows() {
      return [
        { id: 1, tenant_id: 42, race_id: 501, total_price: 100000, total_discounts: 0, order_category: 'ORDINARY', payment_on: new Date(), payment_ref: 'r1', manual_ticket_count: 1 },
        { id: 2, tenant_id: 42, race_id: 501, total_price: 50000, total_discounts: 0, order_category: 'MANUAL', payment_on: new Date(), payment_ref: null, manual_ticket_count: 2 },
        { id: 3, tenant_id: 42, race_id: 501, total_price: 30000, total_discounts: 0, order_category: null, payment_on: new Date(), payment_ref: 'r3', manual_ticket_count: 1 },
      ];
    }

    it('Option A grouping → MANUAL=fee_fixed, ORDINARY+null=fee_percent', async () => {
      mockConfigFound({ tenantIds: [42], permissions: ['revenue_report'] });
      mockDb.query
        .mockResolvedValueOnce([{ race_id: 501 }]) // scope
        .mockResolvedValueOnce(rows()); // pullOrders
      // FeeService called per group — return distinct fee per call
      mockFee.computeFeeForOrdersAggregate
        .mockResolvedValueOnce({ tenantId: 42, totalServiceFee: 7000, totalManualFee: 0, totalVat: 0, totalFee: 7000, totalNetGmv: 0, feeSourceBreakdown: [], appliedOverrides: [], warnings: [] }) // fee_percent group
        .mockResolvedValueOnce({ tenantId: 42, totalServiceFee: 0, totalManualFee: 5000, totalVat: 0, totalFee: 5000, totalNetGmv: 0, feeSourceBreakdown: [], appliedOverrides: [], warnings: [] }); // fee_fixed group
      const r = await service.getRevenueByCategory('logto_user_a', 501);
      const pct = r.groups.find((g) => g.groupKey === 'fee_percent')!;
      const fix = r.groups.find((g) => g.groupKey === 'fee_fixed')!;
      expect(pct.gmv).toBe(130000); // ORDINARY 100k + null 30k
      expect(fix.gmv).toBe(50000); // MANUAL
      expect(pct.orderCount).toBe(2);
      expect(fix.orderCount).toBe(1);
      expect(fix.totalFee).toBe(5000);
      expect(fix.net).toBe(45000);
      expect(r.gmv).toBe(180000);
    });

    it('always emits BOTH groups (0-fill when a group empty)', async () => {
      mockConfigFound({ tenantIds: [42], permissions: ['revenue_report'] });
      mockDb.query
        .mockResolvedValueOnce([{ race_id: 501 }])
        .mockResolvedValueOnce([
          { id: 1, tenant_id: 42, race_id: 501, total_price: 100000, total_discounts: 0, order_category: 'ORDINARY', payment_on: new Date(), payment_ref: 'r1', manual_ticket_count: 1 },
        ]); // only fee_percent
      mockFee.computeFeeForOrdersAggregate.mockResolvedValueOnce({ tenantId: 42, totalServiceFee: 5000, totalManualFee: 0, totalVat: 0, totalFee: 5000, totalNetGmv: 0, feeSourceBreakdown: [], appliedOverrides: [], warnings: [] });
      const r = await service.getRevenueByCategory('logto_user_a', 501);
      expect(r.groups).toHaveLength(2);
      const fix = r.groups.find((g) => g.groupKey === 'fee_fixed')!;
      expect(fix.gmv).toBe(0);
      expect(fix.orderCount).toBe(0);
      expect(fix.totalFee).toBe(0);
    });

    it('viewer without revenue_report → 403 before SQL', async () => {
      mockConfigFound({ tenantIds: [42], permissions: ['ticket_report'] });
      await expect(
        service.getRevenueByCategory('logto_user_a', 501),
      ).rejects.toThrow(ForbiddenException);
      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  describe('getRevenueAggregate()', () => {
    it('cross-tenant: loop tenants, filter to accessible races, sum + sort', async () => {
      mockConfigFound({ tenantIds: [42, 99], permissions: ['revenue_report'] });
      mockDb.query.mockResolvedValueOnce([{ race_id: 501 }, { race_id: 777 }]); // accessible = {501,777}
      // tenant 42 pull → orders for races 501 (accessible) + 600 (NOT accessible)
      mockDb.query.mockResolvedValueOnce([
        { id: 1, tenant_id: 42, race_id: 501, total_price: 100000, total_discounts: 0, order_category: 'ORDINARY', payment_on: new Date(), payment_ref: 'r1', manual_ticket_count: 1 },
        { id: 2, tenant_id: 42, race_id: 600, total_price: 999999, total_discounts: 0, order_category: 'ORDINARY', payment_on: new Date(), payment_ref: 'r2', manual_ticket_count: 1 },
      ]);
      // tenant 99 pull → race 777 (accessible)
      mockDb.query.mockResolvedValueOnce([
        { id: 3, tenant_id: 99, race_id: 777, total_price: 200000, total_discounts: 0, order_category: 'ORDINARY', payment_on: new Date(), payment_ref: 'r3', manual_ticket_count: 1 },
      ]);
      mockFee.computeFeeForOrdersAggregate
        .mockResolvedValueOnce({ tenantId: 42, totalServiceFee: 5500, totalManualFee: 0, totalVat: 0, totalFee: 5500, totalNetGmv: 0, feeSourceBreakdown: [], appliedOverrides: [], warnings: [] }) // tenant 42 (only race 501)
        .mockResolvedValueOnce({ tenantId: 99, totalServiceFee: 11000, totalManualFee: 0, totalVat: 0, totalFee: 11000, totalNetGmv: 0, feeSourceBreakdown: [], appliedOverrides: [], warnings: [] }); // tenant 99
      const r = await service.getRevenueAggregate('logto_user_a');
      // race 600 (999999) MUST be excluded (not accessible)
      expect(r.gmv).toBe(300000); // 100k (t42 race501) + 200k (t99 race777)
      expect(r.byTenant).toHaveLength(2);
      // sorted gmv DESC → tenant 99 (200k) first
      expect(r.byTenant[0].tenantId).toBe(99);
      expect(r.byTenant[0].gmv).toBe(200000);
      expect(r.byTenant[1].tenantId).toBe(42);
      expect(r.byTenant[1].gmv).toBe(100000);
      expect(r.totalFee).toBe(16500);
      expect(r.net).toBe(300000 - 16500);
    });

    it('tenant with no accessible orders → skipped (no row)', async () => {
      mockConfigFound({ tenantIds: [42, 99], permissions: ['revenue_report'] });
      mockDb.query.mockResolvedValueOnce([{ race_id: 501 }]); // accessible = {501}
      mockDb.query.mockResolvedValueOnce([
        { id: 1, tenant_id: 42, race_id: 501, total_price: 100000, total_discounts: 0, order_category: 'ORDINARY', payment_on: new Date(), payment_ref: 'r1', manual_ticket_count: 1 },
      ]); // tenant 42
      mockDb.query.mockResolvedValueOnce([
        { id: 2, tenant_id: 99, race_id: 888, total_price: 50000, total_discounts: 0, order_category: 'ORDINARY', payment_on: new Date(), payment_ref: 'r2', manual_ticket_count: 1 },
      ]); // tenant 99 race 888 NOT accessible
      mockFee.computeFeeForOrdersAggregate.mockResolvedValueOnce({ tenantId: 42, totalServiceFee: 5500, totalManualFee: 0, totalVat: 0, totalFee: 5500, totalNetGmv: 0, feeSourceBreakdown: [], appliedOverrides: [], warnings: [] });
      const r = await service.getRevenueAggregate('logto_user_a');
      expect(r.byTenant).toHaveLength(1); // tenant 99 skipped (0 accessible orders)
      expect(r.byTenant[0].tenantId).toBe(42);
    });

    it('viewer without revenue_report → 403', async () => {
      mockConfigFound({ tenantIds: [42], permissions: ['ticket_report'] });
      await expect(service.getRevenueAggregate('logto_user_a')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ──────────────────────────────────────────────────────────
  // M2b-2b — Ticket charts (trend / stacked / orders)
  // ──────────────────────────────────────────────────────────
  const NOW = new Date('2026-03-15T00:00:00Z');

  describe('getTicketSalesTrend()', () => {
    it('daily → bucket key + DD/MM label per point', async () => {
      mockConfigFound({ tenantIds: [42] });
      mockDb.query
        .mockResolvedValueOnce([{ race_id: 138 }]) // resolveAccessibleRaces
        .mockResolvedValueOnce([
          { bucket: '2026-03-01', order_count: 5 },
          { bucket: '2026-03-02', order_count: 3 },
        ]);
      const r = await service.getTicketSalesTrend('logto_user_a', 138, '30d', 'daily', NOW);
      expect(r.series).toHaveLength(2);
      expect(r.series[0]).toEqual({ bucket: '2026-03-01', label: '01/03', orderCount: 5 });
      expect(r.series[1].label).toBe('02/03');
      // verify SQL filters paid + payment_on range
      expect(mockDb.query.mock.calls[1][0]).toMatch(/financial_status = 'paid'/);
      expect(mockDb.query.mock.calls[1][0]).toMatch(/payment_on >= \? AND om\.payment_on < \?/);
    });

    it('weekly → YEARWEEK int mapped to YYYY-Www + "Tuần N" label', async () => {
      mockConfigFound({ tenantIds: [42] });
      mockDb.query
        .mockResolvedValueOnce([{ race_id: 138 }])
        .mockResolvedValueOnce([{ bucket: 202609, order_count: 10 }]);
      const r = await service.getTicketSalesTrend('logto_user_a', 138, '90d', 'weekly', NOW);
      expect(r.series[0].bucket).toBe('2026-W09');
      expect(r.series[0].label).toBe('Tuần 9');
      expect(mockDb.query.mock.calls[1][0]).toMatch(/YEARWEEK\(om\.payment_on, 3\)/);
    });

    it('monthly → YYYY-MM + "Tháng N / YYYY" label', async () => {
      mockConfigFound({ tenantIds: [42] });
      mockDb.query
        .mockResolvedValueOnce([{ race_id: 138 }])
        .mockResolvedValueOnce([{ bucket: '2026-03', order_count: 100 }]);
      const r = await service.getTicketSalesTrend('logto_user_a', 138, 'year', 'monthly', NOW);
      expect(r.series[0].bucket).toBe('2026-03');
      expect(r.series[0].label).toBe('Tháng 3 / 2026');
    });

    it('IDOR → race not accessible → 403 before trend query', async () => {
      mockConfigFound({ tenantIds: [42] });
      mockDb.query.mockResolvedValueOnce([{ race_id: 138 }]); // accessible {138}
      await expect(
        service.getTicketSalesTrend('logto_user_a', 999, '30d', 'daily', NOW),
      ).rejects.toThrow(ForbiddenException);
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('empty period → empty series, no leak', async () => {
      mockConfigFound({ tenantIds: [42] });
      mockDb.query
        .mockResolvedValueOnce([{ race_id: 138 }])
        .mockResolvedValueOnce([]);
      const r = await service.getTicketSalesTrend('logto_user_a', 138, '30d', 'daily', NOW);
      expect(r.series).toEqual([]);
      expect(r).not.toHaveProperty('gmv');
    });
  });

  describe('getTicketSalesStacked()', () => {
    it('builds courses[] (total DESC) + per-bucket counts matrix', async () => {
      mockConfigFound({ tenantIds: [42] });
      mockDb.query
        .mockResolvedValueOnce([{ race_id: 138 }])
        .mockResolvedValueOnce([
          { bucket: '2026-03-01', course_id: 459, course_name: '21KM', ticket_count: 100 },
          { bucket: '2026-03-01', course_id: 460, course_name: '42KM', ticket_count: 30 },
          { bucket: '2026-03-02', course_id: 459, course_name: '21KM', ticket_count: 50 },
        ]);
      const r = await service.getTicketSalesStacked('logto_user_a', 138, '30d', 'daily', NOW);
      // course 459 total 150 > 460 total 30 → first
      expect(r.courses.map((c) => c.courseId)).toEqual([459, 460]);
      expect(r.series).toHaveLength(2);
      const b1 = r.series.find((s) => s.bucket === '2026-03-01')!;
      expect(b1.counts[459]).toBe(100);
      expect(b1.counts[460]).toBe(30);
      const b2 = r.series.find((s) => s.bucket === '2026-03-02')!;
      expect(b2.counts[459]).toBe(50);
      expect(b2.counts[460]).toBeUndefined(); // course absent in bucket
      expect(mockDb.query.mock.calls[1][0]).not.toMatch(/om\.race_course_id/);
    });

    it('IDOR → 403 before query', async () => {
      mockConfigFound({ tenantIds: [42] });
      mockDb.query.mockResolvedValueOnce([{ race_id: 138 }]);
      await expect(
        service.getTicketSalesStacked('logto_user_a', 999, '30d', 'daily', NOW),
      ).rejects.toThrow(ForbiddenException);
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('getTicketSalesOrders()', () => {
    it('paginated rows: buyerName + buyerEmail + buyerPhone (show-full), NO financial leak', async () => {
      mockConfigFound({ tenantIds: [42] });
      mockDb.query
        .mockResolvedValueOnce([{ race_id: 138 }]) // resolveAccessibleRaces
        .mockResolvedValueOnce([{ total: 57 }]) // count
        .mockResolvedValueOnce([
          {
            order_id: 12358181,
            first_name: 'Nguyễn',
            last_name: 'Văn A',
            name: null,
            email: 'a@gmail.com',
            phone_number: '0901234567',
            financial_status: 'paid',
            payment_on: new Date('2026-03-01'),
            quantity: 2,
            course_name: '21KM',
            ticket_type_name: 'Standard 21K',
          },
        ]);
      const r = await service.getTicketSalesOrders('logto_user_a', 138, 1, 20);
      expect(r.total).toBe(57);
      expect(r.page).toBe(1);
      expect(r.items[0].buyerName).toBe('Nguyễn Văn A');
      expect(r.items[0].buyerEmail).toBe('a@gmail.com'); // show-full (Danny 2026-06-05)
      expect(r.items[0].buyerPhone).toBe('0901234567');
      expect(r.items[0].quantity).toBe(2);
      expect(r.items[0].financialStatus).toBe('paid');
      // FINANCIAL still MUST NOT leak (BR-MP-09)
      expect(r.items[0]).not.toHaveProperty('total_price');
    });

    it('buyerName falls back to name when first/last empty', async () => {
      mockConfigFound({ tenantIds: [42] });
      mockDb.query
        .mockResolvedValueOnce([{ race_id: 138 }])
        .mockResolvedValueOnce([{ total: 1 }])
        .mockResolvedValueOnce([
          { order_id: 1, first_name: null, last_name: null, name: 'CÔNG TY ABC', financial_status: 'paid', payment_on: null, quantity: 1, course_name: null, ticket_type_name: null },
        ]);
      const r = await service.getTicketSalesOrders('logto_user_a', 138, 1, 20);
      expect(r.items[0].buyerName).toBe('CÔNG TY ABC');
    });

    it('search → SQL includes buyer-name LIKE + financialStatus filter param', async () => {
      mockConfigFound({ tenantIds: [42] });
      mockDb.query
        .mockResolvedValueOnce([{ race_id: 138 }])
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([]);
      await service.getTicketSalesOrders('logto_user_a', 138, 2, 10, 'paid', 'Nguyễn');
      const countSql = mockDb.query.mock.calls[1][0] as string;
      const countParams = mockDb.query.mock.calls[1][1] as unknown[];
      expect(countSql).toMatch(/first_name LIKE \?/);
      expect(countParams).toContain('paid');
      expect(countParams.filter((p) => p === '%Nguyễn%').length).toBeGreaterThanOrEqual(1);
      // LIMIT/OFFSET on the data query
      const dataParams = mockDb.query.mock.calls[2][1] as unknown[];
      expect(dataParams.slice(-2)).toEqual([10, 10]); // pageSize 10, offset (2-1)*10
    });

    it('IDOR → 403 before any order query', async () => {
      mockConfigFound({ tenantIds: [42] });
      mockDb.query.mockResolvedValueOnce([{ race_id: 138 }]);
      await expect(
        service.getTicketSalesOrders('logto_user_a', 999, 1, 20),
      ).rejects.toThrow(ForbiddenException);
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });
  });

  // ──────────────────────────────────────────────────────────
  // M2c — Revenue trend + Excel export (finance-gated)
  // ──────────────────────────────────────────────────────────
  describe('getRevenueTrend()', () => {
    function orderRow(raceId: number, raceDate: Date, price: number) {
      return {
        id: Math.floor(price), tenant_id: 42, race_id: raceId,
        total_price: price, total_discounts: 0, order_category: 'ORDINARY',
        payment_on: raceDate, payment_ref: 'r', manual_ticket_count: 1,
      };
    }

    it('buckets orders by day, GMV + fee + net per bucket', async () => {
      mockConfigFound({ tenantIds: [42], permissions: ['revenue_report'] });
      mockDb.query
        .mockResolvedValueOnce([{ race_id: 138 }]) // resolveAccessibleRaces
        .mockResolvedValueOnce([
          orderRow(138, new Date('2026-03-01T05:00:00Z'), 100000),
          orderRow(138, new Date('2026-03-01T09:00:00Z'), 50000),
          orderRow(138, new Date('2026-03-02T05:00:00Z'), 30000),
        ]); // pullOrders
      // FeeService called per bucket (2 buckets) — distinct fees
      mockFee.computeFeeForOrdersAggregate
        .mockResolvedValueOnce({ tenantId: 42, totalServiceFee: 8000, totalManualFee: 0, totalVat: 0, totalFee: 8000, totalNetGmv: 0, feeSourceBreakdown: [], appliedOverrides: [], warnings: [] }) // 2026-03-01
        .mockResolvedValueOnce({ tenantId: 42, totalServiceFee: 1650, totalManualFee: 0, totalVat: 0, totalFee: 1650, totalNetGmv: 0, feeSourceBreakdown: [], appliedOverrides: [], warnings: [] }); // 2026-03-02
      const r = await service.getRevenueTrend('logto_user_a', 138, '30d', 'daily', new Date('2026-03-15T00:00:00Z'));
      expect(r.series).toHaveLength(2);
      const d1 = r.series.find((s) => s.bucket === '2026-03-01')!;
      expect(d1.gmv).toBe(150000); // 100k + 50k
      expect(d1.totalFee).toBe(8000);
      expect(d1.net).toBe(142000);
      expect(d1.orderCount).toBe(2);
      const d2 = r.series.find((s) => s.bucket === '2026-03-02')!;
      expect(d2.gmv).toBe(30000);
      expect(d2.label).toBe('02/03');
    });

    it('viewer without revenue_report → 403 before pull', async () => {
      mockConfigFound({ tenantIds: [42], permissions: ['ticket_report'] });
      await expect(
        service.getRevenueTrend('logto_user_a', 138, '30d', 'daily', new Date('2026-03-15T00:00:00Z')),
      ).rejects.toThrow(ForbiddenException);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('empty period → empty series', async () => {
      mockConfigFound({ tenantIds: [42], permissions: ['revenue_report'] });
      mockDb.query
        .mockResolvedValueOnce([{ race_id: 138 }])
        .mockResolvedValueOnce([]);
      const r = await service.getRevenueTrend('logto_user_a', 138, '30d', 'daily', new Date('2026-03-15T00:00:00Z'));
      expect(r.series).toEqual([]);
      expect(mockFee.computeFeeForOrdersAggregate).not.toHaveBeenCalled();
    });
  });

  describe('getRevenueExport()', () => {
    it('returns xlsx buffer + filename + mime; reuses summary+by-category', async () => {
      // getRevenueExport → getRevenueSummary then getRevenueByCategory.
      // Each does getAccessConfig(cache miss→model) + resolveAccessibleRaces + pull + fee.
      mockConfigFound({ tenantIds: [42], permissions: ['revenue_report'] });
      mockDb.query
        // --- getRevenueSummary ---
        .mockResolvedValueOnce([{ race_id: 138 }]) // resolve
        .mockResolvedValueOnce([
          { id: 1, tenant_id: 42, race_id: 138, total_price: 100000, total_discounts: 0, order_category: 'ORDINARY', payment_on: new Date(), payment_ref: 'r', manual_ticket_count: 1 },
        ]) // pull
        // --- getRevenueByCategory ---
        .mockResolvedValueOnce([{ race_id: 138 }]) // resolve (cache miss again — different key)
        .mockResolvedValueOnce([
          { id: 1, tenant_id: 42, race_id: 138, total_price: 100000, total_discounts: 0, order_category: 'ORDINARY', payment_on: new Date(), payment_ref: 'r', manual_ticket_count: 1 },
        ]); // pull
      mockFee.computeFeeForOrdersAggregate.mockResolvedValue({ tenantId: 42, totalServiceFee: 5500, totalManualFee: 0, totalVat: 0, totalFee: 5500, totalNetGmv: 0, feeSourceBreakdown: [], appliedOverrides: [], warnings: [] });
      const r = await service.getRevenueExport('logto_user_a', 138);
      expect(r.filename).toBe('5bib-merchant-revenue-race-138.xlsx');
      expect(r.mimeType).toMatch(/spreadsheetml\.sheet/);
      expect(Buffer.isBuffer(r.buffer)).toBe(true);
      expect(r.buffer.length).toBeGreaterThan(0);
      // xlsx files start with PK zip magic
      expect(r.buffer.slice(0, 2).toString('latin1')).toBe('PK');
    });

    it('viewer without revenue_report → 403 (propagated from getRevenueSummary)', async () => {
      mockConfigFound({ tenantIds: [42], permissions: ['ticket_report'] });
      await expect(
        service.getRevenueExport('logto_user_a', 138),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ──────────────────────────────────────────────────────────
  // F-070 — Advanced MKT analytics (forecast / heatmap / target)
  // ──────────────────────────────────────────────────────────

  function mockTargetFound(target: number | null) {
    mockTargetModel.findOne.mockReturnValue({
      lean: () => ({
        exec: () =>
          Promise.resolve(target === null ? null : { raceId: 138, target }),
      }),
    });
  }

  /** Build N consecutive daily rows ending today-ish for cumsum tests. */
  function dailyRows(values: number[], startDay = 1): Array<{ d: string; n: number }> {
    return values.map((n, i) => ({
      d: `2026-03-${String(startDay + i).padStart(2, '0')}`,
      n,
    }));
  }

  describe('getTicketForecast()', () => {
    const NOW_F = new Date('2026-03-20T00:00:00Z');

    it('TC-01 happy → cumsum running total + projection + caches 300s', async () => {
      mockConfigFound({ tenantIds: [42] });
      // 8 daily points (≥8 → projection computed). Each day +5 → cum 5,10,..40.
      mockDb.query
        .mockResolvedValueOnce([{ race_id: 138 }]) // resolveAccessibleRaces
        .mockResolvedValueOnce(dailyRows([5, 5, 5, 5, 5, 5, 5, 5])) // daily
        .mockResolvedValueOnce([
          { event_start_date: new Date('2026-03-30T00:00:00Z'), status: 'ONGOING' },
        ]); // race meta
      mockTargetFound(null);

      const r = await service.getTicketForecast('logto_user_a', 138, NOW_F);

      expect(r.cumulative).toHaveLength(8);
      expect(r.cumulative[0]).toEqual({ date: '2026-03-01', value: 5 });
      expect(r.cumulative[7].value).toBe(40);
      expect(r.raceEnded).toBe(false);
      // rate = (40 - 5)/7 = 5/day; daysToRace = ceil((30-20))=10 → 40 + 5*10 = 90.
      expect(r.recentDailyRate).toBeCloseTo(5);
      expect(r.projectedValue).toBe(90);
      expect(r.target).toBeNull();
      expect(r.projectionDate).toBe(new Date('2026-03-30T00:00:00Z').toISOString());
      // NO financial leak
      expect(JSON.stringify(r)).not.toMatch(/gmv|fee|price|total_price/i);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'merchant-portal:forecast:138',
        expect.any(String),
        'EX',
        300,
      );
    });

    it('TC-02 race ended (status COMPLETE) → projectedValue null (target still returned)', async () => {
      mockConfigFound({ tenantIds: [42] });
      mockDb.query
        .mockResolvedValueOnce([{ race_id: 138 }])
        .mockResolvedValueOnce(dailyRows([5, 5, 5, 5, 5, 5, 5, 5]))
        .mockResolvedValueOnce([
          { event_start_date: new Date('2026-03-10T00:00:00Z'), status: 'COMPLETE' },
        ]);
      mockTargetFound(5000);

      const r = await service.getTicketForecast('logto_user_a', 138, NOW_F);
      expect(r.raceEnded).toBe(true);
      expect(r.projectedValue).toBeNull();
      expect(r.target).toBe(5000); // value still returned; FE hides
    });

    it('TC-02b race ended via eventStartDate < today → raceEnded true', async () => {
      mockConfigFound({ tenantIds: [42] });
      mockDb.query
        .mockResolvedValueOnce([{ race_id: 138 }])
        .mockResolvedValueOnce(dailyRows([5, 5, 5, 5, 5, 5, 5, 5]))
        .mockResolvedValueOnce([
          { event_start_date: new Date('2026-03-15T00:00:00Z'), status: 'ONGOING' },
        ]);
      mockTargetFound(null);
      const r = await service.getTicketForecast('logto_user_a', 138, NOW_F);
      expect(r.raceEnded).toBe(true);
      expect(r.projectedValue).toBeNull();
    });

    it('TC-09 empty data → cumulative [], projectedValue null, no 500', async () => {
      mockConfigFound({ tenantIds: [42] });
      mockDb.query
        .mockResolvedValueOnce([{ race_id: 138 }])
        .mockResolvedValueOnce([]) // no paid orders
        .mockResolvedValueOnce([
          { event_start_date: new Date('2026-03-30T00:00:00Z'), status: 'ONGOING' },
        ]);
      mockTargetFound(null);
      const r = await service.getTicketForecast('logto_user_a', 138, NOW_F);
      expect(r.cumulative).toEqual([]);
      expect(r.projectedValue).toBeNull();
      expect(r.recentDailyRate).toBe(0);
    });

    it('<8 data points → projectedValue null, recentDailyRate 0', async () => {
      mockConfigFound({ tenantIds: [42] });
      mockDb.query
        .mockResolvedValueOnce([{ race_id: 138 }])
        .mockResolvedValueOnce(dailyRows([3, 4, 5])) // only 3 points
        .mockResolvedValueOnce([
          { event_start_date: new Date('2026-03-30T00:00:00Z'), status: 'ONGOING' },
        ]);
      mockTargetFound(null);
      const r = await service.getTicketForecast('logto_user_a', 138, NOW_F);
      expect(r.cumulative).toHaveLength(3);
      expect(r.projectedValue).toBeNull();
      expect(r.recentDailyRate).toBe(0);
    });

    it('handles Date object from DATE() column + missing race meta gracefully', async () => {
      mockConfigFound({ tenantIds: [42] });
      mockDb.query
        .mockResolvedValueOnce([{ race_id: 138 }])
        .mockResolvedValueOnce([{ d: new Date('2026-03-01T00:00:00Z'), n: 7 }])
        .mockResolvedValueOnce([]); // no race row
      mockTargetFound(null);
      const r = await service.getTicketForecast('logto_user_a', 138, NOW_F);
      expect(r.cumulative[0]).toEqual({ date: '2026-03-01', value: 7 });
      expect(r.projectionDate).toBeNull();
      expect(r.raceEnded).toBe(false);
    });

    it('cache hit → returns cached forecast, no daily/meta SQL', async () => {
      mockConfigFound({ tenantIds: [42] });
      mockDb.query.mockResolvedValueOnce([{ race_id: 138 }]); // resolveAccessibleRaces
      // Key-aware cache: access/races miss (→ db), forecast hit.
      mockRedis.get.mockImplementation((key: string) => {
        if (key === 'merchant-portal:forecast:138') {
          return Promise.resolve(
            JSON.stringify({
              cumulative: [{ date: '2026-03-01', value: 1 }],
              projectedValue: null,
              projectionDate: null,
              recentDailyRate: 0,
              target: null,
              raceEnded: false,
            }),
          );
        }
        return Promise.resolve(null);
      });
      const r = await service.getTicketForecast('logto_user_a', 138, NOW_F);
      expect(r.cumulative[0].value).toBe(1);
      // only the resolveAccessibleRaces query ran (no daily/meta)
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('TC-08 IDOR → race not accessible → 403 before forecast query', async () => {
      mockConfigFound({ tenantIds: [42] });
      mockDb.query.mockResolvedValueOnce([{ race_id: 138 }]);
      await expect(
        service.getTicketForecast('logto_user_a', 999, NOW_F),
      ).rejects.toThrow(ForbiddenException);
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('getTicketHeatmap()', () => {
    it('TC-03 happy → grid 7×7 + labels + max', async () => {
      mockConfigFound({ tenantIds: [42] });
      mockDb.query
        .mockResolvedValueOnce([{ race_id: 138 }]) // resolveAccessibleRaces
        .mockResolvedValueOnce([
          { dow: 2, hr: 8, n: 10 }, // Mon 08h → row0 bucket1
          { dow: 1, hr: 22, n: 3 }, // Sun 22h → row6 bucket6
        ]);
      const r = await service.getTicketHeatmap('logto_user_a', 138);
      expect(r.grid).toHaveLength(7);
      expect(r.grid.every((row) => row.length === 7)).toBe(true);
      expect(r.dayLabels).toEqual(['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']);
      expect(r.bucketLabels).toEqual([
        '0-6', '6-9', '9-12', '12-15', '15-18', '18-21', '21-24',
      ]);
      expect(r.grid[0][1]).toBe(10); // Mon 08h
      expect(r.grid[6][6]).toBe(3); // Sun 22h
      expect(r.max).toBe(10);
      expect(JSON.stringify(r)).not.toMatch(/gmv|fee|price/i);
    });

    it('TC-03 dow/hr→grid mapping: MySQL Thu 23h (dow=5,hr=23) → grid[Thu][21-24]', async () => {
      // payment_on lưu SẴN giờ VN (UAT F-070 confirm) → KHÔNG +7h. Verify BE mapping
      // của dow/hr MySQL trả về: DAYOFWEEK(Thu)=5; HOUR(23)=23 → bucket 21-24 (index 6).
      mockConfigFound({ tenantIds: [42] });
      mockDb.query
        .mockResolvedValueOnce([{ race_id: 138 }])
        .mockResolvedValueOnce([{ dow: 5, hr: 23, n: 1 }]);
      const r = await service.getTicketHeatmap('logto_user_a', 138);
      // Thu = row index 3 (Mon0 Tue1 Wed2 Thu3); bucket 21-24 = index 6.
      expect(r.grid[3][6]).toBe(1);
      expect(r.max).toBe(1);
      // SQL dùng raw payment_on (đã là giờ VN), KHÔNG convert +7h (UAT fix).
      expect(mockDb.query.mock.calls[1][0]).toMatch(/DAYOFWEEK\(om\.payment_on\)/);
      expect(mockDb.query.mock.calls[1][0]).not.toMatch(/INTERVAL 7 HOUR/);
    });

    it('TC-09 empty → grid all 0, max 0', async () => {
      mockConfigFound({ tenantIds: [42] });
      mockDb.query
        .mockResolvedValueOnce([{ race_id: 138 }])
        .mockResolvedValueOnce([]);
      const r = await service.getTicketHeatmap('logto_user_a', 138);
      expect(r.max).toBe(0);
      expect(r.grid.flat().every((c) => c === 0)).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'merchant-portal:heatmap:138',
        expect.any(String),
        'EX',
        300,
      );
    });

    it('TC-08 IDOR → 403 before heatmap query', async () => {
      mockConfigFound({ tenantIds: [42] });
      mockDb.query.mockResolvedValueOnce([{ race_id: 138 }]);
      await expect(
        service.getTicketHeatmap('logto_user_a', 999),
      ).rejects.toThrow(ForbiddenException);
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('setTicketTarget()', () => {
    it('TC-04 upsert + DEL forecast cache + returns target', async () => {
      mockConfigFound({ tenantIds: [42] });
      mockDb.query.mockResolvedValueOnce([{ race_id: 138 }]); // resolveAccessibleRaces
      const r = await service.setTicketTarget('logto_user_a', {
        raceId: 138,
        target: 5000,
      });
      expect(r).toEqual({ raceId: 138, target: 5000 });
      expect(mockTargetModel.findOneAndUpdate).toHaveBeenCalledWith(
        { raceId: 138 },
        { $set: { target: 5000, updatedBy: 'logto_user_a' } },
        { upsert: true, new: true },
      );
      expect(mockRedis.del).toHaveBeenCalledWith('merchant-portal:forecast:138');
    });

    it('TC-05 target=0 → output target null (xoá mục tiêu) but doc still upserted', async () => {
      mockConfigFound({ tenantIds: [42] });
      mockDb.query.mockResolvedValueOnce([{ race_id: 138 }]);
      const r = await service.setTicketTarget('logto_user_a', {
        raceId: 138,
        target: 0,
      });
      expect(r).toEqual({ raceId: 138, target: null });
      expect(mockTargetModel.findOneAndUpdate).toHaveBeenCalledWith(
        { raceId: 138 },
        { $set: { target: 0, updatedBy: 'logto_user_a' } },
        { upsert: true, new: true },
      );
    });

    it('TC-08 IDOR → 403 BEFORE any upsert', async () => {
      mockConfigFound({ tenantIds: [42] });
      mockDb.query.mockResolvedValueOnce([{ race_id: 138 }]); // accessible {138}
      await expect(
        service.setTicketTarget('logto_user_a', { raceId: 999, target: 100 }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockTargetModel.findOneAndUpdate).not.toHaveBeenCalled();
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('TC-10 concurrent writes same race → both resolve, last value wins (idempotent upsert)', async () => {
      mockConfigFound({ tenantIds: [42] });
      // resolveAccessibleRaces cached so each call only hits redis, not db twice.
      mockRedis.get.mockResolvedValue(JSON.stringify([138]));
      const [a, b] = await Promise.all([
        service.setTicketTarget('logto_user_a', { raceId: 138, target: 100 }),
        service.setTicketTarget('logto_user_a', { raceId: 138, target: 200 }),
      ]);
      expect(a.raceId).toBe(138);
      expect(b.raceId).toBe(138);
      // both upserts target the same unique {raceId} filter → no duplicate doc
      expect(mockTargetModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
      for (const call of mockTargetModel.findOneAndUpdate.mock.calls) {
        expect(call[0]).toEqual({ raceId: 138 });
        expect(call[2]).toEqual({ upsert: true, new: true });
      }
    });
  });
});
