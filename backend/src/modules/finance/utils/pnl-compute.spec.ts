/**
 * F-028 pnl-compute.spec.ts — pure function tests (BR-PNL-06 + BR-PNL-07).
 */
import {
  aggregateByCategory,
  computePnL,
} from './pnl-compute';

describe('F-028 computePnL — pure function', () => {
  it('Happy path: revenue 200M, cost 120M → profit 80M, margin 40%', () => {
    const r = computePnL({
      revenue: 200_000_000,
      totalCost: 120_000_000,
      revenueSource: 'ACTUAL',
    });
    expect(r.profit).toBe(80_000_000);
    expect(r.margin).toBe(40);
    expect(r.marginTier).toBe('healthy');
    expect(r.revenueSource).toBe('ACTUAL');
  });

  it('BR-PNL-07 — revenue=0 → margin null (divide-by-zero guard)', () => {
    const r = computePnL({
      revenue: 0,
      totalCost: 5_000_000,
      revenueSource: 'ESTIMATED',
    });
    expect(r.margin).toBeNull();
    expect(r.profit).toBe(-5_000_000);
    expect(r.marginTier).toBe('neutral');
  });

  it('Cost > revenue → profit âm + margin âm + tier loss', () => {
    const r = computePnL({
      revenue: 50_000_000,
      totalCost: 80_000_000,
      revenueSource: 'ACTUAL',
    });
    expect(r.profit).toBe(-30_000_000);
    expect(r.margin).toBe(-60);
    expect(r.marginTier).toBe('loss');
  });

  it('Cost = 0 → profit = revenue + margin 100% + tier healthy', () => {
    const r = computePnL({
      revenue: 100_000_000,
      totalCost: 0,
      revenueSource: 'ESTIMATED',
    });
    expect(r.profit).toBe(100_000_000);
    expect(r.margin).toBe(100);
    expect(r.marginTier).toBe('healthy');
  });

  it('Margin tier thin — margin trong khoảng (0, 10]', () => {
    const r = computePnL({
      revenue: 100_000_000,
      totalCost: 95_000_000,
      revenueSource: 'ACTUAL',
    });
    expect(r.margin).toBe(5);
    expect(r.marginTier).toBe('thin');
  });

  it('Margin round 1 decimal — 3.333333% → 3.3%', () => {
    const r = computePnL({
      revenue: 3_000_000,
      totalCost: 2_900_000,
      revenueSource: 'ESTIMATED',
    });
    // 100K / 3M = 3.333...%
    expect(r.margin).toBe(3.3);
    expect(r.marginTier).toBe('thin');
  });
});

describe('F-028 aggregateByCategory — pure function', () => {
  it('Sums multiple items per category', () => {
    const out = aggregateByCategory([
      { category: 'LABOR', amount: 5_000_000 },
      { category: 'MATERIAL', amount: 3_000_000 },
      { category: 'LABOR', amount: 2_000_000 },
      { category: 'VENDOR', amount: 10_000_000 },
    ]);
    expect(out).toEqual({
      LABOR: 7_000_000,
      MATERIAL: 3_000_000,
      VENDOR: 10_000_000,
    });
  });

  it('Empty array → {}', () => {
    expect(aggregateByCategory([])).toEqual({});
  });

  it('Coerces non-numeric amount to 0 (defensive)', () => {
    const out = aggregateByCategory([
      { category: 'OTHER', amount: NaN as unknown as number },
      { category: 'OTHER', amount: 5_000 },
    ]);
    expect(out.OTHER).toBe(5_000);
  });
});
