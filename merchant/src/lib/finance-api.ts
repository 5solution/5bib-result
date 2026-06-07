/**
 * F-028 Finance / Deal P&L Tracking — admin API wrapper.
 *
 * Pattern: clone `contracts-api.ts` hand-typed wrapper. Reason giống F-024
 * Phase 2: `pnpm generate:api` cần Mongo + Redis running để regen OpenAPI
 * spec — local admin dev không có sẵn. Wrapper sẽ swap qua generated SDK
 * sau khi Manager chạy regen sau merge.
 *
 * Backend endpoint mapping (xem
 * `backend/src/modules/finance/controllers/*.controller.ts`):
 *   POST   /finance/contracts/:contractId/cost-items
 *   GET    /finance/contracts/:contractId/cost-items
 *   PATCH  /finance/contracts/:contractId/cost-items/:id
 *   DELETE /finance/contracts/:contractId/cost-items/:id
 *   GET    /finance/contracts/:contractId/pnl
 *   POST   /finance/contracts/:contractId/export/excel
 *
 * Tất cả gated `LogtoAdminGuard` backend + `isAdmin` UI defense-in-depth.
 */

export type CostCategory =
  | "LABOR"
  | "MATERIAL"
  | "VENDOR"
  | "OUTSOURCE"
  | "OTHER";

export const COST_CATEGORIES: CostCategory[] = [
  "LABOR",
  "MATERIAL",
  "VENDOR",
  "OUTSOURCE",
  "OTHER",
];

export const COST_CATEGORY_LABELS: Record<CostCategory, string> = {
  LABOR: "Nhân công",
  MATERIAL: "Vật tư",
  VENDOR: "Nhà cung cấp",
  OUTSOURCE: "Thuê ngoài",
  OTHER: "Khác",
};

export const COST_CATEGORY_COLORS: Record<CostCategory, string> = {
  LABOR: "bg-blue-100 text-blue-800 border-blue-200",
  MATERIAL: "bg-amber-100 text-amber-800 border-amber-200",
  VENDOR: "bg-violet-100 text-violet-800 border-violet-200",
  OUTSOURCE: "bg-teal-100 text-teal-800 border-teal-200",
  OTHER: "bg-stone-100 text-stone-800 border-stone-200",
};

export interface CostItemInput {
  description: string;
  category: CostCategory;
  amount: number;
  note?: string;
  incurredDate?: string;
}

export interface CostItemView {
  id: string;
  contractId: string;
  description: string;
  category: CostCategory;
  amount: number;
  note?: string;
  incurredDate?: string;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedCostItems {
  items: CostItemView[];
  total: number;
  page: number;
  limit: number;
}

export type RevenueSource = "ESTIMATED" | "ACTUAL";

export type MarginTier = "loss" | "thin" | "healthy" | "neutral";

/**
 * FEATURE-040 — fee source attribution enum.
 *   - RECONCILIATION: full period covered by BBNT signed/equivalent recon docs
 *   - SELF_COMPUTE: no recon coverage → MySQL platform self-compute
 *   - MIXED: recon partial + self-compute fill gap
 *   - ESTIMATED: fallback (no tenant/race link OR cross-DB unreachable)
 */
export type FeeSource =
  | "RECONCILIATION"
  | "SELF_COMPUTE"
  | "MIXED"
  | "ESTIMATED";

export const FEE_SOURCES: readonly FeeSource[] = [
  "RECONCILIATION",
  "SELF_COMPUTE",
  "MIXED",
  "ESTIMATED",
] as const;

export interface ReconciledFeeSliceClient {
  reconciliationId: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  feeAmount: number;
  manualFeeAmount: number;
  legacyWarning?: string;
  finalizedAt: string | null;
}

export interface SelfComputeSliceClient {
  count5BIB: number;
  gross5BIB: number;
  feeRatePercent: number;
  fee5BIB: number;
  countManual: number;
  manualTicketCount: number;
  manualFeePerTicket: number;
  feeManual: number;
  periodGapStart?: string;
  periodGapEnd?: string;
  rateFallbackWarning?: string;
}

export interface FeeBreakdownResponse {
  contractId: string;
  feeSource: FeeSource;
  totalFee: number;
  grossGMV?: number;
  reconciliations: ReconciledFeeSliceClient[];
  selfCompute?: SelfComputeSliceClient;
  computedAt: string;
  warnings?: string[];
}

export interface FeeSourceMixClient {
  reconciliation: number;
  selfCompute: number;
  mixed: number;
  estimated: number;
}

export interface PnLSummary {
  contractId: string;
  revenue: number;
  revenueSource: RevenueSource;
  /** FEATURE-040 — fee source attribution (TICKET_SALES only). */
  feeSource?: FeeSource;
  /** FEATURE-040 — gross GMV reference (TICKET_SALES only, transparency). */
  grossGMV?: number;
  /** FEATURE-040 — fee compute warning (TD legacy / cross-DB degrade). */
  feeWarning?: string;
  /** FEATURE-040 — full breakdown (TICKET_SALES only). */
  feeBreakdown?: FeeBreakdownResponse;
  /** FEATURE-036 — totalCost = estimatedCost + actualCost (additive). */
  totalCost: number;
  /** FEATURE-036 — chi phí ước tính từ line_items[i].cost × quantity. */
  estimatedCost?: number;
  /** FEATURE-036 — chi phí phát sinh thêm từ cost_items.amount. */
  actualCost?: number;
  /**
   * FEATURE-036 — Source attribution descriptive (UI badge):
   *   - 'none'      → cả 2 = 0
   *   - 'estimated' → chỉ line_items có cost
   *   - 'actual'    → chỉ cost_items có data
   *   - 'mixed'     → cả 2 có data
   */
  totalCostSource?: "actual" | "estimated" | "mixed" | "none";
  profit: number;
  margin: number | null;
  marginTier: MarginTier;
  costItemCount: number;
  costByCategory: Record<string, number>;
  warning?: string;
}

export interface ExcelExportResponse {
  s3Key: string;
  signedUrl: string;
  filename: string;
  bytes: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Error helper
// ────────────────────────────────────────────────────────────────────────────

export class FinanceApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "FinanceApiError";
  }
}

