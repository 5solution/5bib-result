/**
 * FEATURE-066 — Strip prefix pháp nhân VN khỏi `entityName`.
 *
 * BR-66-04: Strip 1 LẦN prefix đầu chuỗi (idempotent, không recursive).
 *
 * Prefix recognized (case-insensitive, normalize diacritics):
 *   - "CÔNG TY CỔ PHẦN" / "CONG TY CO PHAN" / "CTCP" / "CTY CP"
 *   - "CÔNG TY TNHH MỘT THÀNH VIÊN" / "CTY TNHH MTV" / "CTYTNHHMTV"
 *   - "CÔNG TY TNHH" / "CTY TNHH" / "CTYTNHH"
 *   - "CÔNG TY" / "CTY"
 *   - "DOANH NGHIỆP TƯ NHÂN" / "DNTN"
 *   - "HỢP TÁC XÃ" / "HTX"
 *
 * Algorithm:
 *   1. Normalize VN diacritics → ASCII upper
 *   2. Strip leading prefix (longest match first)
 *   3. Trim + collapse internal whitespace
 *   4. Return remaining string (still upper, may contain spaces)
 *
 * Caller (`ContractNumberService.generateNumber`) chịu trách nhiệm
 * sanitize/slice ≤16 chars. Helper này KHÔNG slice — keep concerns split.
 */

/** Map diacritics → ASCII (cover full VN alphabet). */
function stripVietnameseDiacritics(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

// Order MUST be longest-first to prevent shorter prefix matching before longer.
// Example: "CONG TY TNHH MOT THANH VIEN ABC" must match MTV variant before TNHH variant.
// Boundary: prefix must end at \s OR end-of-string ($). Vd "CONG TY TNHH" alone (no
// remaining name) → strip leaves empty → caller fallback "CLIENT" (BR-66-03 / TC-66-10).
const COMPANY_PREFIX_PATTERNS: RegExp[] = [
  /^CONG\s*TY\s*CO\s*PHAN(\s+|$)/,
  /^CTY\s*CP(\s+|$)/,
  /^CTCP(\s+|$)/,
  /^CONG\s*TY\s*TNHH\s*MOT\s*THANH\s*VIEN(\s+|$)/,
  /^CTY\s*TNHH\s*MTV(\s+|$)/,
  /^CTYTNHHMTV(\s+|$)/,
  /^CONG\s*TY\s*TNHH(\s+|$)/,
  /^CTY\s*TNHH(\s+|$)/,
  /^CTYTNHH(\s+|$)/,
  /^CONG\s*TY(\s+|$)/,
  /^CTY(\s+|$)/,
  /^DOANH\s*NGHIEP\s*TU\s*NHAN(\s+|$)/,
  /^DNTN(\s+|$)/,
  /^HOP\s*TAC\s*XA(\s+|$)/,
  /^HTX(\s+|$)/,
];

/**
 * Strip VN legal-entity prefix from a partner name.
 *
 * @param rawName Tên đối tác raw từ Mongo `partners.entityName`. Có thể chứa
 *   diacritics, mixed case, leading/trailing space.
 * @returns ASCII uppercase string với prefix stripped (still may contain
 *   spaces between words). Empty string nếu input rỗng. Caller phải sanitize
 *   thêm (remove non-alphanum + slice 16) trước khi nhúng vào số HĐ.
 */
export function stripCompanyPrefix(rawName: string | null | undefined): string {
  if (!rawName) return '';
  const ascii = stripVietnameseDiacritics(rawName).toUpperCase().trim();
  for (const pattern of COMPANY_PREFIX_PATTERNS) {
    if (pattern.test(ascii)) {
      return ascii.replace(pattern, '').replace(/\s+/g, ' ').trim();
    }
  }
  return ascii.replace(/\s+/g, ' ').trim();
}
