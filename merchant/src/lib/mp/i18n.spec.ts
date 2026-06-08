/**
 * F-071 — unit tests for the merchant i18n core + formatters.
 * Covers TC-01..TC-12 from 01-ba-prd.md. Pure functions only (no DOM).
 */
import { describe, it, expect } from "vitest";
import { t, lab, DICT, L, LANGS, LANG_CODES, isLang, type Lang, type Entry } from "./i18n";
import { fmt } from "./fmt";

const NON_VI: Lang[] = ["en", "km", "lo", "ms"];

describe("i18n — t()", () => {
  it("TC-01 returns the translated string for a language that has it", () => {
    const km = t("nav_revenue", "km");
    expect(typeof km).toBe("string");
    expect(km.length).toBeGreaterThan(0);
    expect(km).not.toBe(t("nav_revenue", "vi")); // genuinely translated, not vi
  });

  it("TC-02 falls back to vi when the language is missing for a key", () => {
    const e: Entry = { vi: "Chỉ tiếng Việt" }; // only vi present
    const dict = { only_vi: e } as Record<string, Entry>;
    // emulate via lab() which shares the fallback logic
    expect(lab(dict, "only_vi", "km")).toBe("Chỉ tiếng Việt");
    expect(lab(dict, "only_vi", "ms")).toBe("Chỉ tiếng Việt");
  });

  it("TC-03 returns the raw key when the key is missing entirely", () => {
    expect(t("khong_ton_tai", "en")).toBe("khong_ton_tai");
  });

  it("TC-04 defaults to vi when no language is passed", () => {
    expect(t("nav_revenue")).toBe(DICT.nav_revenue.vi);
  });
});

describe("i18n — lab()", () => {
  it("TC-05 returns label translations + falls back to vi", () => {
    expect(lab(L.orderStatus, "paid", "lo")).toBe(L.orderStatus.paid.lo);
    expect(lab(L.category, "MANUAL", "km")).toBe(L.category.MANUAL.km);
    // missing key → raw key
    expect(lab(L.orderStatus, "nope", "en")).toBe("nope");
  });
});

describe("i18n — coverage (TC-06, BR-12)", () => {
  const allEntries: Array<[string, Entry]> = [
    ...Object.entries(DICT),
    ...Object.values(L).flatMap((map) => Object.entries(map)),
  ];

  it("every entry has a non-empty string for ALL 5 languages", () => {
    const missing: string[] = [];
    for (const [key, entry] of allEntries) {
      for (const code of LANG_CODES) {
        const v = (entry as Record<Lang, string | undefined>)[code];
        if (typeof v !== "string" || v.trim().length === 0) {
          missing.push(`${key}.${code}`);
        }
      }
    }
    expect(missing).toEqual([]); // any miss → fails with the exact key.lang list
  });

  it("TC-07 every entry has a required vi base", () => {
    for (const [key, entry] of allEntries) {
      expect(typeof entry.vi, `${key}.vi`).toBe("string");
      expect(entry.vi.trim().length, `${key}.vi`).toBeGreaterThan(0);
    }
  });
});

describe("i18n — LANGS registry", () => {
  it("has exactly the 5 expected codes in order", () => {
    expect(LANGS.map((l) => l.code)).toEqual(["vi", "en", "km", "lo", "ms"]);
    for (const l of LANGS) {
      expect(l.native.length).toBeGreaterThan(0);
      expect(l.short.length).toBeGreaterThan(0);
      expect(l.flag.length).toBeGreaterThan(0);
    }
  });

  it("TC-08 isLang rejects unknown / legacy values", () => {
    expect(isLang("zz")).toBe(false);
    expect(isLang("")).toBe(false);
    expect(isLang(null)).toBe(false);
    expect(isLang(undefined)).toBe(false);
    expect(isLang(123)).toBe(false);
  });

  it("TC-09 isLang accepts every supported code", () => {
    for (const code of ["vi", ...NON_VI]) {
      expect(isLang(code)).toBe(true);
    }
  });
});

describe("fmt — currency & numbers (TC-10..12)", () => {
  it('TC-10 vnd() keeps the " đ" suffix for every language', () => {
    for (const code of LANG_CODES) {
      const out = fmt.vnd(1234567, code);
      expect(out.endsWith(" đ"), `vnd ${code}`).toBe(true);
    }
  });

  it("TC-11 num() groups thousands without throwing for any locale", () => {
    for (const code of LANG_CODES) {
      const out = fmt.num(1234567, code);
      expect(typeof out).toBe("string");
      expect(out.replace(/\D/g, "")).toBe("1234567"); // digits preserved
    }
  });

  it("TC-12 date() is dd/mm/yyyy consistently across languages", () => {
    const d = new Date(2026, 5, 8); // 2026-06-08 (month is 0-based)
    for (const code of LANG_CODES) {
      expect(fmt.date(d, code)).toBe("08/06/2026");
    }
  });
});