function extractMessage(body: unknown, status: number): string {
  if (typeof body === "object" && body !== null) {
    const obj = body as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (
      Array.isArray(obj.message) &&
      obj.message.length > 0 &&
      typeof obj.message[0] === "string"
    ) {
      return obj.message[0];
    }
  }
  return `HTTP ${status}`;
}

async function jsonFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new FinanceApiError(res.status, extractMessage(body, res.status));
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

function toQs(params: object): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

// ────────────────────────────────────────────────────────────────────────────
// Cost Items
// ────────────────────────────────────────────────────────────────────────────

export function listCostItems(
  contractId: string,
  filter: { page?: number; limit?: number } = {},
): Promise<PaginatedCostItems> {
  return jsonFetch<PaginatedCostItems>(
    `/api/finance/contracts/${encodeURIComponent(contractId)}/cost-items${toQs(filter)}`,
  );
}

export function createCostItem(
  contractId: string,
  input: CostItemInput,
): Promise<CostItemView> {
  return jsonFetch<CostItemView>(
    `/api/finance/contracts/${encodeURIComponent(contractId)}/cost-items`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function updateCostItem(
  contractId: string,
  id: string,
  input: Partial<CostItemInput>,
): Promise<CostItemView> {
  return jsonFetch<CostItemView>(
    `/api/finance/contracts/${encodeURIComponent(contractId)}/cost-items/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export function deleteCostItem(
  contractId: string,
  id: string,
): Promise<{ success: true }> {
  return jsonFetch<{ success: true }>(
    `/api/finance/contracts/${encodeURIComponent(contractId)}/cost-items/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

// ────────────────────────────────────────────────────────────────────────────
// P&L summary
// ────────────────────────────────────────────────────────────────────────────

export function getPnLSummary(contractId: string): Promise<PnLSummary> {
  return jsonFetch<PnLSummary>(
    `/api/finance/contracts/${encodeURIComponent(contractId)}/pnl`,
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Excel export
// ────────────────────────────────────────────────────────────────────────────

export function exportPnLExcel(
  contractId: string,
): Promise<ExcelExportResponse> {
  return jsonFetch<ExcelExportResponse>(
    `/api/finance/contracts/${encodeURIComponent(contractId)}/export/excel`,
    { method: "POST" },
  );
}

// ────────────────────────────────────────────────────────────────────────────
// F-028 — MySQL Tenant + Race picker (link TICKET_SALES → platform)
// ────────────────────────────────────────────────────────────────────────────

export interface TenantSearchResult {
  id: number;
  name: string;
  taxId: string | null;
}

export interface RaceSearchResult {
  raceId: number;
  title: string;
  createdOn: string | null;
}

export function searchMysqlTenants(q: string): Promise<TenantSearchResult[]> {
  return jsonFetch<TenantSearchResult[]>(
    `/api/finance/mysql/tenants/search${toQs({ q })}`,
  );
}

export function searchMysqlRaces(
  tenantId: number,
  q?: string,
): Promise<RaceSearchResult[]> {
  return jsonFetch<RaceSearchResult[]>(
    `/api/finance/mysql/races${toQs({ tenantId, q })}`,
  );
}

// ────────────────────────────────────────────────────────────────────────────
// F-028 Phase 2 — Aggregated Dashboard
// ────────────────────────────────────────────────────────────────────────────

export type DashboardPeriod =
  | "current_month"
  | "last_3_months"
  | "last_6_months"
  | "last_12_months"
  | "ytd"
  | "custom";

export type DashboardGroupBy = "type" | "partner" | "month";

export interface DashboardFilter {
  period?: DashboardPeriod;
  groupBy?: DashboardGroupBy;
  dateFrom?: string;
  dateTo?: string;
}

export interface DashboardContractItem {
  contractId: string;
  contractNumber: string | null;
  partnerName: string | null;
  raceName: string | null;
  contractType: "TICKET_SALES" | "TIMING" | "RACEKIT" | "OPERATIONS";
  status: string;
  /** FEATURE-040 — TICKET_SALES semantic = fee 5BIB thật (NOT gross GMV). */
  revenue: number;
  revenueSource: RevenueSource;
  /** FEATURE-040 — fee source enum (TICKET_SALES only). */
  feeSource?: FeeSource;
  /** FEATURE-040 — gross GMV reference (TICKET_SALES only). */
  grossGMV?: number;
  /** FEATURE-040 — fee compute warning string. */
  feeWarning?: string;
  totalCost: number;
  profit: number;
  margin: number | null;
  marginTier: MarginTier;
  anchorMonth: string | null;
}

export interface DashboardGroupBucket {
  key: string;
  label: string;
  contractCount: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  avgMargin: number | null;
}

export interface DashboardTotals {
  contractCount: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  avgMargin: number | null;
  costByCategory: Record<string, number>;
  /** FEATURE-040 — distribution of contracts by feeSource. */
  feeSourceMix?: FeeSourceMixClient;
}

export interface PnLDashboardResponse {
  period: string;
  dateFrom: string;
  dateTo: string;
  generatedAt: string;
  totals: DashboardTotals;
  byType: DashboardGroupBucket[];
  byPartner: DashboardGroupBucket[];
  byMonth: DashboardGroupBucket[];
  topProfit: DashboardContractItem[];
  lossMaking: DashboardContractItem[];
}

export function getDashboardData(
  filter: DashboardFilter = {},
): Promise<PnLDashboardResponse> {
  return jsonFetch<PnLDashboardResponse>(`/api/finance/dashboard${toQs(filter)}`);
}

export function exportDashboardExcel(
  filter: DashboardFilter = {},
): Promise<ExcelExportResponse> {
  return jsonFetch<ExcelExportResponse>(`/api/finance/dashboard/export/excel`, {
    method: "POST",
    body: JSON.stringify(filter),
  });
}

// ────────────────────────────────────────────────────────────────────────────
// FEATURE-038 — Paginated Contracts List with P&L per row
// ────────────────────────────────────────────────────────────────────────────

export type ContractsListSortBy =
  | "anchorMonth"
  | "profit"
  | "revenue"
  | "margin"
  | "contractNumber";

export type SortDir = "asc" | "desc";

export const CONTRACTS_LIST_PAGE_SIZES = [20, 50, 100] as const;
export type ContractsListPageSize = (typeof CONTRACTS_LIST_PAGE_SIZES)[number];

export interface PnLContractsListFilter extends DashboardFilter {
  page?: number;
  limit?: ContractsListPageSize;
  sortBy?: ContractsListSortBy;
  sortDir?: SortDir;
  q?: string;
  /** FEATURE-040 — filter by fee source enum. */
  feeSource?: FeeSource;
}

export interface PnLContractsListResponse {
  period: string;
  dateFrom: string;
  dateTo: string;
  generatedAt: string;
  items: DashboardContractItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  totals: DashboardTotals;
}

export function getContractsList(
  filter: PnLContractsListFilter = {},
): Promise<PnLContractsListResponse> {
  return jsonFetch<PnLContractsListResponse>(
    `/api/finance/pnl/contracts${toQs(filter)}`,
  );
}

// ────────────────────────────────────────────────────────────────────────────
// FEATURE-040 — Fee Breakdown drill-down
// ────────────────────────────────────────────────────────────────────────────

export function getFeeBreakdown(
  contractId: string,
): Promise<FeeBreakdownResponse> {
  return jsonFetch<FeeBreakdownResponse>(
    `/api/finance/contracts/${encodeURIComponent(contractId)}/fee-breakdown`,
  );
}

// ────────────────────────────────────────────────────────────────────────────
// F-028 Phase 3 — Cost suggestions từ Service Catalog (HĐ line items)
// ────────────────────────────────────────────────────────────────────────────

export interface CostSuggestion {
  catalogItemId: string;
  description: string;
  category: CostCategory;
  quantity: number;
  unit?: string;
  costPerUnit: number;
  suggestedAmount: number;
  contractLineItemStt: number;
}

export function getCostSuggestions(
  contractId: string,
): Promise<CostSuggestion[]> {
  return jsonFetch<CostSuggestion[]>(
    `/api/finance/contracts/${encodeURIComponent(contractId)}/cost-suggestions`,
  );
}

export function bulkCreateCostItems(
  contractId: string,
  items: CostItemInput[],
): Promise<CostItemView[]> {
  return jsonFetch<CostItemView[]>(
    `/api/finance/contracts/${encodeURIComponent(contractId)}/cost-items/bulk`,
    {
      method: "POST",
      body: JSON.stringify({ items }),
    },
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Formatting helpers
// ────────────────────────────────────────────────────────────────────────────

export function formatVnd(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " ₫";
}

export function formatMargin(m: number | null | undefined): string {
  if (m === null || m === undefined) return "—";
  return `${m.toFixed(1)}%`;
}
