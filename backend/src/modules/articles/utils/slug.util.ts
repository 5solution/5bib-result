/**
 * Convert Vietnamese title → URL-safe slug.
 * Strips diacritics, lowercases, replaces non-alphanumeric with `-`.
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove diacritic marks
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

/**
 * Strip HTML tags to count words. Used for read time computation.
 */
export function countWords(html: string): number {
  if (!html) return 0;
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? text.split(' ').length : 0;
}

export function computeReadTimeMinutes(html: string): number {
  const words = countWords(html);
  return Math.max(1, Math.ceil(words / 200));
}
