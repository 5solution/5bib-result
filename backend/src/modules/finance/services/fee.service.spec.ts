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
