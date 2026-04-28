/**
 * Escape regex special chars before embedding user input into a `$regex` query.
 * Prevents ReDoS attacks via crafted patterns like `(.*)*`.
 */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
