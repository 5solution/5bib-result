"use client";

/**
 * F-019 v2 — Bracket Source Banner.
 *
 * Surface displaying current race-level `bracketSource` config + v2 active flag.
 * Read-only Phase 1 (mutation = race.schema patch by Race Admin in settings tab,
 * out of scope for Awards UI this iteration).
 *
 * Default: `'5bib'` → primary Path A (DOB master-data computed bracket).
 * Override: `'vendor'` (BTC trust mode khi DOB coverage < 50%) | `'hybrid'`.
 */
interface BracketSourceBannerProps {
  bracketSource?: "5bib" | "vendor" | "hybrid";
  coverage?: number;
}

const SOURCE_DETAIL: Record<
  "5bib" | "vendor" | "hybrid",
  { title: string; bg: string; ring: string; description: string }
> = {
  "5bib": {
    title: "5BIB Independent Ranking active",
    bg: "bg-blue-50",
    ring: "ring-blue-200",
    description:
      "F-019 v2 Path A primary — bracket compute từ DOB master-data MySQL platform. 2-Layer verify: vendor Category dùng làm cross-check (Pattern H VENDOR_MISMATCH).",
  },
  vendor: {
    title: "Vendor Trust Mode (Path B)",
    bg: "bg-amber-50",
    ring: "ring-amber-200",
    description:
      "BTC override khi DOB coverage thấp. Risk: vendor Category sai → 5BIB mất uy tín \"trọng tài độc lập\". Banner sẽ hiện trên public ranking page khi mode này active.",
  },
  hybrid: {
    title: "Hybrid mode (A first, B fallback)",
    bg: "bg-stone-50",
    ring: "ring-stone-200",
    description:
      "Path A primary cho athletes có DOB. Athletes thiếu DOB → fallback parse vendor Category. Compromise giữa neutrality + coverage.",
  },
};

export function BracketSourceBanner({ bracketSource = "5bib", coverage }: BracketSourceBannerProps) {
  const detail = SOURCE_DETAIL[bracketSource];
  return (
    <div className={`rounded-md border ring-1 ${detail.bg} ${detail.ring} px-4 py-3`}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 inline-flex items-center rounded bg-white px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-stone-700 ring-1 ring-stone-200">
          F-019 v2
        </span>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-stone-900">{detail.title}</h4>
          <p className="mt-1 text-xs text-stone-700">{detail.description}</p>
          {coverage != null && (
            <p className="mt-1 text-xs text-stone-600">
              Current DOB coverage: <strong>{Math.round(coverage * 100)}%</strong> — xem
              chi tiết tại tab <em>Pre-race Readiness → AG Eligibility Card</em>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
