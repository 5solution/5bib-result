/**
 * F-076 TC-01 → TC-10 — pure classifier tests.
 *
 * Real PROD orderIds from Manager session 2026-06-08 verified:
 *   - race 140: 200029416, 200029420, 200029458, 200025061
 *   - race 220: 200029393, 200029396, 200029493
 *
 * Snapshot tests use these IDs — NOT fake demo data (PAUSE point #7).
 */
import {
  classify,
  ClassifierInput,
  isB2cRefId,
  extractOrderIdFromRefId,
  deriveSeverity,
  ageBucket4h,
  MisaInvoiceLite,
  RawDbOrder,
} from '../services/reconcile-classifier';

const NOW_UTC = new Date('2026-06-09T00:00:00Z'); // 07:00 ICT 2026-06-09
const THRESHOLDS = { warnHours: 12, criticalHours: 20, breachedHours: 24 };

function dbOrder(overrides: Partial<RawDbOrder>): RawDbOrder {
  return {
    id: 200029420,
    raceId: 140,
    name: '#5B200029420IB',
    email: 'test@5bib.com',
    buyerName: 'Hiền Nghiêm',
    totalPrice: 12000,
    paymentOn: new Date('2026-06-05T09:45:00Z'),
    orderCategory: 'ORDINARY',
    vatRef: null,
    ...overrides,
  };
}

function misaInv(overrides: Partial<MisaInvoiceLite>): MisaInvoiceLite {
  return {
    RefID: '200029420-20260608172739',
    InvNo: '00000023',
    InvSeries: '1C26MBB',
    InvDate: '2026-06-08T00:00:00+07:00',
    TotalAmount: 12000,
    BuyerFullName: 'Hiền Nghiêm',
    ReferenceType: null,
    ItemName: '5BIB x COROS 5KM Priority 2434',
    ItemCode: '5KMPriority',
    ...overrides,
  };
}

describe('reconcile-classifier — pure helpers', () => {
  describe('isB2cRefId (BR-06)', () => {
    it('matches B2C 14-digit timestamp format', () => {
      expect(isB2cRefId('200029416-20260608172739')).toBe(true);
    });
    it('matches B2C legacy slash-date format', () => {
      expect(isB2cRefId('200029416-06/05/2026 15:49:19Z')).toBe(true);
    });
    it('rejects B2B GUID format', () => {
      expect(
        isB2cRefId('90d6eb31-a652-4ffd-82ab-5e1b451fcd7a'),
      ).toBe(false);
    });
    it('rejects bare orderId without timestamp', () => {
      expect(isB2cRefId('200029999')).toBe(false);
    });
  });

  describe('extractOrderIdFromRefId (BR-05)', () => {
    it('extracts numeric prefix from B2C RefID', () => {
      expect(
        extractOrderIdFromRefId('200029416-20260608172739'),
      ).toBe(200029416);
    });
    it('returns null for B2B GUID', () => {
      expect(
        extractOrderIdFromRefId('90d6eb31-a652-4ffd'),
      ).toBeNull();
    });
  });

  describe('deriveSeverity (BR-08)', () => {
    it('OK bucket → INFO', () => {
      expect(deriveSeverity('OK', 100, THRESHOLDS)).toBe('INFO');
    });
    it('SYNC_LAG → WARN', () => {
      expect(deriveSeverity('SYNC_LAG', 100, THRESHOLDS)).toBe('WARN');
    });
    it('DUPLICATE → CRITICAL', () => {
      expect(deriveSeverity('DUPLICATE', 0, THRESHOLDS)).toBe('CRITICAL');
    });
    it('UNISSUED age 13h → WARN', () => {
      expect(deriveSeverity('UNISSUED', 13, THRESHOLDS)).toBe('WARN');
    });
    it('UNISSUED age 22h → CRITICAL', () => {
      expect(deriveSeverity('UNISSUED', 22, THRESHOLDS)).toBe('CRITICAL');
    });
    it('UNISSUED age 8h → INFO', () => {
      expect(deriveSeverity('UNISSUED', 8, THRESHOLDS)).toBe('INFO');
    });
  });

  describe('ageBucket4h (BR-10)', () => {
    it('groups into 4h windows', () => {
      expect(ageBucket4h(0)).toBe(0);
      expect(ageBucket4h(3)).toBe(0);
      expect(ageBucket4h(4)).toBe(4);
      expect(ageBucket4h(12)).toBe(12);
      expect(ageBucket4h(19)).toBe(16);
      expect(ageBucket4h(20)).toBe(20);
      expect(ageBucket4h(25)).toBe(24);
    });
  });
});

