/**
 * F-076 BR-25 + BR-26..29 — diff computer.
 *
 * Pure function: cho 2 snapshots (current + previous), compute change events
 * cho Loại 1 INFO Hourly Recap diff section + dedup logic alert URGENT.
 *
 * Events:
 *   - PAID_NEW: orderId mới xuất hiện trong missing list (vừa paid + chưa xuất)
 *   - ISSUED: orderId từ SYNC_LAG/UNISSUED → OK (đã xuất thành công)
 *   - BUCKET_ESCALATED: orderId vẫn missing nhưng severity tier nhảy (eg WARN→CRITICAL)
 *   - DUPLICATE_NEW: orderId mới xuất hiện DUPLICATE bucket
 *
 * Pure function — no Redis, no DB. Caller pass in 2 snapshots.
 */
import { MissingInvoiceRowDto } from '../dto/missing-invoice-row.dto';

export type DiffEvent =
  | { type: 'PAID_NEW'; orderId: number; orderCode: string; raceId: number; totalPrice: number }
  | { type: 'ISSUED'; orderId: number; orderCode: string; misaInvNo: string | null }
  | {
      type: 'BUCKET_ESCALATED';
      orderId: number;
      orderCode: string;
      raceId: number;
      ageHoursPrev: number;
      ageHoursNow: number;
      severityPrev: string;
      severityNow: string;
    }
  | { type: 'DUPLICATE_NEW'; orderId: number; orderCode: string; raceId: number; duplicateCount: number };

export interface DiffSnapshot {
  /** Missing rows từ ClassifierOutput. Empty array if no snapshot. */
  missing: MissingInvoiceRowDto[];
  /** issuedCount snapshot. Optional (default 0) cho first-tick case. */
  issuedCount?: number;
}

/**
 * Compute event diff. previous=undefined → return empty (first run, no diff).
 */
export function computeDiff(
  current: DiffSnapshot,
  previous: DiffSnapshot | undefined,
): DiffEvent[] {
  if (!previous) return [];

  const events: DiffEvent[] = [];

  const prevByOrderId = new Map<number, MissingInvoiceRowDto>();
  for (const row of previous.missing) prevByOrderId.set(row.orderId, row);

  const curByOrderId = new Map<number, MissingInvoiceRowDto>();
  for (const row of current.missing) curByOrderId.set(row.orderId, row);

  // PAID_NEW + BUCKET_ESCALATED + DUPLICATE_NEW
  for (const row of current.missing) {
    const prev = prevByOrderId.get(row.orderId);
    if (!prev) {
      // brand new
      if (row.bucket === 'DUPLICATE') {
        events.push({
          type: 'DUPLICATE_NEW',
          orderId: row.orderId,
          orderCode: row.orderCode,
          raceId: row.raceId,
          duplicateCount: row.duplicateCount ?? 2,
        });
      } else {
        events.push({
          type: 'PAID_NEW',
          orderId: row.orderId,
          orderCode: row.orderCode,
          raceId: row.raceId,
          totalPrice: row.totalPrice,
        });
      }
      continue;
    }
    // Existing — check escalation
    if (row.severity !== prev.severity) {
      const rank: Record<string, number> = { INFO: 0, WARN: 1, CRITICAL: 2 };
      if ((rank[row.severity] ?? 0) > (rank[prev.severity] ?? 0)) {
        events.push({
          type: 'BUCKET_ESCALATED',
          orderId: row.orderId,
          orderCode: row.orderCode,
          raceId: row.raceId,
          ageHoursPrev: prev.ageHours,
          ageHoursNow: row.ageHours,
          severityPrev: prev.severity,
          severityNow: row.severity,
        });
      }
    }
    // DUPLICATE_NEW upgrade: prev was non-DUPLICATE → now DUPLICATE
    if (row.bucket === 'DUPLICATE' && prev.bucket !== 'DUPLICATE') {
      events.push({
        type: 'DUPLICATE_NEW',
        orderId: row.orderId,
        orderCode: row.orderCode,
        raceId: row.raceId,
        duplicateCount: row.duplicateCount ?? 2,
      });
    }
  }

  // ISSUED: orderId in prev missing but NOT in current missing
  for (const prev of previous.missing) {
    if (!curByOrderId.has(prev.orderId)) {
      events.push({
        type: 'ISSUED',
        orderId: prev.orderId,
        orderCode: prev.orderCode,
        misaInvNo: prev.misaInvNo ?? null,
      });
    }
  }

  return events;
}
