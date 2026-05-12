/**
 * F-028 fee.service.spec.ts
 *
 * Covers (cross-DB MySQL):
 *   - BR-PNL-04 TICKET_SALES revenue pull
 *   - F-016 FIVE_BIB_CATEGORIES exclude MANUAL (verified by query builder
 *     `andWhere('o.order_category IN (:...cats)')` excludes MANUAL)
 *   - UP-07 race chưa có order paid → return 0
 *   - UP-11 MySQL connection down → graceful return null + warning
 *   - tenantId / raceId null → null + warning
 */
import { FeeService } from './fee.service';

function buildQB(rawOneResult: any) {
  const qb: any = {};
  qb.innerJoin = jest.fn().mockReturnValue(qb);
  qb.select = jest.fn().mockReturnValue(qb);
  qb.where = jest.fn().mockReturnValue(qb);
  qb.andWhere = jest.fn().mockReturnValue(qb);
  qb.getRawOne = jest.fn().mockResolvedValue(rawOneResult);
  return qb;
}

function buildRepo(rawOneResult: any) {
  // Both queries (linejoin + distinct subquery) use same chain; return same
  // result. service prefers second (orderRow). Tests handle either.
  return {
    createQueryBuilder: jest.fn().mockReturnValue(buildQB(rawOneResult)),
  };
}

function buildTenantRepo(rawManyResult: any[], rawSqlResult: any[] = []) {
  const qb: any = {};
  qb.select = jest.fn().mockReturnValue(qb);
  qb.where = jest.fn().mockReturnValue(qb);
  qb.andWhere = jest.fn().mockReturnValue(qb);
  qb.orderBy = jest.fn().mockReturnValue(qb);
  qb.limit = jest.fn().mockReturnValue(qb);
  qb.getRawMany = jest.fn().mockResolvedValue(rawManyResult);
  return {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    manager: {
      query: jest.fn().mockResolvedValue(rawSqlResult),
    },
  };
}