describe('classify() — full classification', () => {
  // TC-01 — OK bucket (vat_ref set + MISA match)
  it('TC-01: classifies OK when vat_ref set + MISA has single original invoice', () => {
    const input: ClassifierInput = {
      dbOrders: [dbOrder({ id: 200029420, vatRef: '00000023' })],
      misaInvoices: [misaInv({ RefID: '200029420-20260608172739' })],
      now: NOW_UTC,
      thresholds: THRESHOLDS,
    };
    const out = classify(input);
    expect(out.missing).toHaveLength(0);
    expect(out.issuedCount).toBe(1);
    expect(out.expectedCount).toBe(1);
    expect(out.orphan).toHaveLength(0);
  });

  // TC-02 — SYNC_LAG (DB NULL, MISA has gốc)
  it('TC-02: classifies SYNC_LAG when DB vat_ref NULL but MISA has gốc invoice', () => {
    const input: ClassifierInput = {
      dbOrders: [dbOrder({ id: 200029416, name: '#5B200029416IB', vatRef: null })],
      misaInvoices: [
        misaInv({
          RefID: '200029416-20260608110754',
          InvNo: '00000018',
          ReferenceType: null,
        }),
      ],
      now: NOW_UTC,
      thresholds: THRESHOLDS,
    };
    const out = classify(input);
    expect(out.missing).toHaveLength(1);
    expect(out.missing[0].bucket).toBe('SYNC_LAG');
    expect(out.missing[0].severity).toBe('WARN');
    expect(out.missing[0].misaInvNo).toBe('00000018');
    expect(out.missing[0].orderCode).toBe('#5B200029416IB');
  });

  // TC-03 — UNISSUED WARN (age 13h)
  it('TC-03: classifies UNISSUED + WARN when age 13h', () => {
    const paid = new Date(NOW_UTC.getTime() - 13 * 3_600_000);
    const input: ClassifierInput = {
      dbOrders: [dbOrder({ id: 999, vatRef: null, paymentOn: paid })],
      misaInvoices: [],
      now: NOW_UTC,
      thresholds: THRESHOLDS,
    };
    const out = classify(input);
    expect(out.missing).toHaveLength(1);
    expect(out.missing[0].bucket).toBe('UNISSUED');
    expect(out.missing[0].severity).toBe('WARN');
    expect(out.missing[0].ageHours).toBe(13);
  });

  // TC-04 — UNISSUED CRITICAL (age 22h)
  it('TC-04: classifies UNISSUED + CRITICAL when age 22h', () => {
    const paid = new Date(NOW_UTC.getTime() - 22 * 3_600_000);
    const input: ClassifierInput = {
      dbOrders: [dbOrder({ id: 999, vatRef: null, paymentOn: paid })],
      misaInvoices: [],
      now: NOW_UTC,
      thresholds: THRESHOLDS,
    };
    const out = classify(input);
    expect(out.missing[0].severity).toBe('CRITICAL');
    expect(out.missing[0].breached).toBe(false);
    expect(out.atRiskCount).toBe(1);
  });

  // TC-05 — UNISSUED BREACHED (age 25h)
  it('TC-05: classifies UNISSUED + BREACHED when age 25h', () => {
    const paid = new Date(NOW_UTC.getTime() - 25 * 3_600_000);
    const input: ClassifierInput = {
      dbOrders: [dbOrder({ id: 999, vatRef: null, paymentOn: paid })],
      misaInvoices: [],
      now: NOW_UTC,
      thresholds: THRESHOLDS,
    };
    const out = classify(input);
    expect(out.missing[0].breached).toBe(true);
    expect(out.breachedCount).toBe(1);
    expect(out.atRiskCount).toBe(1);
  });

  // TC-06 — DUPLICATE (≥2 invoice gốc cùng orderId)
  it('TC-06: classifies DUPLICATE when MISA has ≥2 original invoices for same orderId', () => {
    const input: ClassifierInput = {
      dbOrders: [dbOrder({ id: 200029416, vatRef: '00000022' })],
      misaInvoices: [
        misaInv({ RefID: '200029416-20260608110754', InvNo: '00000018' }),
        misaInv({ RefID: '200029416-20260608172306', InvNo: '00000019' }),
        misaInv({ RefID: '200029416-20260608172330', InvNo: '00000020' }),
        misaInv({ RefID: '200029416-20260608172348', InvNo: '00000021' }),
        misaInv({ RefID: '200029416-20260608172739', InvNo: '00000022' }),
      ],
      now: NOW_UTC,
      thresholds: THRESHOLDS,
    };
    const out = classify(input);
    expect(out.missing[0].bucket).toBe('DUPLICATE');
    expect(out.missing[0].duplicateCount).toBe(5);
    expect(out.duplicateCount).toBe(1);
    expect(out.missing[0].severity).toBe('CRITICAL');
  });

  // TC-07 — DUPLICATE EXCLUDE adjustment
  it('TC-07: excludes adjustment/replacement records from DUPLICATE count', () => {
    const input: ClassifierInput = {
      dbOrders: [dbOrder({ id: 200029420, vatRef: '00000023' })],
      misaInvoices: [
        misaInv({ RefID: '200029420-1', ReferenceType: null }), // gốc
        misaInv({ RefID: '200029420-2', ReferenceType: 1 }), // thay thế
        misaInv({ RefID: '200029420-3', ReferenceType: 2 }), // điều chỉnh
      ],
      now: NOW_UTC,
      thresholds: THRESHOLDS,
    };
    const out = classify(input);
    // Only 1 original → OK
    expect(out.missing).toHaveLength(0);
    expect(out.issuedCount).toBe(1);
  });

  // TC-09 — Filter INSURANCE + MANUAL
  it('TC-09: filters INSURANCE and MANUAL categories out of expected count', () => {
    const input: ClassifierInput = {
      dbOrders: [
        dbOrder({ id: 1, orderCategory: 'ORDINARY' }),
        dbOrder({ id: 2, orderCategory: 'INSURANCE' }),
        dbOrder({ id: 3, orderCategory: 'MANUAL' }),
        dbOrder({ id: 4, orderCategory: 'CODE_TRANSFER' }),
      ],
      misaInvoices: [],
      now: NOW_UTC,
      thresholds: THRESHOLDS,
    };
    const out = classify(input);
    expect(out.expectedCount).toBe(2); // only ORDINARY + CODE_TRANSFER
    expect(out.missing.map((m) => m.orderId).sort()).toEqual([1, 4]);
  });

  // TC-10 — MISA orphan
  it('TC-10: detects MISA orphan invoice not matching any DB order', () => {
    const input: ClassifierInput = {
      dbOrders: [dbOrder({ id: 200029420, vatRef: '00000023' })],
      misaInvoices: [
        misaInv({ RefID: '200029420-1', InvNo: '00000023' }),
        misaInv({ RefID: '200030555-20260608183000', InvNo: '00000050' }),
      ],
      now: NOW_UTC,
      thresholds: THRESHOLDS,
    };
    const out = classify(input);
    expect(out.orphan).toHaveLength(1);
    expect(out.orphan[0].refId).toBe('200030555-20260608183000');
    expect(out.orphan[0].invNo).toBe('00000050');
  });

  // Extra — B2B GUID RefID is filtered out (no orphan, no DUPLICATE)
  it('B2B GUID RefID is filtered out before classification', () => {
    const input: ClassifierInput = {
      dbOrders: [],
      misaInvoices: [
        misaInv({
          RefID: '90d6eb31-a652-4ffd-82ab-5e1b451fcd7a',
          InvNo: '00000099',
        }),
      ],
      now: NOW_UTC,
      thresholds: THRESHOLDS,
    };
    const out = classify(input);
    expect(out.orphan).toHaveLength(0);
  });

  // Stable sort: severity DESC then age DESC
  it('sorts missing rows by severity DESC then age DESC', () => {
    const paid12 = new Date(NOW_UTC.getTime() - 12 * 3_600_000);
    const paid22 = new Date(NOW_UTC.getTime() - 22 * 3_600_000);
    const input: ClassifierInput = {
      dbOrders: [
        dbOrder({ id: 1, vatRef: null, paymentOn: paid12 }),
        dbOrder({ id: 2, vatRef: null, paymentOn: paid22 }),
      ],
      misaInvoices: [],
      now: NOW_UTC,
      thresholds: THRESHOLDS,
    };
    const out = classify(input);
    // Order 2 (age 22h CRITICAL) before order 1 (age 12h WARN)
    expect(out.missing[0].orderId).toBe(2);
    expect(out.missing[1].orderId).toBe(1);
  });
});
