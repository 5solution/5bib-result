import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats an ISO date string (YYYY-MM-DD or ISO datetime) to Vietnamese
 * dd/mm/yyyy display format. Returns "—" for null/undefined/empty.
 */
export function formatDateVN(iso: string | null | undefined): string {
  if (!iso) return "—";
  const dateStr = iso.slice(0, 10); // take "YYYY-MM-DD"
  const parts = dateStr.split("-");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return "—";
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Formats an ISO date string to Vietnamese dd/mm/yyyy for use in an input
 * field. Returns "" (empty string) for null/undefined/empty instead of "—".
 */
export function isoToVNField(iso: string | null | undefined): string {
  if (!iso) return "";
  const dateStr = iso.slice(0, 10);
  const parts = dateStr.split("-");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return "";
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Parses a Vietnamese dd/mm/yyyy input string back to ISO YYYY-MM-DD.
 * Accepts separators / - or .
 * Returns null if empty or the date is invalid.
 */
export function parseDateVN(vn: string): string | null {
  if (!vn?.trim()) return null;
  const m = vn.trim().match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (!m) return null;
  const day = m[1].padStart(2, "0");
  const month = m[2].padStart(2, "0");
  const year = m[3];
  // Use the Date constructor for calendar validation (rejects Feb 31, etc.)
  const d = new Date(`${year}-${month}-${day}T00:00:00`);
  if (
    isNaN(d.getTime()) ||
    d.getFullYear() !== Number(year) ||
    d.getMonth() + 1 !== Number(month) ||
    d.getDate() !== Number(day)
  ) {
    return null;
  }
  return `${year}-${month}-${day}`;
}

/**
 * Strip Vietnamese diacritics to ASCII. "Nguyễn Văn Á" → "Nguyen Van A".
 * Used to compare bank_holder_name against full_name case- and diacritic-
 * insensitively in the admin manual-register dialog.
 */
export function removeDiacritics(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
}

export function namesMatch(a: string, b: string): boolean {
  const normalize = (s: string): string =>
    removeDiacritics(s).toUpperCase().trim().replace(/\s+/g, " ")
  return normalize(a) === normalize(b)
}
