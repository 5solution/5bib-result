/**
 * F-076 — Invoice Reconcile admin API wrapper.
 *
 * Pattern clone `finance-api.ts` hand-typed wrapper. `pnpm generate:api`
 * regen pending sau backend ship.
 *
 * Backend endpoints:
 *   GET  /admin/invoice-reconcile/today?date=yyyy-MM-dd → ReconcileReportDto
 *   POST /admin/invoice-reconcile/trigger              → ReconcileReportDto
 *   GET  /admin/invoice-reconcile/health               → ReconcileHealthDto
 */

export type ReconcileBucket = 'OK' | 'SYNC_LAG' | 'UNISSUED' | 'DUPLICATE';
export type AlertSeverity = 'INFO' | 'WARN' | 'CRITICAL';
export type Layer2Status = 'OK' | 'DEGRADED' | 'UNAVAILABLE';

export interface MissingInvoiceRow {
  orderId: number;
  orderCode: string;
  raceId: number;
  email?: string | null;
  buyerName?: string | null;
  totalPrice: number;
  paymentOn: string;
  orderCategory: string;
  ageHours: number;
  bucket: ReconcileBucket;
  severity: AlertSeverity;
  breached: boolean;
  misaInvNo?: string | null;
  duplicateCount?: number;
  /** F-088 — admin đã đánh dấu "đã xử lý". */
  resolved?: boolean;
}

/** F-088 — error breakdown snapshot. */
export interface ErrorBreakdown {
  unissued: number;
  duplicate: number;
  orphan: number;
  misaFail: number;
  total: number;
}

export interface MisaOrphanRow {
  refId: string;
  invNo: string;
  invSeries?: string | null;
  invDate: string;
  totalAmount: number;
  buyerFullName?: string | null;
  itemName?: string | null;
  itemCode?: string | null;
}

export interface ReconcileReport {
  date: string;
  runAt: string;
  mode: 'cron' | 'manual' | 'hourly-recap' | 'eod-recap';
  raceIdsScanned: number[];
  expectedCount: number;
  issuedCount: number;
  missingCount: number;
  atRiskCount: number;
  duplicateCount: number;
  breachedCount: number;
  missing: MissingInvoiceRow[];
  misaOrphan: MisaOrphanRow[];
  layer2Status: Layer2Status;
  maxSeverity: AlertSeverity;
  alertSent: boolean;
  /** F-088 dashboard enrichment (set khi /today). */
  cumulativeIssued?: number;
  errorBreakdown?: ErrorBreakdown;
  dailyCounters?: Record<string, number>;
}

export interface ReconcileHealth {
  lastScanTickAt: string | null;
  enabledRaceIds: number[];
  misaTokenExpiresAt: string | null;
  lastMisaStatus: Layer2Status | null;
  misaConfigured: boolean;
  telegramConfigured: boolean;
  telegramChatIdMasked?: string | null;
  emailRecipientsMasked: string[];
  thresholds: {
    warnHours: number;
    criticalHours: number;
    breachedHours: number;
  };
}

export class InvoiceReconcileApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'InvoiceReconcileApiError';
  }
}

async function jsonFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg =
      typeof body === 'object' && body !== null && 'message' in body
        ? String((body as Record<string, unknown>).message)
        : `HTTP ${res.status}`;
    throw new InvoiceReconcileApiError(res.status, msg);
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

export function getReconcileReport(date?: string): Promise<ReconcileReport> {
  const qs = date ? `?date=${encodeURIComponent(date)}` : '';
  return jsonFetch<ReconcileReport>(`/api/admin/invoice-reconcile/today${qs}`);
}

export function triggerReconcile(): Promise<ReconcileReport> {
  return jsonFetch<ReconcileReport>('/api/admin/invoice-reconcile/trigger', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function getReconcileHealth(): Promise<ReconcileHealth> {
  return jsonFetch<ReconcileHealth>('/api/admin/invoice-reconcile/health');
}

/** F-088 — gửi heartbeat Telegram ngay (admin bấm nút). */
export function sendHeartbeat(): Promise<{ sent: boolean }> {
  return jsonFetch<{ sent: boolean }>(
    '/api/admin/invoice-reconcile/send-heartbeat',
    { method: 'POST', body: JSON.stringify({}) },
  );
}

/** F-088 — đánh dấu / bỏ đánh dấu 1 đơn "đã xử lý". */
export function setOrderResolved(
  orderId: number,
  resolved: boolean,
): Promise<{ orderId: number; resolved: boolean }> {
  return jsonFetch<{ orderId: number; resolved: boolean }>(
    '/api/admin/invoice-reconcile/resolve',
    { method: 'POST', body: JSON.stringify({ orderId, resolved }) },
  );
}

/** Format VND for UI display. */
export function formatVnd(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '0 đ';
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' đ';
}

/** Format VN relative time ("3 giờ trước"). */
export function formatRelativeVi(iso: string): string {
  try {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const diffH = Math.floor(diffMs / 3_600_000);
    if (diffH < 1) {
      const diffMin = Math.floor(diffMs / 60_000);
      if (diffMin < 1) return 'vừa xong';
      return `${diffMin} phút trước`;
    }
    if (diffH < 24) return `${diffH} giờ trước`;
    const diffD = Math.floor(diffH / 24);
    return `${diffD} ngày trước`;
  } catch {
    return iso;
  }
}
