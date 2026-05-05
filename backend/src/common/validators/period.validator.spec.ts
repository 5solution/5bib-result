import { validate } from 'class-validator';
import {
  IsPeriodString,
  IsPeriodBoundaryDate,
  IsValidPeriodRange,
  lastDayOfMonthUTC,
  monthsBetweenInclusive,
} from './period.validator';

class PeriodStringDto {
  @IsPeriodString()
  period!: string;
}

class BoundaryStartDto {
  @IsPeriodBoundaryDate('start')
  period_start!: string;
}

class BoundaryEndDto {
  @IsPeriodBoundaryDate('end')
  period_end!: string;
}

class RangeDto {
  @IsPeriodBoundaryDate('start')
  period_start!: string;
  @IsPeriodBoundaryDate('end')
  @IsValidPeriodRange()
  period_end!: string;
}

async function validateValues<T extends object>(
  ctor: new () => T,
  values: Partial<T>,
): Promise<string[]> {
  const obj = new ctor();
  Object.assign(obj, values);
  const errors = await validate(obj);
  return errors.flatMap((e) => Object.values(e.constraints ?? {}));
}

describe('period.validator helpers', () => {
  describe('lastDayOfMonthUTC', () => {
    it('returns 31 for January', () => {
      expect(lastDayOfMonthUTC(2026, 1)).toBe(31);
    });
    it('returns 28 for February in non-leap year (2026)', () => {
      expect(lastDayOfMonthUTC(2026, 2)).toBe(28);
    });
    it('returns 29 for February in leap year (2024)', () => {
      expect(lastDayOfMonthUTC(2024, 2)).toBe(29);
    });
    it('returns 30 for April', () => {
      expect(lastDayOfMonthUTC(2026, 4)).toBe(30);
    });
    it('returns 31 for December', () => {
      expect(lastDayOfMonthUTC(2026, 12)).toBe(31);
    });
  });

  describe('monthsBetweenInclusive', () => {
    it('returns 1 for same month', () => {
      expect(monthsBetweenInclusive(2026, 4, 2026, 4)).toBe(1);
    });
    it('returns 3 for Jan→Mar same year', () => {
      expect(monthsBetweenInclusive(2026, 1, 2026, 3)).toBe(3);
    });
    it('returns 4 for Nov 2025 → Feb 2026 (cross-year)', () => {
      expect(monthsBetweenInclusive(2025, 11, 2026, 2)).toBe(4);
    });
    it('returns 12 for Jan 2026 → Dec 2026', () => {
      expect(monthsBetweenInclusive(2026, 1, 2026, 12)).toBe(12);
    });
  });
});

describe('@IsPeriodString', () => {
  it.each([
    ['2026-04', true],
    ['2024-12', true],
    ['2020-01', true],
    ['2026-13', false],
    ['26-04', false],
    ['2026-4', false],
    ['2026-04-01', false],
    ['2019-12', false],
    ['', false],
  ])('value=%s → valid=%s', async (value, expected) => {
    const errors = await validateValues(PeriodStringDto, {
      period: value,
    } as Partial<PeriodStringDto>);
    if (expected) {
      expect(errors).toEqual([]);
    } else {
      expect(errors.length).toBeGreaterThan(0);
    }
  });

  it('rejects null/undefined', async () => {
    const errors = await validateValues(PeriodStringDto, {});
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('@IsPeriodBoundaryDate("start")', () => {
  it.each([
    ['2026-04-01', true],
    ['2026-12-01', true],
    ['2026-04-15', false],
    ['2026-04-31', false],
    ['2026-13-01', false],
    ['26-04-01', false],
    ['', false],
  ])('value=%s → valid=%s', async (value, expected) => {
    const errors = await validateValues(BoundaryStartDto, {
      period_start: value,
    });
    if (expected) {
      expect(errors).toEqual([]);
    } else {
      expect(errors.length).toBeGreaterThan(0);
    }
  });
});

describe('@IsPeriodBoundaryDate("end")', () => {
  it.each([
    ['2026-04-30', true],
    ['2026-12-31', true],
    ['2024-02-29', true], // leap year
    ['2026-02-28', true],
    ['2026-04-31', false], // April has 30 days
    ['2026-02-29', false], // 2026 not leap
    ['2026-02-30', false],
    ['2026-04-25', false], // not last day
    ['', false],
  ])('value=%s → valid=%s', async (value, expected) => {
    const errors = await validateValues(BoundaryEndDto, {
      period_end: value,
    });
    if (expected) {
      expect(errors).toEqual([]);
    } else {
      expect(errors.length).toBeGreaterThan(0);
    }
  });
});

describe('@IsValidPeriodRange', () => {
  it('accepts cross-month range Jan→Mar 2026', async () => {
    const errors = await validateValues(RangeDto, {
      period_start: '2026-01-01',
      period_end: '2026-03-31',
    });
    expect(errors).toEqual([]);
  });

  it('accepts cross-year Nov 2025 → Feb 2026', async () => {
    const errors = await validateValues(RangeDto, {
      period_start: '2025-11-01',
      period_end: '2026-02-28',
    });
    expect(errors).toEqual([]);
  });

  it('accepts single month (Apr 2026)', async () => {
    const errors = await validateValues(RangeDto, {
      period_start: '2026-04-01',
      period_end: '2026-04-30',
    });
    expect(errors).toEqual([]);
  });

  it('rejects period_end < period_start (May → Mar)', async () => {
    const errors = await validateValues(RangeDto, {
      period_start: '2026-05-01',
      period_end: '2026-03-31',
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects range > 12 months (Jan 2025 → Feb 2026 = 14 months)', async () => {
    const errors = await validateValues(RangeDto, {
      period_start: '2025-01-01',
      period_end: '2026-02-28',
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts exactly 12 months (Jan 2026 → Dec 2026)', async () => {
    const errors = await validateValues(RangeDto, {
      period_start: '2026-01-01',
      period_end: '2026-12-31',
    });
    expect(errors).toEqual([]);
  });
});
