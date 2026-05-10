import {
  resolvePeriod,
  resolveCompare,
  calcDeltaPercent,
  buildMetricCacheKey,
} from '../services/period-resolver';

describe('period-resolver', () => {
  const NOW = new Date('2026-05-10T08:00:00Z');

  it('resolves 7d range — 7 ngày bao gồm hôm nay', () => {
    const r = resolvePeriod({ kind: '7d', now: NOW });
    expect(r.fromIso.slice(0, 10)).toBe('2026-05-04');
    expect(r.toIso.slice(0, 10)).toBe('2026-05-11');
    expect(r.periodKey).toContain('7d:');
  });

  it('resolves 30d range — 30 ngày bao gồm hôm nay', () => {
    const r = resolvePeriod({ kind: '30d', now: NOW });
    expect(r.fromIso.slice(0, 10)).toBe('2026-04-11');
  });

  it('resolves quarter range cho Q2 2026', () => {
    const r = resolvePeriod({ kind: 'quarter', now: NOW });
    expect(r.fromIso.slice(0, 10)).toBe('2026-04-01');
    expect(r.toIso.slice(0, 10)).toBe('2026-07-01');
    expect(r.periodKey).toBe('q2:2026');
  });

  it('resolves year range', () => {
    const r = resolvePeriod({ kind: 'year', now: NOW });
    expect(r.periodKey).toBe('y:2026');
  });

  it('resolves rolling12m range', () => {
    const r = resolvePeriod({ kind: 'rolling12m', now: NOW });
    expect(r.periodKey).toContain('r12m:');
  });

  it('resolves custom range', () => {
    const r = resolvePeriod({
      kind: 'custom',
      from: '2026-01-01',
      to: '2026-03-31',
    });
    expect(r.fromIso.slice(0, 10)).toBe('2026-01-01');
    // end-exclusive: thêm 1 ngày
    expect(r.toIso.slice(0, 10)).toBe('2026-04-01');
  });

  it('throws khi custom thiếu from/to', () => {
    expect(() => resolvePeriod({ kind: 'custom' })).toThrow();
  });

  it('compare prev = kỳ trước cùng độ dài', () => {
    const cur = resolvePeriod({ kind: '7d', now: NOW });
    const cmp = resolveCompare(cur, { kind: 'prev' });
    expect(cmp).not.toBeNull();
    expect(cmp?.toIso).toBe(cur.fromIso);
  });

  it('compare yoy = lùi 1 năm', () => {
    const cur = resolvePeriod({ kind: 'quarter', now: NOW });
    const cmp = resolveCompare(cur, { kind: 'yoy' });
    expect(cmp?.fromIso.slice(0, 10)).toBe('2025-04-01');
  });

  it('compare none = null', () => {
    const cur = resolvePeriod({ kind: '7d', now: NOW });
    expect(resolveCompare(cur, { kind: 'none' })).toBeNull();
  });

  it('calcDeltaPercent guards 0 và non-finite', () => {
    expect(calcDeltaPercent(110, 100)).toBe(10);
    expect(calcDeltaPercent(50, 100)).toBe(-50);
    expect(calcDeltaPercent(10, 0)).toBeNull();
    expect(calcDeltaPercent(NaN, 100)).toBeNull();
  });

  it('buildMetricCacheKey — platform vs race scope', () => {
    expect(buildMetricCacheKey('repeat-athlete-rate', 'platform', 'q2:2026')).toBe(
      'analytics:metric:repeat-athlete-rate:platform:q2:2026',
    );
    expect(
      buildMetricCacheKey('claim-rate', { raceId: 'abc' }, 'r12m:2026-01-01'),
    ).toBe('analytics:metric:claim-rate:race:abc:r12m:2026-01-01');
  });
});
