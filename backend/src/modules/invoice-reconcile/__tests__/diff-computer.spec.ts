/**
 * F-076 — diff-computer pure function tests.
 */
import { computeDiff, DiffSnapshot } from '../services/diff-computer';
import { MissingInvoiceRowDto } from '../dto/missing-invoice-row.dto';

function row(
  overrides: Partial<MissingInvoiceRowDto>,
): MissingInvoiceRowDto {
  return {
    orderId: 200029416,
    orderCode: '#5B200029416IB',
    raceId: 140,
    email: 'test@5bib.com',
    buyerName: 'Hiền Nghiêm',
    totalPrice: 12000,
    paymentOn: '2026-06-08T17:27:39Z',
    orderCategory: 'ORDINARY',
    ageHours: 13,
    bucket: 'UNISSUED',
    severity: 'WARN',
    breached: false,
    misaInvNo: null,
    duplicateCount: undefined,
    ...overrides,
  };
}

describe('computeDiff', () => {
  it('returns empty when previous undefined (first run)', () => {
    const cur: DiffSnapshot = { missing: [row({})] };
    expect(computeDiff(cur, undefined)).toEqual([]);
  });

  it('detects PAID_NEW when orderId appears in current but not previous', () => {
    const prev: DiffSnapshot = { missing: [] };
    const cur: DiffSnapshot = {
      missing: [row({ orderId: 200029416 })],
    };
    const events = computeDiff(cur, prev);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('PAID_NEW');
    expect(events[0]).toMatchObject({
      type: 'PAID_NEW',
      orderId: 200029416,
      orderCode: '#5B200029416IB',
      raceId: 140,
    });
  });

  it('detects ISSUED when orderId disappeared from missing', () => {
    const prev: DiffSnapshot = {
      missing: [
        row({
          orderId: 200029420,
          bucket: 'SYNC_LAG',
          misaInvNo: '00000023',
        }),
      ],
    };
    const cur: DiffSnapshot = { missing: [] };
    const events = computeDiff(cur, prev);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('ISSUED');
    expect(events[0]).toMatchObject({
      type: 'ISSUED',
      orderId: 200029420,
      misaInvNo: '00000023',
    });
  });

  it('detects BUCKET_ESCALATED when severity escalates', () => {
    const prev: DiffSnapshot = {
      missing: [row({ orderId: 1, ageHours: 13, severity: 'WARN' })],
    };
    const cur: DiffSnapshot = {
      missing: [row({ orderId: 1, ageHours: 21, severity: 'CRITICAL' })],
    };
    const events = computeDiff(cur, prev);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('BUCKET_ESCALATED');
    expect(events[0]).toMatchObject({
      type: 'BUCKET_ESCALATED',
      orderId: 1,
      ageHoursPrev: 13,
      ageHoursNow: 21,
      severityPrev: 'WARN',
      severityNow: 'CRITICAL',
    });
  });

  it('does NOT emit BUCKET_ESCALATED when severity unchanged', () => {
    const prev: DiffSnapshot = {
      missing: [row({ orderId: 1, severity: 'WARN', ageHours: 13 })],
    };
    const cur: DiffSnapshot = {
      missing: [row({ orderId: 1, severity: 'WARN', ageHours: 15 })],
    };
    const events = computeDiff(cur, prev);
    expect(events).toHaveLength(0);
  });

  it('detects DUPLICATE_NEW for fresh DUPLICATE bucket', () => {
    const prev: DiffSnapshot = { missing: [] };
    const cur: DiffSnapshot = {
      missing: [
        row({
          orderId: 200029416,
          bucket: 'DUPLICATE',
          duplicateCount: 5,
          severity: 'CRITICAL',
        }),
      ],
    };
    const events = computeDiff(cur, prev);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('DUPLICATE_NEW');
    expect(events[0]).toMatchObject({
      type: 'DUPLICATE_NEW',
      orderId: 200029416,
      duplicateCount: 5,
    });
  });

  it('detects DUPLICATE_NEW when previously UNISSUED then becomes DUPLICATE', () => {
    const prev: DiffSnapshot = {
      missing: [row({ orderId: 1, bucket: 'UNISSUED', severity: 'WARN' })],
    };
    const cur: DiffSnapshot = {
      missing: [
        row({
          orderId: 1,
          bucket: 'DUPLICATE',
          severity: 'CRITICAL',
          duplicateCount: 3,
        }),
      ],
    };
    const events = computeDiff(cur, prev);
    // Both BUCKET_ESCALATED + DUPLICATE_NEW emitted
    const types = events.map((e) => e.type);
    expect(types).toContain('BUCKET_ESCALATED');
    expect(types).toContain('DUPLICATE_NEW');
  });
});
