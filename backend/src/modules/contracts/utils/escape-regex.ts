/**
 * F-024 QC M-01: Escape regex special characters before use trong Mongo `$regex` operator.
 *
 * Defense vs Regex DoS (catastrophic backtracking): admin có thể gửi input như
 * `(a+)+b` hoặc `^(?:a|a)*$` → CPU spike. Wrap user input bằng helper này trước
 * khi inject vào `$regex` filter.
 *
 * Pattern: escape tất cả chars có meaning trong regex syntax.
 *
 * Usage:
 *   filter.name = { $regex: escapeRegex(opts.search), $options: 'i' };
 */
export function escapeRegex(input: string): string {
  if (input == null) return '';
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
