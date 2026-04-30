/**
 * BR-01: chip_id LUÔN UPPER(TRIM()) cả FE và BE. Chỉ 1 chỗ định nghĩa
 * để đảm bảo consistency 100% paths (defense cho MongoDB collation).
 */
export function normalizeChipId(input: string): string {
  return input.trim().toUpperCase();
}

/**
 * Strip BOM (UTF-8 ﻿) — Excel save default. Không bỏ thì header
 * "chip_id" bị parser nhận thành "﻿chip_id".
 */
export function stripBom(input: string): string {
  if (input.charCodeAt(0) === 0xfeff) return input.slice(1);
  return input;
}

/**
 * MUST-DO #8 từ Eng+QC review: regex mở rộng so với spec.
 * Reject formula injection cells starting with: =  +  -  @  TAB  CR  '
 * (Excel/Sheets treat these as formula). Spec gốc chỉ check 4 ký tự.
 */
export function hasFormulaInjection(value: string): boolean {
  return /^[=+\-@\t\r']/.test(value);
}

/** SHA-256 hash (hex) — dùng cho audit log token (không lưu plaintext). */
export function sha256Hex(input: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require('crypto') as typeof import('crypto');
  return createHash('sha256').update(input).digest('hex');
}