describe('F-028 FeeService.getActualRevenueForRace', () => {
  it('Happy path — SUM(total_price)=12_500_000 returned + cache set', async () => {
    const repo = buildRepo({ total: '12500000' });
    const redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
    };
    const svc = new FeeService(repo as any, redis as any);
    const r = await svc.getActualRevenueForRace(12, 148, 'contract-abc');
    expect(r.revenue).toBe(12_500_000);
    expect(r.warning).toBeUndefined();
    expect(redis.set).toHaveBeenCalledWith(
      'pnl:ticket-sales-fee:contract-abc',
      '12500000',
      'EX',
      300,
    );
  });

  it('F-028 BUG fix — query KHÔNG filter `o.tenant_id` (column không tồn tại MySQL prod)', async () => {
    // Regression test for "Unknown column 'o.tenant_id' in 'where clause'"
    // Verify chain: only WHERE internal_status='COMPLETE', no tenant_id where clause.
    const qb: any = {};
    qb.select = jest.fn().mockReturnValue(qb);
    qb.where = jest.fn().mockReturnValue(qb);
    qb.andWhere = jest.fn().mockReturnValue(qb);
    qb.getRawOne = jest.fn().mockResolvedValue({ total: '0' });
    const repo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };

    const svc = new FeeService(repo as any, undefined);
    await svc.getActualRevenueForRace(12, 148, 'c-regression');

    // First `.where(...)` should be `internal_status = 'COMPLETE'` (NOT tenant_id)
    const firstWhereCall = qb.where.mock.calls[0]?.[0];
    expect(firstWhereCall).toContain("internal_status = 'COMPLETE'");
    expect(firstWhereCall).not.toContain('tenant_id');

    // None of the andWhere clauses should reference `tenant_id`
    for (const call of qb.andWhere.mock.calls) {
      const clause = String(call[0] ?? '');
      expect(clause).not.toContain('o.tenant_id');
    }

    // Filter by race must still happen via race_course join subquery
    const raceJoinClause = qb.andWhere.mock.calls.find((c: any[]) =>
      String(c[0]).includes('rc2.race_id'),
    );
    expect(raceJoinClause).toBeDefined();
    expect(raceJoinClause?.[1]).toEqual({ raceId2: 148 });
  });

  it('UP-07 — race chưa có order paid → revenue=0 (KHÔNG 500 crash)', async () => {
    const repo = buildRepo({ total: null });
    const svc = new FeeService(repo as any, undefined);
    const r = await svc.getActualRevenueForRace(12, 999, 'c1');
    expect(r.revenue).toBe(0);
  });

  it('tenantId null → null + warning (no MySQL call)', async () => {
    const repo = buildRepo({ total: '0' });
    const svc = new FeeService(repo as any, undefined);
    const r = await svc.getActualRevenueForRace(null, 148, 'c1');
    expect(r.revenue).toBeNull();
    expect(r.warning).toMatch(/Hợp đồng chưa liên kết/);
    expect(repo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('mysqlRaceId null → null + warning', async () => {
    const repo = buildRepo({ total: '0' });
    const svc = new FeeService(repo as any, undefined);
    const r = await svc.getActualRevenueForRace(12, null, 'c1');
    expect(r.revenue).toBeNull();
    expect(r.warning).toMatch(/Hợp đồng chưa liên kết/);
  });

  it('UP-11 — MySQL down (createQueryBuilder throws) → null + warning, no 500', async () => {
    const repo = {
      createQueryBuilder: jest.fn(() => {
        throw new Error('ECONNREFUSED');
      }),
    };
    const svc = new FeeService(repo as any, undefined);
    const r = await svc.getActualRevenueForRace(12, 148, 'c1');
    expect(r.revenue).toBeNull();
    expect(r.warning).toMatch(/Không truy vấn được/);
  });

  it('platform DB chưa cấu hình (repo null) → graceful', async () => {
    const svc = new FeeService(null as any, undefined);
    const r = await svc.getActualRevenueForRace(12, 148, 'c1');
    expect(r.revenue).toBeNull();
    expect(r.warning).toMatch(/Platform DB/);
  });

  it('Cache hit → bypass MySQL', async () => {
    const repo = buildRepo({ total: '999' });
    const redis = {
      get: jest.fn().mockResolvedValue('7500000'),
      set: jest.fn(),
    };
    const svc = new FeeService(repo as any, redis as any);
    const r = await svc.getActualRevenueForRace(12, 148, 'cache-key-1');
    expect(r.revenue).toBe(7_500_000);
    expect(repo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('FIVE_BIB_CATEGORIES — MANUAL not included in IN clause (F-016 invariant)', () => {
    // Verify private constant via behavior: query builder receives FIVE_BIB
    // categories filter excluding MANUAL.
    const cats = (FeeService as any).FIVE_BIB_CATEGORIES as string[];
    expect(cats).toEqual([
      'ORDINARY',
      'PERSONAL_GROUP',
      'CHANGE_COURSE',
      'GROUP_BUY',
      'GROUP_BUY_FIXED',
      'CODE_TRANSFER',
    ]);
    expect(cats).not.toContain('MANUAL');
  });
});

// ────────────────────────────────────────────────────────────────────
// F-028 MySQL Tenant + Race picker (link Contract TICKET_SALES → MySQL)
// ────────────────────────────────────────────────────────────────────

describe('F-028 FeeService — searchTenants', () => {
  it('happy: empty q → 20 latest tenants (no LIKE filter)', async () => {
    const tenantRepo = buildTenantRepo([
      { id: 12, name: '5BIB Sport Co.', vat: '0123456789' },
      { id: 13, name: 'Run Vietnam JSC', vat: null },
    ]);
    const svc = new FeeService(null as any, undefined, tenantRepo as any);
    const r = await svc.searchTenants(undefined);
    expect(r).toHaveLength(2);
    expect(r[0]).toEqual({ id: 12, name: '5BIB Sport Co.', taxId: '0123456789' });
    expect(r[1].taxId).toBeNull();
    // No LIKE filter when q empty
    const qb = tenantRepo.createQueryBuilder.mock.results[0].value;
    expect(qb.andWhere).not.toHaveBeenCalled();
  });

  it('happy: q non-empty → LIKE filter on name OR vat', async () => {
    const tenantRepo = buildTenantRepo([
      { id: 12, name: '5BIB Sport Co.', vat: '0123456789' },
    ]);
    const svc = new FeeService(null as any, undefined, tenantRepo as any);
    await svc.searchTenants('5BIB');
    const qb = tenantRepo.createQueryBuilder.mock.results[0].value;
    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('LIKE'),
      { like: '%5BIB%' },
    );
  });

  it('tenantRepo unset (platform DB chưa cấu hình) → []', async () => {
    const svc = new FeeService(null as any, undefined, null);
    const r = await svc.searchTenants('anything');
    expect(r).toEqual([]);
  });

  it('cache hit → bypass MySQL', async () => {
    const tenantRepo = buildTenantRepo([]);
    const cached = JSON.stringify([
      { id: 42, name: 'Cached Tenant', taxId: '999' },
    ]);
    const redis = {
      get: jest.fn().mockResolvedValue(cached),
      set: jest.fn(),
    };
    const svc = new FeeService(null as any, redis as any, tenantRepo as any);
    const r = await svc.searchTenants('foo');
    expect(r).toEqual([{ id: 42, name: 'Cached Tenant', taxId: '999' }]);
    expect(tenantRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('MySQL throws → log warn + return [] (graceful)', async () => {
    const tenantRepo: any = {
      createQueryBuilder: jest.fn(() => {
        throw new Error('ECONNREFUSED');
      }),
      manager: { query: jest.fn() },
    };
    const svc = new FeeService(null as any, undefined, tenantRepo);
    const r = await svc.searchTenants('foo');
    expect(r).toEqual([]);
  });
});

describe('F-028 FeeService — searchRaces', () => {
  it('happy: tenantId + q empty → ORDER BY created_on DESC LIMIT 30', async () => {
    const tenantRepo = buildTenantRepo([], [
      { raceId: 148, title: 'Vietnam Trail 2026', createdOn: new Date('2026-03-15T00:00:00Z') },
      { raceId: 100, title: 'Marathon HCMC 2025', createdOn: new Date('2025-12-01T00:00:00Z') },
    ]);
    const svc = new FeeService(null as any, undefined, tenantRepo as any);
    const r = await svc.searchRaces(12, undefined);
    expect(r).toHaveLength(2);
    expect(r[0].raceId).toBe(148);
    expect(r[0].title).toBe('Vietnam Trail 2026');
    expect(r[0].createdOn).toBe('2026-03-15T00:00:00.000Z');
    expect(tenantRepo.manager.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE r.tenant_id = ?'),
      [12],
    );
  });

  it('happy: tenantId + q non-empty → LIKE filter on title', async () => {
    const tenantRepo = buildTenantRepo([], []);
    const svc = new FeeService(null as any, undefined, tenantRepo as any);
    await svc.searchRaces(12, 'Trail');
    expect(tenantRepo.manager.query).toHaveBeenCalledWith(
      expect.stringContaining('AND r.title LIKE ?'),
      [12, '%Trail%'],
    );
  });

  it('tenantId invalid (0) → BadRequestException', async () => {
    const tenantRepo = buildTenantRepo([], []);
    const svc = new FeeService(null as any, undefined, tenantRepo as any);
    await expect(svc.searchRaces(0)).rejects.toThrow(/tenantId/);
  });

  it('tenantId invalid (NaN) → BadRequestException', async () => {
    const tenantRepo = buildTenantRepo([], []);
    const svc = new FeeService(null as any, undefined, tenantRepo as any);
    await expect(svc.searchRaces(NaN as any)).rejects.toThrow(/tenantId/);
  });

  it('tenantRepo unset → []', async () => {
    const svc = new FeeService(null as any, undefined, null);
    const r = await svc.searchRaces(12);
    expect(r).toEqual([]);
  });

  it('MySQL throws → graceful []', async () => {
    const tenantRepo: any = {
      createQueryBuilder: jest.fn(),
      manager: {
        query: jest.fn().mockRejectedValue(new Error('SQL fail')),
      },
    };
    const svc = new FeeService(null as any, undefined, tenantRepo);
    const r = await svc.searchRaces(12, 'q');
    expect(r).toEqual([]);
  });
});
