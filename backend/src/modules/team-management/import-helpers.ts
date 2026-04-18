/**
 * Per-cell validators used by the registration bulk-import flow. Kept free
 * of DB / NestJS deps so they're unit-testable in isolation.
 *
 * Return an error message string when invalid, null when OK.
 */
import { VN_BANKS, normalizeHolderName } from './constants/banks';

const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const;

export function validateFullName(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return 'Thiếu họ tên';
  if (s.length < 2) return 'Họ tên quá ngắn';
  if (s.length > 255) return 'Họ tên vượt 255 ký tự';
  return null;
}

export function validateEmail(raw: unknown): string | null {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return 'Thiếu email';
  // Simple pragmatic email regex.
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(s)) {
    return 'Email không hợp lệ';
  }
  return null;
}

export function validatePhoneVN(raw: unknown): string | null {
  const s = String(raw ?? '').replace(/[\s.-]/g, '');
  if (!s) return 'Thiếu số điện thoại';
  if (!/^\+?(84|0)[0-9]{9,10}$/.test(s)) {
    return 'Số điện thoại không đúng định dạng VN';
  }
  return null;
}

export function validateCCCD(raw: unknown, required: boolean): string | null {
  const s = String(raw ?? '').replace(/\s/g, '');
  if (!s) return required ? 'Thiếu CCCD/CMND' : null;
  if (!/^\d{9}$|^\d{12}$/.test(s)) {
    return 'CCCD/CMND phải có 9 hoặc 12 chữ số';
  }
  return null;
}

export function validateDob(raw: unknown, required: boolean): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return required ? 'Thiếu ngày sinh' : null;
  // YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return 'Ngày sinh phải theo định dạng YYYY-MM-DD';
  }
  const d = new Date(`${s}T00:00:00Z`);
  if (isNaN(d.getTime())) return 'Ngày sinh không hợp lệ';
  const year = Number(s.slice(0, 4));
  const currentYear = new Date().getUTCFullYear();
  if (year < 1900 || year > currentYear - 14) {
    return `Năm sinh phải trong khoảng 1900 – ${currentYear - 14}`;
  }
  return null;
}

export function validateShirtSize(
  raw: unknown,
  required: boolean,
  options?: string[],
): string | null {
  const s = String(raw ?? '').trim().toUpperCase();
  if (!s) return required ? 'Thiếu size áo' : null;
  const allowed = options && options.length > 0 ? options : (SHIRT_SIZES as readonly string[]);
  if (!allowed.includes(s)) {
    return `Size áo phải thuộc: ${allowed.join(', ')}`;
  }
  return null;
}

export function validateBankAccount(raw: unknown): string | null {
  const s = String(raw ?? '').replace(/[\s.-]/g, '');
  if (!s) return null; // optional at validator level; required checked via form_fields
  if (!/^\d{6,20}$/.test(s)) {
    return 'Số tài khoản phải có 6–20 chữ số';
  }
  return null;
}

export function validateBankName(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (!(VN_BANKS as readonly string[]).includes(s)) {
    return 'Ngân hàng không có trong danh sách hỗ trợ';
  }
  return null;
}

export function validateBankHolderName(
  holder: unknown,
  fullName: unknown,
): string | null {
  const h = String(holder ?? '').trim();
  if (!h) return null;
  const n = String(fullName ?? '').trim();
  if (!n) return null;
  if (normalizeHolderName(h) !== normalizeHolderName(n)) {
    return 'Tên chủ tài khoản phải khớp với họ tên';
  }
  return null;
}

/**
 * Sanitize an email to a canonical form (trim + lowercase). Used for
 * in-file + DB duplicate detection.
 */
export function canonEmail(raw: unknown): string {
  return String(raw ?? '').trim().toLowerCase();
}

/**
 * Coerce a role-id-or-name cell into a numeric role id, using the provided
 * maps. Returns `{ id, error }` — exactly one will be non-null.
 */
export function resolveRoleRef(
  raw: unknown,
  byId: Map<number, { id: number; role_name: string }>,
  byNameLower: Map<string, number>,
): { id: number | null; error: string | null } {
  const s = String(raw ?? '').trim();
  if (!s) return { id: null, error: 'Thiếu vai trò (role_id hoặc role_name)' };
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    if (byId.has(n)) return { id: n, error: null };
    return { id: null, error: `role_id=${n} không tồn tại trong event` };
  }
  const lower = s.toLowerCase();
  const hit = byNameLower.get(lower);
  if (hit) return { id: hit, error: null };
  return { id: null, error: `Vai trò "${s}" không tìm thấy` };
}

export const SHIRT_SIZE_OPTIONS = SHIRT_SIZES;
