import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

const PERIOD_STRING_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
const BOUNDARY_DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MIN_PERIOD_YEAR = 2020;
const MAX_RANGE_MONTHS = 12;

export function lastDayOfMonthUTC(year: number, month1Indexed: number): number {
  return new Date(Date.UTC(year, month1Indexed, 0)).getUTCDate();
}

export function monthsBetweenInclusive(
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number,
): number {
  return (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
}

/**
 * Validates that a string matches `YYYY-MM` (single-month) format.
 * Accepts: `2026-04`, `2024-12`. Rejects: `2026-13`, `26-04`, `2026-4`, `2026-04-01`.
 */
export function IsPeriodString(opts?: ValidationOptions): PropertyDecorator {
  return function (object: object, propertyName: string | symbol): void {
    registerDecorator({
      name: 'isPeriodString',
      target: object.constructor,
      propertyName: propertyName as string,
      options: opts,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') return false;
          if (!PERIOD_STRING_REGEX.test(value)) return false;
          const year = Number(value.slice(0, 4));
          if (year < MIN_PERIOD_YEAR) return false;
          return true;
        },
        defaultMessage(): string {
          return 'period must match YYYY-MM (e.g. 2026-04) and year >= 2020';
        },
      },
    });
  };
}

/**
 * Validates that a date string snaps to month-boundary:
 *  - boundary='start': must be `YYYY-MM-01`
 *  - boundary='end':   must be `YYYY-MM-{lastDay of that month}` (handles leap year)
 */
export function IsPeriodBoundaryDate(
  boundary: 'start' | 'end',
  opts?: ValidationOptions,
): PropertyDecorator {
  return function (object: object, propertyName: string | symbol): void {
    registerDecorator({
      name: 'isPeriodBoundaryDate',
      target: object.constructor,
      propertyName: propertyName as string,
      options: opts,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') return false;
          if (!BOUNDARY_DATE_REGEX.test(value)) return false;
          const [yStr, mStr, dStr] = value.split('-');
          const year = Number(yStr);
          const month = Number(mStr);
          const day = Number(dStr);
          if (year < MIN_PERIOD_YEAR) return false;
          if (boundary === 'start') {
            return day === 1;
          }
          return day === lastDayOfMonthUTC(year, month);
        },
        defaultMessage(args: ValidationArguments): string {
          const b = boundary === 'start' ? '01' : 'last day of month';
          return `${args.property} must be a YYYY-MM-DD string with day = ${b}`;
        },
      },
    });
  };
}

/**
 * Cross-field validator: validates that `period_end >= period_start`,
 * span <= MAX_RANGE_MONTHS (12), and both fields are non-empty.
 *
 * Apply on the `period_end` property; reads sibling `period_start` from the object.
 */
export function IsValidPeriodRange(
  opts?: ValidationOptions,
): PropertyDecorator {
  return function (object: object, propertyName: string | symbol): void {
    registerDecorator({
      name: 'isValidPeriodRange',
      target: object.constructor,
      propertyName: propertyName as string,
      options: opts,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          if (typeof value !== 'string') return false;
          const obj = args.object as Record<string, unknown>;
          const start = obj.period_start;
          if (typeof start !== 'string') return false;
          // Compare as dates (string compare works for YYYY-MM-DD)
          if (value < start) return false;
          const [sy, sm] = start.split('-').map(Number);
          const [ey, em] = value.split('-').map(Number);
          const months = monthsBetweenInclusive(sy, sm, ey, em);
          if (months < 1 || months > MAX_RANGE_MONTHS) return false;
          return true;
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} must be >= period_start and span at most ${MAX_RANGE_MONTHS} months`;
        },
      },
    });
  };
}
