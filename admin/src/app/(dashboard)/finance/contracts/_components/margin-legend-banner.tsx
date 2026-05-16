/**
 * FEATURE-038 — Margin tier legend banner (Server Component).
 *
 * Sub-header below page title explaining margin color codes:
 *   🟢 Healthy >10% / 🟡 Thin 0-10% / 🔴 Loss <0% / ⚪ Neutral (no revenue)
 *
 * Per BR-38-07 + PAUSE-38-05 accept default (Danny chốt A 2026-05-15).
 */

export function MarginLegendBanner() {
  return (
    <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700">
      <span className="font-medium text-stone-600">Margin: </span>
      <span className="mr-3 inline-flex items-center gap-1">
        <span aria-hidden>🟢</span>
        <span>
          Tốt <span className="font-mono text-stone-500">&gt;10%</span>
        </span>
      </span>
      <span className="mr-3 inline-flex items-center gap-1">
        <span aria-hidden>🟡</span>
        <span>
          Mỏng <span className="font-mono text-stone-500">0-10%</span>
        </span>
      </span>
      <span className="mr-3 inline-flex items-center gap-1">
        <span aria-hidden>🔴</span>
        <span>
          Lỗ <span className="font-mono text-stone-500">&lt;0%</span>
        </span>
      </span>
      <span className="inline-flex items-center gap-1">
        <span aria-hidden>⚪</span>
        <span>Chưa có doanh thu</span>
      </span>
    </div>
  );
}
