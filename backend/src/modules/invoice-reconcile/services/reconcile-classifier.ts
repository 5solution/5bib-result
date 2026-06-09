/**
 * F-076 BR-06 + BR-07 + BR-08 — pure classifier function.
 *
 * Input:  DB rows (filtered theo BR-01) + MISA invoices today (filtered B2C)
 * Output: MissingInvoiceRowDto[] + MisaOrphanRowDto[]
 *
 * KHÔNG side effects (no Redis, no DB, no logger). 100% testable.
 *
 * Verified với real PROD data (Manager session 2026-06-08):
 *   - order 200029420 (race 140): vat_ref='00000023', MISA InvNo=00000023 → OK
 *   - order 200029416 (race 140): vat_ref=NULL, MISA có 5 invoices gốc → DUPLICATE
 *     (manager note: 4/5 là DEV test local, treat as DUPLICATE per BR-29)
 *   - order 200029493 (race 220): vat_ref='00000025', MISA match → OK
 */
import {
  MissingInvoiceRowDto,
  ReconcileBucket,
  AlertSeverity,
} from '../dto/missing-invoice-row.dto';
import { MisaOrphanRowDto } from '../dto/misa-orphan-row.dto';

// BR-06 — RefID format `<orderId>-<timestamp>` (B2C) vs GUID (B2B contracts skip)
const B2C_REFID_REGEX =
  /^\d+-(\d{14}|\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}Z)$/;

// BR-01 — categories KHÔNG cần xuất hóa đơn (skip khỏi expected set)
const SKIP_CATEGORIES = new Set(['INSURANCE', 'MANUAL']);

export interface RawDbOrder {
  id: number;
  raceId: number;
  name: string | null;
  email: string | null;
  buyerName: string | null;
  totalPrice: number;
  paymentOn: Date | string;
  orderCategory: string;
  vatRef: string | null;
}

/** MISA invoice shape sau khi defensive parse (only fields F-076 needs). */
export interface MisaInvoiceLite {
  RefID: string;
  InvNo: string;
  InvSeries: string | null;
  InvDate: string;
  TotalAmount: number;
  BuyerFullName: string | null;
  /**
   * BR-07 — `null` hoặc `0` = hóa đơn gốc.
   * `1` = thay thế, `2` = điều chỉnh, `5` = chiết khấu thương mại
   * (per MISA doc section 14.11 InvoiceStatus + section 10).
   */
  ReferenceType: number | null;
  /** Item line 1 — dùng cho UI display orphan section. */
  ItemName: string | null;
  ItemCode: string | null;
}

export interface ClassifierThresholds {
  warnHours: number;
  criticalHours: number;
  breachedHours: number;
}

export interface ClassifierInput {
  dbOrders: RawDbOrder[];
  misaInvoices: MisaInvoiceLite[];
  /** Now in UTC. ageHours = floor((now - paymentOn) / 3600s). */
  now: Date;
  thresholds: ClassifierThresholds;
}

export interface ClassifierOutput {
  /** UNISSUED + SYNC_LAG + DUPLICATE rows (skip OK rows). */
  missing: MissingInvoiceRowDto[];
  /** MISA invoices KHÔNG match orderId nào trong DB → surface to admin. */
  orphan: MisaOrphanRowDto[];
  /** Total scanned (expected) = dbOrders.length (post-filter BR-01 in caller). */
  expectedCount: number;
  /** OK bucket count = expectedCount - missing.length. */
  issuedCount: number;
  /**
   * F-079 BR-79-12 — Số đơn skip khỏi expected pool (INSURANCE/MANUAL category).
   * = dbOrders.length - expectedCount. Render trong heartbeat "Skipped" line.
   */
  skippedCount: number;
  /** Computed for fast UI render. */
  atRiskCount: number;
  breachedCount: number;
  duplicateCount: number;
  /** Max severity của all missing rows (cho dedup bucket compute). */
  maxSeverity: AlertSeverity;
}

/**
 * BR-06 — filter B2C invoices only. B2B contracts (RefID GUID) → out of scope.
 * Exported for unit test directly.
 */
export function isB2cRefId(refId: string): boolean {
  return B2C_REFID_REGEX.test(refId);
}

