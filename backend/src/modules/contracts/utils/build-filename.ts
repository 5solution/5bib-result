/**
 * F-024 — Build human-readable output filename cho download document.
 *
 * Pattern: `[Provider] [Partner] - [DocType] [Service] - [DD.MM.YYYY].ext`
 *
 * Ví dụ:
 *   [5BIB] CÔNG TY TNHH XYZ - Hợp đồng dịch vụ tính giờ - 15.05.2026.docx
 *   [5S] Thành An Media - Hợp đồng vận hành racekit - 15.05.2026.docx
 *   [5BIB] XYZ - Báo giá dịch vụ tính giờ.xlsx   (no signDate → bỏ phần ngày)
 *
 * Pure function — KHÔNG đọc DB, KHÔNG side effect.
 *
 * Lý do tách module:
 *   - Test riêng (8+ cases) không cần mock DocumentGeneratorService
 *   - Re-use cho downloadDocument (contracts.service.ts) + có thể frontend
 *     replicate logic nếu cần (admin SDK).
 */

export type GeneratedDocType =
  | 'QUOTATION'
  | 'CONTRACT'
  | 'ACCEPTANCE_REPORT'
  | 'PAYMENT_REQUEST';

export type ContractType =
  | 'TICKET_SALES'
  | 'TIMING'
  | 'RACEKIT'
  | 'OPERATIONS';

export type ProviderId = '5BIB' | '5SOLUTION' | string;

export type DocFormat = 'docx' | 'pdf' | 'xlsx';

export interface BuildFilenameInput {
  providerId: ProviderId;
  partnerName: string; // contract.client.entityName
  docType: GeneratedDocType;
  contractType: ContractType;
  /** signDate ưu tiên; null → fallback createdAt; null → bỏ phần ngày (Quotation). */
  signDate?: Date | string | null;
  fallbackDate?: Date | string | null;
  format: DocFormat;
}

/** Map providerId → abbrev hiển thị trong filename. */
const PROVIDER_ABBREV: Record<string, string> = {
  '5BIB': '5BIB',
  '5SOLUTION': '5S',
};

/** Map docType → label tiếng Việt. */
const DOC_TYPE_LABEL: Record<GeneratedDocType, string> = {
  CONTRACT: 'Hợp đồng',
  QUOTATION: 'Báo giá',
  ACCEPTANCE_REPORT: 'Biên bản nghiệm thu',
  PAYMENT_REQUEST: 'Đề nghị thanh toán',
};

/** Map contractType → tên dịch vụ tiếng Việt. */
const SERVICE_NAME: Record<ContractType, string> = {
  TIMING: 'dịch vụ tính giờ',
  RACEKIT: 'vận hành racekit',
  OPERATIONS: 'vận hành',
  TICKET_SALES: 'bán vé',
};

/** Hard limit chiều dài tên đối tác trong filename (UX + filesystem safety). */
const MAX_PARTNER_NAME_LENGTH = 100;

/**
 * Sanitize tên đối tác:
 *   - Replace `/` `\` → `-` (filesystem reserved)
 *   - Strip control chars + double quotes (Content-Disposition tránh confuse)
 *   - Collapse whitespace
 *   - Truncate quá MAX_PARTNER_NAME_LENGTH → cắt + ellipsis
 *
 * KHÔNG slugify — giữ dấu tiếng Việt + space (RFC 5987 filename* encoding
 * trong controller đã handle Unicode an toàn).
 */
function sanitizePartnerName(name: string): string {
  if (!name || typeof name !== 'string') return 'doi-tac';
  let s = name
    .replace(/[\\/]/g, '-')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f"<>:|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return 'doi-tac';
  if (s.length > MAX_PARTNER_NAME_LENGTH) {
    s = `${s.slice(0, MAX_PARTNER_NAME_LENGTH).trim()}...`;
  }
  return s;
}

/** Format date → "DD.MM.YYYY" (dot separator) cho filename. */
function formatDateDot(input: Date | string | null | undefined): string | null {
  if (input == null) return null;
  const d = input instanceof Date ? input : new Date(input);
  if (!d || Number.isNaN(d.getTime())) return null;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

/**
 * Build filename theo pattern F-024.
 *
 * Edge cases:
 *   - QUOTATION + signDate null + fallbackDate null → bỏ phần ngày
 *   - signDate hoặc fallbackDate valid → có phần ngày
 *   - Tên đối tác có `/` → replace `-`
 *   - Tên đối tác > 100 chars → truncate + ellipsis
 */
export function buildDocumentFilename(input: BuildFilenameInput): string {
  const provider = PROVIDER_ABBREV[input.providerId] ?? input.providerId;
  const partner = sanitizePartnerName(input.partnerName);
  const docLabel = DOC_TYPE_LABEL[input.docType];
  const serviceLabel = SERVICE_NAME[input.contractType];

  // ACCEPTANCE_REPORT + PAYMENT_REQUEST không có biến thể dịch vụ trong UI label,
  // nhưng vẫn hữu ích để phân biệt cùng partner có nhiều HĐ — luôn append.
  // QUOTATION + CONTRACT pattern: "{Label} {service}" (vd "Hợp đồng dịch vụ tính giờ").
  // ACCEPTANCE_REPORT + PAYMENT_REQUEST pattern: "{Label}" + " " + "{service}" nếu
  // service hữu ích context (Danny mẫu: "Biên bản nghiệm thu tính giờ" → drop "dịch vụ" prefix).
  let middle: string;
  if (input.docType === 'ACCEPTANCE_REPORT') {
    // "Biên bản nghiệm thu tính giờ" / "... racekit" / "... vận hành" / "... bán vé"
    middle = `${docLabel} ${stripServicePrefix(serviceLabel, input.contractType)}`;
  } else if (input.docType === 'PAYMENT_REQUEST') {
    // Danny mẫu: "Đề nghị thanh toán" — không append service (đặc trưng đủ).
    middle = docLabel;
  } else {
    // CONTRACT + QUOTATION → "Hợp đồng dịch vụ tính giờ" | "Báo giá dịch vụ tính giờ"
    middle = `${docLabel} ${serviceLabel}`;
  }

  // Date — ưu tiên signDate, fallback fallbackDate (createdAt); cả 2 null → bỏ.
  const dateStr =
    formatDateDot(input.signDate) ?? formatDateDot(input.fallbackDate);

  const base = dateStr
    ? `[${provider}] ${partner} - ${middle} - ${dateStr}`
    : `[${provider}] ${partner} - ${middle}`;

  return `${base}.${input.format}`;
}

/**
 * Helper — convert "dịch vụ tính giờ" → "tính giờ" cho ACCEPTANCE_REPORT.
 * Danny mẫu rõ ràng "Biên bản nghiệm thu tính giờ" (KHÔNG có "dịch vụ").
 * Các contractType khác giữ nguyên service label.
 */
function stripServicePrefix(
  serviceLabel: string,
  contractType: ContractType,
): string {
  if (contractType === 'TIMING') return 'tính giờ';
  return serviceLabel;
}
