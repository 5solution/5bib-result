/**
 * F-024 Contract Management — admin API wrapper.
 *
 * Mirrors `course-map-api.ts` + `timing-alert-api.ts` pattern: hand-typed
 * wrappers over the runtime `/api/[...proxy]` route. Used because the
 * generated SDK (`@hey-api/openapi-ts`) cannot be regenerated locally without
 * Mongo + Redis running — see PAUSE-CODE-PHASE2-D in 03-coder-implementation.md.
 *
 * When admin Mongo + Redis is available again, `pnpm generate:api` will produce
 * `contractsController*` / `partnersController*` / `serviceCatalogController*`
 * SDK functions — at that point Phase 3 (post-QC) can swap these wrappers for
 * the generated names. Endpoint paths + payload shapes here match the backend
 * controllers byte-for-byte (verified against
 * backend/src/modules/contracts/contracts.controller.ts).
 */

// ────────────────────────────────────────────────────────────────────────────
// Types — mirror backend DTOs (single source of truth: contracts schema)
// ────────────────────────────────────────────────────────────────────────────

export type ContractType =
  | "TICKET_SALES"
  | "TIMING"
  | "RACEKIT"
  | "OPERATIONS";

export type DocumentType = "QUOTATION" | "CONTRACT";

export type ContractStatus =
  | "DRAFT"
  | "SENT"
  | "ACCEPTED"
  | "CONVERTED_TO_CONTRACT"
  | "REJECTED"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED";

export type ProviderId = "5BIB" | "5SOLUTION";

export type LatePenaltyUnit = "PER_DAY" | "PER_YEAR";

export interface ProviderInfo {
  entityName: string;
  taxId: string;
  address: string;
  representative: string;
  position: string;
  bankAccount: string;
  bankName: string;
}

export interface ClientInfo {
  entityName: string;
  taxId?: string;
  address?: string;
  representative?: string;
  position?: string;
  bankAccount?: string;
  bankName?: string;
  phone?: string;
  email?: string;
}

export interface LineItemInput {
  stt: number;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  selected?: boolean;
  note?: string;
  /**
   * F-028 Phase 3 — `ServiceCatalog._id` snapshot khi line item được pick
   * từ Service Catalog. Optional — line item nhập tay sẽ undefined.
   * Backend lưu để cost-suggestions endpoint match HĐ ↔ catalog.
   */
  catalogItemId?: string;
}

export interface LineItemView extends LineItemInput {
  amount: number;
}

export interface RevenueShare {
  feePercentage: number;
  feePerAthlete: number;
  estimatedAthletes: number;
}

export interface PaymentTerms {
  advancePercentage: number;
  advanceAmount: number;
  remainderPercentage: number;
  remainderAmount: number;
  latePenaltyRate: number;
  latePenaltyUnit: LatePenaltyUnit;
  paymentDeadlineDays: number;
}

