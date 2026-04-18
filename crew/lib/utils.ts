/**
 * Strip Vietnamese diacritics to ASCII. "Nguyễn Văn Á" → "Nguyen Van A".
 * Used to compare bank_holder_name against full_name case- and diacritic-
 * insensitively on the crew register form.
 */
export function removeDiacritics(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

/**
 * Compare two Vietnamese names ignoring diacritics, case, and leading /
 * trailing whitespace (also collapses runs of inner whitespace).
 */
export function namesMatch(a: string, b: string): boolean {
  const normalize = (s: string): string =>
    removeDiacritics(s).toUpperCase().trim().replace(/\s+/g, " ");
  return normalize(a) === normalize(b);
}
