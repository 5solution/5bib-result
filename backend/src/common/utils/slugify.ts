/**
 * F-047 shared slugify utility — Vietnamese diacritics aware.
 *
 * Steps:
 *   1. Replace đ/Đ → d/D (NOT covered by NFD normalization)
 *   2. NFD decompose unicode characters
 *   3. Strip combining diacritical marks (U+0300-U+036F)
 *   4. Keep only ASCII alphanumeric + spaces
 *   5. Lowercase
 *   6. Trim, collapse whitespace → hyphen
 *
 * Examples:
 *   - "Trương Văn Quân" → "truong-van-quan"
 *   - "Nguyễn Văn A" → "nguyen-van-a"
 *   - "Đào Thị Hà" → "dao-thi-ha"
 *
 * Refactored from `reconciliation/export/batch-export.service.ts:37` — Manager
 * Plan F-047 Adjustment #2 Option A (shared util prevents drift).
 *
 * Use case primary: F-047 athlete slug `<bib>-<slugifyAthleteName(name)>`.
 * Use case secondary: reconciliation export filename (uppercase + underscore variant).
 */

export function slugifyVN(name: string): string {
  return name
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

/**
 * Reconciliation export variant — UPPERCASE + underscore separator.
 * Kept for backward compatibility with existing batch-export.service.ts.
 */
export function slugifyForFilename(name: string): string {
  return name
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}
