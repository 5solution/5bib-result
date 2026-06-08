import { aggregateCapacity, type RawCapacityRow } from './capacity.util';

const row = (o: Partial<RawCapacityRow>): RawCapacityRow => ({
  course_id: 1,
  course_name: 'C1',
  tt_id: 1,
  type_name: 'Regular',
  quota: 1000,
  sold: 0,
  ...o,
});

describe('capacity.util — aggregateCapacity (F-073)', () => {
  it('TC-01 sold = PAID count; remaining = quota - sold; pctFilled', () => {
    const agg = aggregateCapacity(9, [row({ quota: 1000, sold: 413 })]);
    const tt = agg.courses[0].ticketTypes[0];
    expect(tt.sold).toBe(413);
    expect(tt.remaining).toBe(587);
    expect(tt.pctFilled).toBeCloseTo(41.3, 1);
  });

  it('TC-02 aggregates ticket types into course totals', () => {
    const agg = aggregateCapacity(9, [
      row({ tt_id: 1, quota: 1000, sold: 100 }),
      row({ tt_id: 2, quota: 500, sold: 0 }),
    ]);
    const c = agg.courses[0];
    expect(c.quota).toBe(1500);
    expect(c.sold).toBe(100);
    expect(c.remaining).toBe(1400);
    expect(c.ticketTypes).toHaveLength(2);
  });

  it('TC-03 unlimited when quota 0/null (no bar, pct 0)', () => {
    const agg = aggregateCapacity(9, [row({ quota: 0, sold: 0 })]);
    const tt = agg.courses[0].ticketTypes[0];
    expect(tt.unlimited).toBe(true);
    expect(tt.pctFilled).toBe(0);
    expect(agg.courses[0].unlimited).toBe(true);
  });

  it('TC-04 course unlimited only if ALL tt unlimited', () => {
    const agg = aggregateCapacity(9, [
      row({ tt_id: 1, quota: 0, sold: 0 }),
      row({ tt_id: 2, quota: 100, sold: 60 }),
    ]);
    expect(agg.courses[0].unlimited).toBe(false);
    expect(agg.courses[0].sold).toBe(60);
  });

  it('TC-05 oversold (sold>quota) → remaining clamped 0, sold≥0', () => {
    const agg = aggregateCapacity(9, [row({ quota: 100, sold: 150 })]);
    const tt = agg.courses[0].ticketTypes[0];
    expect(tt.remaining).toBe(0);
    expect(tt.sold).toBeGreaterThanOrEqual(0);
    expect(tt.pctFilled).toBe(100); // capped
  });

  it('TC-06 sorts courses by pctFilled desc', () => {
    const agg = aggregateCapacity(9, [
      row({ course_id: 1, course_name: 'Low', quota: 100, sold: 10 }), // 10%
      row({ course_id: 2, course_name: 'High', quota: 100, sold: 90 }), // 90%
    ]);
    expect(agg.courses[0].courseName).toBe('High');
  });

  it('TC-07 empty rows → empty courses', () => {
    expect(aggregateCapacity(9, []).courses).toEqual([]);
  });
});
