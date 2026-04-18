import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
