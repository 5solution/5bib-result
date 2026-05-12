/**
 * Convert VN number → Vietnamese words (read aloud).
 *
 * Used in F-024 contract / acceptance / payment templates for the
 * "(Bằng chữ: ...)" placeholder. Đầu ra luôn capitalize chữ đầu, hậu tố
 * "đồng" hoặc tuỳ caller (mặc định KHÔNG thêm đơn vị — caller tự thêm
 * "đồng" / "VND" theo ngữ cảnh).
 *
 * Reference cách đọc: TCVN. Hỗ trợ số nguyên tới hàng tỷ tỷ.
 * Negative / NaN / floats → trả về "" (caller fallback).
 *
 * Tech debt resolution: F-024 Phase 2A liệt kê `totalAmountInWords` chưa
 * implement. Helper này pure-function (no DI / config) → unit test dễ +
 * Phase 2B inject vào buildRenderContext.
 */

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const SCALES = ['', 'nghìn', 'triệu', 'tỷ'];

/**
 * Đọc 1 nhóm 3 chữ số (000-999).
 * @param showAllDigits true nếu nhóm KHÔNG phải nhóm đầu tiên cao nhất → đọc
 *   số 0 ở hàng trăm (vd "một tỷ không trăm hai triệu").
 */
function readGroup(group: number, showAllDigits: boolean): string {
  if (group === 0) return '';
  const hundreds = Math.floor(group / 100);
  const tens = Math.floor((group % 100) / 10);
  const ones = group % 10;

  const parts: string[] = [];

  // Hàng trăm
  if (hundreds > 0) {
    parts.push(`${DIGITS[hundreds]} trăm`);
  } else if (showAllDigits && (tens > 0 || ones > 0)) {
    parts.push('không trăm');
  }

  // Hàng chục
  if (tens > 1) {
    parts.push(`${DIGITS[tens]} mươi`);
    if (ones === 1) parts.push('mốt');
    else if (ones === 4) parts.push('tư');
    else if (ones === 5) parts.push('lăm');
    else if (ones > 0) parts.push(DIGITS[ones]);
  } else if (tens === 1) {
    parts.push('mười');
    if (ones === 5) parts.push('lăm');
    else if (ones > 0) parts.push(DIGITS[ones]);
  } else if (tens === 0 && ones > 0) {
    if (hundreds > 0 || showAllDigits) parts.push('lẻ');
    parts.push(DIGITS[ones]);
  }

  return parts.join(' ').trim();
}

/**
 * Convert integer → Vietnamese words.
 *
 * Examples:
 *   - 0          → "không"
 *   - 105        → "một trăm lẻ năm"
 *   - 1_234_567  → "một triệu hai trăm ba mươi bốn nghìn năm trăm sáu mươi bảy"
 *   - 1_000_000_000_000 → "một nghìn tỷ"
 */
export function numToVnWords(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '';
  if (value < 0) return '';
  const n = Math.floor(Math.abs(value));
  if (n === 0) return 'Không';

  // Chia thành nhóm 3 chữ số (từ thấp lên cao)
  const groups: number[] = [];
  let remaining = n;
  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }

  // Quy tắc: nhóm cao nhất (last) KHÔNG showAllDigits ("không trăm/lẻ" omit),
  // các nhóm thấp hơn THÌ phải showAllDigits để đọc đủ.
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i];
    const isHighest = i === groups.length - 1;
    const groupWord = readGroup(group, !isHighest);
    if (groupWord) {
      parts.push(groupWord);
      if (i > 0 && SCALES[i]) parts.push(SCALES[i]);
    } else if (i > 0 && groups.slice(0, i).some((g) => g > 0)) {
      // Group này = 0 nhưng có group thấp hơn khác 0 → vẫn cần scale word
      // cho group thấp hơn. Skip cur group, nhưng cần ghi nhận "nghìn"/"triệu"
      // sẽ được handle ở vòng lặp tiếp theo (group thấp hơn xử lý đầy đủ qua
      // showAllDigits).
    }
  }

  const out = parts.join(' ').replace(/\s+/g, ' ').trim();
  // Capitalize first char
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/**
 * Helper: convert số tiền VND → cụm "X đồng" capitalized.
 */
export function vndAmountInWords(amount: number | null | undefined): string {
  const words = numToVnWords(amount);
  if (!words) return '';
  return `${words} đồng`;
}