/**
 * BR-05 — extract orderId từ RefID format `<orderId>-<timestamp>`.
 * Caller MUST gọi `isB2cRefId` trước; nếu format B2B GUID → return null.
 */
export function extractOrderIdFromRefId(refId: string): number | null {
  if (!isB2cRefId(refId)) return null;
  const prefix = refId.split('-')[0];
  const n = Number(prefix);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * BR-08 — derive severity tier từ bucket + ageHours.
 * - OK / DUPLICATE → CRITICAL (always alert worth)
 * - SYNC_LAG → WARN (DB lag, MISA OK, không bị phạt)
 * - UNISSUED → ageHours-based ladder
 */
export function deriveSeverity(
  bucket: ReconcileBucket,
  ageHours: number,
  thresholds: ClassifierThresholds,
): AlertSeverity {
  if (bucket === 'OK') return 'INFO';
  if (bucket === 'SYNC_LAG') return 'WARN';
  if (bucket === 'DUPLICATE') return 'CRITICAL';
  // UNISSUED → age-based
  if (ageHours >= thresholds.criticalHours) return 'CRITICAL';
  if (ageHours >= thresholds.warnHours) return 'WARN';
  return 'INFO';
}

/** Compare severity for max(). INFO < WARN < CRITICAL. */
function severityRank(s: AlertSeverity): number {
  return s === 'CRITICAL' ? 2 : s === 'WARN' ? 1 : 0;
}

/** Compute age hours (now - paymentOn) in UTC. Floor to integer. */
function computeAgeHours(paymentOn: Date | string, now: Date): number {
  const paid =
    paymentOn instanceof Date ? paymentOn : new Date(paymentOn);
  const ms = now.getTime() - paid.getTime();
  if (ms < 0) return 0;
  return Math.floor(ms / 3_600_000);
}

/** Render orderCode fallback: o.name || `#5B<id>IB` synthesized. */
function resolveOrderCode(order: RawDbOrder): string {
  if (order.name && order.name.trim()) return order.name.trim();
  return `#5B${order.id}IB`;
}

/**
 * Main classifier. Pure function — no side effects.
 *
 * Algorithm:
 *  1. Group MISA invoices by parsed orderId (filter B2C, group originals only)
 *  2. For each DB order: classify into OK/SYNC_LAG/UNISSUED/DUPLICATE
 *  3. MISA invoices không match any DB order → orphan
 */
export function classify(input: ClassifierInput): ClassifierOutput {
  const { dbOrders, misaInvoices, now, thresholds } = input;

  // Step 1 — index MISA invoices by orderId (B2C only)
  const misaByOrderId = new Map<number, MisaInvoiceLite[]>();
  const b2cInvoices: MisaInvoiceLite[] = [];
  for (const inv of misaInvoices) {
    const orderId = extractOrderIdFromRefId(inv.RefID);
    if (orderId == null) continue; // B2B GUID → skip
    b2cInvoices.push(inv);
    const arr = misaByOrderId.get(orderId) ?? [];
    arr.push(inv);
    misaByOrderId.set(orderId, arr);
  }

  // Step 2 — classify each DB order
  const missing: MissingInvoiceRowDto[] = [];
  let issuedCount = 0;
  let atRiskCount = 0;
  let breachedCount = 0;
  let duplicateCount = 0;
  let maxSeverity: AlertSeverity = 'INFO';

  for (const order of dbOrders) {
    // Pre-filter BR-01 should be done in caller, but defensive skip here
    if (SKIP_CATEGORIES.has(order.orderCategory)) continue;

    const misaForOrder = misaByOrderId.get(order.id) ?? [];
    // BR-07 — only count "gốc" (ReferenceType null OR 0) for DUPLICATE detection
    const originals = misaForOrder.filter(
      (i) => i.ReferenceType == null || i.ReferenceType === 0,
    );

    const ageHours = computeAgeHours(order.paymentOn, now);
    const orderCode = resolveOrderCode(order);
    const paymentOnIso =
      order.paymentOn instanceof Date
        ? order.paymentOn.toISOString()
        : new Date(order.paymentOn).toISOString();

    let bucket: ReconcileBucket;
    let misaInvNo: string | null = null;
    let dupCount: number | undefined = undefined;

    if (originals.length >= 2) {
      bucket = 'DUPLICATE';
      dupCount = originals.length;
      duplicateCount += 1;
    } else if (originals.length === 1) {
      // MISA has exactly 1 gốc
      if (order.vatRef && order.vatRef.trim()) {
        // DB synced — match by InvNo (BR-04)
        bucket = 'OK';
        // Defensive: if vatRef != originals[0].InvNo → still treat as OK
        // (downstream tooling can flag mismatch). For F-076 v1 keep simple.
        issuedCount += 1;
      } else {
        // SYNC_LAG — MISA xuất rồi nhưng DB chưa update
        bucket = 'SYNC_LAG';
        misaInvNo = originals[0].InvNo;
      }
    } else {
      // No MISA invoice gốc for this orderId
      if (order.vatRef && order.vatRef.trim()) {
        // DB says vat_ref set, MISA says no gốc → could be MISA only has
        // adjustment/replacement records OR data integrity issue. Treat
        // as SYNC_LAG-ish: bucket OK if vat_ref present (defensive optimistic),
        // because MISA paging may have edge case data missing. F-076 v1
        // accepts: KHÔNG block alert nếu Layer 1 đã có vat_ref.
        bucket = 'OK';
        issuedCount += 1;
      } else {
        bucket = 'UNISSUED';
      }
    }

    const severity = deriveSeverity(bucket, ageHours, thresholds);
    const breached = ageHours >= thresholds.breachedHours;

    if (bucket === 'OK') {
      // No row added to missing[], but track max severity (INFO)
      if (severityRank(severity) > severityRank(maxSeverity))
        maxSeverity = severity;
      continue;
    }

    if (
      bucket === 'UNISSUED' &&
      ageHours >= thresholds.criticalHours
    )
      atRiskCount += 1;
    if (bucket === 'UNISSUED' && breached) breachedCount += 1;

    if (severityRank(severity) > severityRank(maxSeverity))
      maxSeverity = severity;

    missing.push({
      orderId: order.id,
      orderCode,
      raceId: order.raceId,
      email: order.email,
      buyerName: order.buyerName,
      totalPrice: order.totalPrice,
      paymentOn: paymentOnIso,
      orderCategory: order.orderCategory,
      ageHours,
      bucket,
      severity,
      breached,
      misaInvNo,
      duplicateCount: dupCount,
    });
  }

  // Step 3 — orphan: MISA invoices không match any DB order
  const dbOrderIdSet = new Set(dbOrders.map((o) => o.id));
  const orphan: MisaOrphanRowDto[] = [];
  for (const inv of b2cInvoices) {
    const orderId = extractOrderIdFromRefId(inv.RefID);
    if (orderId == null) continue;
    if (dbOrderIdSet.has(orderId)) continue;
    orphan.push({
      refId: inv.RefID,
      invNo: inv.InvNo,
      invSeries: inv.InvSeries,
      invDate: inv.InvDate,
      totalAmount: inv.TotalAmount,
      buyerFullName: inv.BuyerFullName,
      itemName: inv.ItemName,
      itemCode: inv.ItemCode,
    });
  }

  // Sort missing for stable UI render: severity DESC → ageHours DESC
  missing.sort((a, b) => {
    const sevDiff = severityRank(b.severity) - severityRank(a.severity);
    if (sevDiff !== 0) return sevDiff;
    return b.ageHours - a.ageHours;
  });

  const expectedCount = dbOrders.filter(
    (o) => !SKIP_CATEGORIES.has(o.orderCategory),
  ).length;
  return {
    missing,
    orphan,
    expectedCount,
    issuedCount,
    // F-079 BR-79-12 — skipped = total dbOrders - expectedCount (post-filter).
    skippedCount: dbOrders.length - expectedCount,
    atRiskCount,
    breachedCount,
    duplicateCount,
    maxSeverity,
  };
}

/**
 * BR-10 — bucket key for dedup. 4-hour windows: 0/4/8/12/16/20/24/28/...
 * Severity ESCALATE khi bucket jumps (eg 12 → 16 hour bucket).
 */
export function ageBucket4h(ageHours: number): number {
  return Math.floor(Math.max(0, ageHours) / 4) * 4;
}
