/**
 * FEATURE-036 — Vietnamese-aware slugify utility.
 *
 * Manager-recommended Option A: tự code, KHÔNG install lib mới
 * (BR-02 spec). Coverage:
 *   - NFD-normalize → strip combining diacritics (à → a)
 *   - Vietnamese đ/Đ → d/D (NFD không cover)
 *   - Lowercase + kebab + trim + max 80 chars
 */
export function slugify(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

/**
 * Append year suffix from a date (BR-01) — race "VnExpress Marathon HCM"
 * + 2026-01-15 → "vnexpress-marathon-hcm-2026".
 */
export function slugifyWithYear(
  title: string | null | undefined,
  startDate: Date | string | null | undefined,
): string {
  const base = slugify(title);
  if (!base) return '';
  if (!startDate) return base;
  const year = new Date(startDate).getUTCFullYear();
  if (Number.isNaN(year)) return base;
  const withYear = `${base}-${year}`;
  return withYear.slice(0, 80).replace(/-+$/g, '');
}
