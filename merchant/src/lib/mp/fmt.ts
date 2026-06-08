/**
 * F-069 Merchant Portal — formatters (ported from mp-data.jsx `fmt`).
 * Pure, typed helpers for numbers / currency / dates. UI-only; backend
 * data is never translated.
 */
import type { Lang } from "./i18n";

/** BCP-47 locale per supported UI language (F-071). Used for Intl grouping. */
const NF_LOCALE: Record<Lang, string> = {
  vi: "vi-VN",
  en: "en-US",
  km: "km-KH",
  lo: "lo-LA",
  ms: "ms-MY",
};

function nf(lang: Lang): Intl.NumberFormat {
  try {
    return new Intl.NumberFormat(NF_LOCALE[lang] ?? "vi-VN");
  } catch {
    return new Intl.NumberFormat("vi-VN");
  }
}

export const fmt = {
  /** Thousands-grouped integer. */
  num(n: number, lang: Lang = "vi"): string {
    return nf(lang).format(Math.round(n));
  },
  /** VND amount with " đ" suffix. Currency stays VND for every language (BR-07). */
  vnd(n: number, lang: Lang = "vi"): string {
    return nf(lang).format(Math.round(n)) + " đ";
  },
  /** Compact magnitude (K/M/B) for chart axes. */
  vndShort(n: number): string {
    const a = Math.abs(n);
    if (a >= 1e9) return (n / 1e9).toFixed(a >= 1e10 ? 0 : 1) + "B";
    if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1) + "M";
    if (a >= 1e3) return Math.round(n / 1e3) + "K";
    return String(Math.round(n));
  },
  /** Signed percentage delta. */
  pct(n: number): string {
    return (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
  },
  /** dd/mm/yyyy. */
  date(d: Date, _lang: Lang = "vi"): string {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${d.getFullYear()}`;
  },
  /** dd/mm/yyyy hh:mm. */
  dateTime(d: Date): string {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${d.getFullYear()} ${hh}:${mi}`;
  },
  /**
   * Short month label for chart axes. Kept ASCII-compact across languages so
   * narrow axis ticks never overflow: vi → "Th{m}", en/ms → 3-letter abbr,
   * km/lo → "M{m}" (non-Latin month names are too wide for an axis tick).
   */
  monthShort(d: Date, lang: Lang = "vi"): string {
    const m = d.getMonth() + 1;
    if (lang === "vi") return "Th" + m;
    if (lang === "en") {
      return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1];
    }
    if (lang === "ms") {
      return ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"][m - 1];
    }
    return "M" + m; // km, lo — compact numeric for axis safety
  },
};

/** Safe parse of an ISO/string date → Date | null. */
export function parseDate(d: string | null | undefined): Date | null {
  if (!d) return null;
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? null : t;
}

/** Convenience: format an ISO date string as dd/mm/yyyy, or "—". */
export function fmtDateStr(d: string | null | undefined, lang: Lang = "vi"): string {
  const dt = parseDate(d);
  return dt ? fmt.date(dt, lang) : "—";
}