export interface AcceptanceActualItem {
  stt: number;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface AcceptanceReportView {
  reportDate?: string;
  actualValues: AcceptanceActualItem[];
  actualSubtotal: number;
  actualVatAmount: number;
  actualTotalWithVat: number;
  contractSubtotal: number;
  diffAmount: number;
  advancePaid: number;
  remainingBalance: number;
  verdict?: "ACCEPTED" | "ACCEPTED_WITH_NOTES" | "REJECTED";
  notes?: string;
  status?: "DRAFT" | "FINALIZED";
  finalizedAt?: string | null;
}

export interface PaymentRequestView {
  requestDate?: string;
  totalAmount: number;
  advancePaid: number;
  amountDue: number;
  paymentDeadline?: string;
  status?: "DRAFT" | "SENT" | "PAID";
  paidAt?: string | null;
  notes?: string;
}

export interface GeneratedDocumentEntry {
  docType: "QUOTATION" | "CONTRACT" | "ACCEPTANCE_REPORT" | "PAYMENT_REQUEST";
  generatedAt: string;
  s3Key: string;
  format: "DOCX" | "PDF";
  version: number;
}

export interface ContractView {
  _id: string;
  contractNumber?: string;
  contractType: ContractType;
  documentType: DocumentType;
  status: ContractStatus;
  providerId: ProviderId;
  provider: ProviderInfo;
  partnerId?: string | null;
  client: ClientInfo;
  raceId?: string | null;
  raceName?: string;
  raceDate?: string | null;
  raceLocation?: string;
  signDate?: string;
  effectiveDate?: string;
  endDate?: string;
  lineItems: LineItemView[];
  revenueShare?: RevenueShare | null;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  paymentTerms: PaymentTerms;
  templateOverrides?: { articles?: Record<string, string> };
  sourceQuotationId?: string | null;
  generatedDocuments: GeneratedDocumentEntry[];
  acceptanceReport?: AcceptanceReportView | null;
  paymentRequest?: PaymentRequestView | null;
  /** F-028 — MySQL platform linkage (TICKET_SALES only). */
  linkedTenantId?: number | null;
  linkedMysqlRaceId?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedContracts {
  items: ContractView[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface CreateContractInput {
  contractType: ContractType;
  documentType: DocumentType;
  providerId?: ProviderId;
  partnerId?: string;
  client: ClientInfo;
  raceId?: string;
  raceName?: string;
  raceDate?: string;
  raceLocation?: string;
  signDate?: string;
  effectiveDate?: string;
  endDate?: string;
  lineItems?: LineItemInput[];
  revenueShare?: RevenueShare;
  vatRate?: number;
  paymentTerms?: Partial<PaymentTerms>;
  templateOverrides?: { articles?: Record<string, string> };
  sourceQuotationId?: string;
}

/**
 * F-024 Update payload — allow status update CHỈ cho CANCELLED
 * (backend enforce: dto.status === 'CANCELLED' && Object.keys(dto).length === 1).
 * Type này khớp với backend UpdateContractDto field literal 'CANCELLED'.
 */
export type UpdateContractInput = Partial<CreateContractInput> & {
  status?: "CANCELLED";
  /**
   * F-028 — link/unlink MySQL platform (TICKET_SALES only).
   * Truyền `null` explicit để UNLINK (omit key → keep current).
   */
  linkedTenantId?: number | null;
  linkedMysqlRaceId?: number | null;
};

export interface ContractFilterInput {
  contractType?: ContractType;
  status?: ContractStatus;
  partnerId?: string;
  raceId?: string;
  q?: string;
  signDateFrom?: string;
  signDateTo?: string;
  page?: number;
  limit?: number;
  includeDeleted?: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// Partners
// ────────────────────────────────────────────────────────────────────────────

export interface PartnerView {
  _id: string;
  entityName: string;
  shortName?: string;
  taxId?: string;
  address?: string;
  representative?: string;
  position?: string;
  bankAccount?: string;
  bankName?: string;
  phone?: string;
  email?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerListResponse {
  items: PartnerView[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface CreatePartnerInput {
  entityName: string;
  shortName?: string;
  taxId?: string;
  address?: string;
  representative?: string;
  position?: string;
  bankAccount?: string;
  bankName?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export type UpdatePartnerInput = Partial<CreatePartnerInput>;

// ────────────────────────────────────────────────────────────────────────────
// Service Catalog
// ────────────────────────────────────────────────────────────────────────────

export type ServiceCategory =
  | "TIMING"
  | "RACEKIT"
  | "OPERATIONS"
  | "GENERAL";

export interface ServiceCatalogItem {
  _id: string;
  name: string;
  category: ServiceCategory;
  unit?: string;
  referencePrice?: number;
  /** F-024 — Giá vốn tham khảo (VND). Dùng pre-compute P&L cost item ở F-028. */
  referenceCost?: number;
  description?: string;
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceCatalogInput {
  name: string;
  category: ServiceCategory;
  unit?: string;
  referencePrice?: number;
  /** F-024 — Giá vốn tham khảo (VND). Optional + default 0. */
  referenceCost?: number;
  description?: string;
  sortOrder?: number;
}

export type UpdateServiceCatalogInput = Partial<CreateServiceCatalogInput>;

// ────────────────────────────────────────────────────────────────────────────
// Contract Templates
// ────────────────────────────────────────────────────────────────────────────

export interface ContractTemplateView {
  contractType: ContractType;
  articles: Record<string, string>;
  variables?: { key: string; label: string; source: string }[];
  lastEditedBy?: string;
  updatedAt?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Generate / Download
// ────────────────────────────────────────────────────────────────────────────

export interface GenerateDocumentResult {
  docxKey: string;
  docxUrl: string;
  pdfKey?: string;
  pdfUrl?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Error class
// ────────────────────────────────────────────────────────────────────────────

export class ContractsApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ContractsApiError";
  }
}

function extractMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === "object") {
    const obj = payload as { message?: unknown };
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

async function jsonFetch<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ContractsApiError(res.status, extractMessage(body, res.status));
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
// Contracts
// ────────────────────────────────────────────────────────────────────────────

export function listContracts(
  filter: ContractFilterInput = {},
): Promise<PaginatedContracts> {
  return jsonFetch<PaginatedContracts>(`/api/contracts${toQs(filter)}`);
}

export function getContract(id: string): Promise<ContractView> {
  return jsonFetch<ContractView>(`/api/contracts/${encodeURIComponent(id)}`);
}

export function createContract(
  input: CreateContractInput,
): Promise<ContractView> {
  return jsonFetch<ContractView>(`/api/contracts`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateContract(
  id: string,
  input: UpdateContractInput,
): Promise<ContractView> {
  return jsonFetch<ContractView>(`/api/contracts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteContract(id: string): Promise<{ success: true }> {
  return jsonFetch<{ success: true }>(`/api/contracts/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function activateContract(id: string): Promise<ContractView> {
  return jsonFetch<ContractView>(
    `/api/contracts/${encodeURIComponent(id)}/activate`,
    { method: "POST" },
  );
}

export function convertQuotation(id: string): Promise<ContractView> {
  return jsonFetch<ContractView>(
    `/api/contracts/${encodeURIComponent(id)}/convert`,
    { method: "POST" },
  );
}

/** F-024 BUG-001 — đối tác chấp nhận báo giá (Quotation DRAFT → ACCEPTED) */
export function acceptQuotation(id: string): Promise<ContractView> {
  return jsonFetch<ContractView>(
    `/api/contracts/${encodeURIComponent(id)}/accept-quotation`,
    { method: "POST" },
  );
}

/** F-024 BUG-001 — đối tác từ chối báo giá (Quotation DRAFT → REJECTED) */
export function rejectQuotation(
  id: string,
  reason?: string,
): Promise<ContractView> {
  return jsonFetch<ContractView>(
    `/api/contracts/${encodeURIComponent(id)}/reject-quotation`,
    { method: "POST", body: JSON.stringify({ reason }) },
  );
}

export interface AcceptanceReportInput {
  reportDate?: string;
  actualValues: Omit<AcceptanceActualItem, "amount">[];
  advancePaid?: number;
  verdict?: "ACCEPTED" | "ACCEPTED_WITH_NOTES" | "REJECTED";
  notes?: string;
}

export function upsertAcceptanceReport(
  id: string,
  input: AcceptanceReportInput,
): Promise<ContractView> {
  return jsonFetch<ContractView>(
    `/api/contracts/${encodeURIComponent(id)}/acceptance-report`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function finalizeAcceptanceReport(id: string): Promise<ContractView> {
  return jsonFetch<ContractView>(
    `/api/contracts/${encodeURIComponent(id)}/acceptance-report/finalize`,
    { method: "POST" },
  );
}

export interface PaymentRequestInput {
  requestDate?: string;
  paymentDeadline?: string;
  notes?: string;
}

export function upsertPaymentRequest(
  id: string,
  input: PaymentRequestInput,
): Promise<ContractView> {
  return jsonFetch<ContractView>(
    `/api/contracts/${encodeURIComponent(id)}/payment-request`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function markPaymentPaid(id: string): Promise<ContractView> {
  return jsonFetch<ContractView>(
    `/api/contracts/${encodeURIComponent(id)}/payment-request/mark-paid`,
    { method: "PATCH" },
  );
}

export function generateDocument(
  id: string,
  docType: GeneratedDocumentEntry["docType"],
): Promise<GenerateDocumentResult> {
  return jsonFetch<GenerateDocumentResult>(
    `/api/contracts/${encodeURIComponent(id)}/generate/${encodeURIComponent(docType)}`,
    { method: "POST" },
  );
}

export function getDownloadUrl(
  id: string,
  s3Key: string,
): Promise<{ url: string }> {
  return jsonFetch<{ url: string }>(
    `/api/contracts/${encodeURIComponent(id)}/download${toQs({ s3Key })}`,
  );
}

/** Returns the binary blob — admin can save to user disk via anchor + URL.createObjectURL. */
export async function streamDownloadBlob(
  id: string,
  s3Key: string,
): Promise<Blob> {
  const res = await fetch(
    `/api/contracts/${encodeURIComponent(id)}/download/stream${toQs({ s3Key })}`,
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ContractsApiError(res.status, extractMessage(body, res.status));
  }
  return await res.blob();
}

// ────────────────────────────────────────────────────────────────────────────
// Partners
// ────────────────────────────────────────────────────────────────────────────

export interface PartnerFilterInput {
  q?: string;
  page?: number;
  limit?: number;
}

export function listPartners(
  filter: PartnerFilterInput = {},
): Promise<PartnerListResponse> {
  return jsonFetch<PartnerListResponse>(`/api/partners${toQs(filter)}`);
}

export function getPartner(id: string): Promise<PartnerView> {
  return jsonFetch<PartnerView>(`/api/partners/${encodeURIComponent(id)}`);
}

export function createPartner(input: CreatePartnerInput): Promise<PartnerView> {
  return jsonFetch<PartnerView>(`/api/partners`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updatePartner(
  id: string,
  input: UpdatePartnerInput,
): Promise<PartnerView> {
  return jsonFetch<PartnerView>(`/api/partners/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deletePartner(id: string): Promise<{ success: true }> {
  return jsonFetch<{ success: true }>(`/api/partners/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Service Catalog
// ────────────────────────────────────────────────────────────────────────────

export function listServiceCatalog(filter: {
  category?: ServiceCategory;
  q?: string;
} = {}): Promise<ServiceCatalogItem[]> {
  return jsonFetch<ServiceCatalogItem[]>(`/api/service-catalog${toQs(filter)}`);
}

export function createServiceCatalogItem(
  input: CreateServiceCatalogInput,
): Promise<ServiceCatalogItem> {
  return jsonFetch<ServiceCatalogItem>(`/api/service-catalog`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateServiceCatalogItem(
  id: string,
  input: UpdateServiceCatalogInput,
): Promise<ServiceCatalogItem> {
  return jsonFetch<ServiceCatalogItem>(
    `/api/service-catalog/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export function deleteServiceCatalogItem(id: string): Promise<{ success: true }> {
  return jsonFetch<{ success: true }>(
    `/api/service-catalog/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

// ────────────────────────────────────────────────────────────────────────────
// FEATURE-031 — Service Catalog Excel Import
// ────────────────────────────────────────────────────────────────────────────

export interface ParsedServiceCatalogRow {
  rowNum: number;
  name: string;
  category: ServiceCategory;
  unit?: string;
  referencePrice?: number;
  referenceCost?: number;
  description?: string;
  sortOrder?: number;
}

export interface InvalidServiceCatalogRow {
  rowNum: number;
  errors: string[];
  raw: Record<string, unknown>;
}

export interface ServiceCatalogImportPreview {
  total: number;
  valid: ParsedServiceCatalogRow[];
  duplicate: ParsedServiceCatalogRow[];
  invalid: InvalidServiceCatalogRow[];
}

export interface ServiceCatalogImportResult {
  inserted: number;
  skipped_duplicate: number;
  failed: number;
}

/**
 * Step 1: Upload Excel + parse + validate (preview, KHÔNG insert).
 * Multipart/form-data — KHÔNG dùng jsonFetch helper vì Content-Type khác.
 */
export async function previewServiceCatalogImport(
  file: File,
): Promise<ServiceCatalogImportPreview> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/service-catalog/import-excel/preview", {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ContractsApiError(res.status, extractMessage(body, res.status));
  }
  return (await res.json()) as ServiceCatalogImportPreview;
}

/** Step 2: Confirm import — bulk insert validated rows. */
export function confirmServiceCatalogImport(
  rows: ParsedServiceCatalogRow[],
): Promise<ServiceCatalogImportResult> {
  return jsonFetch<ServiceCatalogImportResult>(
    `/api/service-catalog/import-excel/confirm`,
    { method: "POST", body: JSON.stringify({ rows }) },
  );
}

/** Download Excel template — opens new tab / triggers browser download. */
export function getServiceCatalogTemplateUrl(): string {
  return "/api/service-catalog/import-template";
}

// ────────────────────────────────────────────────────────────────────────────
// Contract Templates
// ────────────────────────────────────────────────────────────────────────────

export function listContractTemplates(): Promise<ContractTemplateView[]> {
  return jsonFetch<ContractTemplateView[]>(`/api/contract-templates`);
}

export function getContractTemplate(
  type: ContractType,
): Promise<ContractTemplateView> {
  return jsonFetch<ContractTemplateView>(
    `/api/contract-templates/${encodeURIComponent(type)}`,
  );
}

export function updateContractTemplate(
  type: ContractType,
  articles: Record<string, string>,
): Promise<ContractTemplateView> {
  return jsonFetch<ContractTemplateView>(
    `/api/contract-templates/${encodeURIComponent(type)}`,
    { method: "PATCH", body: JSON.stringify({ articles }) },
  );
}

export interface DefaultArticleSection {
  key: string;
  heading: string;
  body: string;
}

export function getContractTemplateDefaults(
  type: ContractType,
): Promise<{ articles: DefaultArticleSection[] }> {
  return jsonFetch<{ articles: DefaultArticleSection[] }>(
    `/api/contract-templates/${encodeURIComponent(type)}/default-articles`,
  );
}

/**
 * F-024 UX-39 v2 — Reset DB override → return default content.
 * Backend `POST /api/contract-templates/:type/reset` deletes the override doc;
 * subsequent `getContractTemplate` will fall back to defaults.
 */
export function resetContractTemplate(
  type: ContractType,
): Promise<{ success: true }> {
  return jsonFetch<{ success: true }>(
    `/api/contract-templates/${encodeURIComponent(type)}/reset`,
    { method: "POST" },
  );
}

// ────────────────────────────────────────────────────────────────────────────
// F-024 UX-39 v3 Task 1 — Preview HTML (Audit Viewer)
// ────────────────────────────────────────────────────────────────────────────

export interface TemplatePreviewHtmlResponse {
  html: string;
  cached: boolean;
  templateFile: string;
}

export function getContractTemplatePreviewHtml(
  type: ContractType,
): Promise<TemplatePreviewHtmlResponse> {
  return jsonFetch<TemplatePreviewHtmlResponse>(
    `/api/contract-templates/${encodeURIComponent(type)}/preview-html`,
  );
}

// ────────────────────────────────────────────────────────────────────────────
// F-024 UX-39 v3 Task 2 — Upload DOCX + Versions
// ────────────────────────────────────────────────────────────────────────────

export interface TemplateUploadResponse {
  success: true;
  backup?: { filename: string; size: number };
  newFilename: string;
  newSize: number;
}

export async function uploadContractTemplateDocx(
  type: ContractType,
  file: File,
): Promise<TemplateUploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(
    `/api/contract-templates/${encodeURIComponent(type)}/upload`,
    { method: "POST", body: form, credentials: "include" },
  );
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try {
      const json = JSON.parse(text);
      msg = json?.message ?? json?.error ?? text;
    } catch {
      // not JSON
    }
    throw new Error(`Upload thất bại (${res.status}): ${msg}`);
  }
  return res.json() as Promise<TemplateUploadResponse>;
}

export interface TemplateVersion {
  filename: string;
  size: number;
  createdAt: string; // ISO
}

export function listContractTemplateVersions(
  type: ContractType,
): Promise<{ versions: TemplateVersion[] }> {
  return jsonFetch<{ versions: TemplateVersion[] }>(
    `/api/contract-templates/${encodeURIComponent(type)}/versions`,
  );
}

export function restoreContractTemplateVersion(
  type: ContractType,
  filename: string,
): Promise<{ success: true; restoredFrom: string }> {
  return jsonFetch<{ success: true; restoredFrom: string }>(
    `/api/contract-templates/${encodeURIComponent(
      type,
    )}/restore/${encodeURIComponent(filename)}`,
    { method: "POST" },
  );
}

// ────────────────────────────────────────────────────────────────────────────
// F-024 UX-39 v3 Task 3 — Default Line Items
// ────────────────────────────────────────────────────────────────────────────

export interface DefaultLineItem {
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  note?: string;
}

export function getContractTemplateLineItems(
  type: ContractType,
): Promise<{ defaultLineItems: DefaultLineItem[] }> {
  return jsonFetch<{ defaultLineItems: DefaultLineItem[] }>(
    `/api/contract-templates/${encodeURIComponent(type)}/line-items`,
  );
}

export function updateContractTemplateLineItems(
  type: ContractType,
  defaultLineItems: DefaultLineItem[],
): Promise<{ contractType: string; defaultLineItems: DefaultLineItem[] }> {
  return jsonFetch<{
    contractType: string;
    defaultLineItems: DefaultLineItem[];
  }>(`/api/contract-templates/${encodeURIComponent(type)}/line-items`, {
    method: "PATCH",
    body: JSON.stringify({ defaultLineItems }),
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers — pure VND format + line item calc (mirror backend BR-CM-04)
// ────────────────────────────────────────────────────────────────────────────

export function formatVND(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * F-024 UX-14 — VN date display helper.
 *
 * Convert ISO date / datetime → `DD/MM/YYYY`. Returns "—" cho null/empty/invalid.
 * KHÔNG dùng cho `<input type="date">` value (cần giữ ISO YYYY-MM-DD).
 */
export function formatVNDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function calcLineAmount(
  qty: number,
  unitPrice: number,
  discount: number = 0,
): number {
  return Math.round(qty * unitPrice * (1 - (discount || 0) / 100));
}

export function calcTotals(
  items: { quantity: number; unitPrice: number; discount?: number }[],
  vatRate: number,
): { subtotal: number; vatAmount: number; totalAmount: number } {
  const subtotal = items.reduce(
    (s, it) => s + calcLineAmount(it.quantity, it.unitPrice, it.discount ?? 0),
    0,
  );
  const vatAmount = Math.round((subtotal * vatRate) / 100);
  return { subtotal, vatAmount, totalAmount: subtotal + vatAmount };
}
