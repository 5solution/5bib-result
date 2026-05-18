/**
 * FEATURE-036 — Results table (Server Component).
 *
 * Renders rows from backend `GET /api/race-results` — already parsed timing
 * JSON strings server-side (CLAUDE.md note). NO client-side parse needed.
 */

import type { RaceResult } from "@/lib/seo-api";

export function ResultsTable({ rows }: { rows: RaceResult[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white py-12 text-center text-stone-600">
        Chưa có ai finish course này.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-stone-50 text-left text-xs font-semibold uppercase text-stone-600">
          <tr>
            <th className="px-3 py-2.5">Hạng</th>
            <th className="px-3 py-2.5">BIB</th>
            <th className="px-3 py-2.5">Tên</th>
            <th className="px-3 py-2.5">Chip Time</th>
            <th className="px-3 py-2.5">Gun Time</th>
            <th className="px-3 py-2.5">Pace</th>
            <th className="px-3 py-2.5">Giới tính</th>
            <th className="px-3 py-2.5">Category</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {rows.map((r) => (
            <tr key={r.bib} className="hover:bg-stone-50">
              <td className="px-3 py-2.5 font-mono">{r.overallRank ?? "-"}</td>
              <td className="px-3 py-2.5 font-mono">{r.bib}</td>
              <td className="px-3 py-2.5 font-medium">{r.name ?? "-"}</td>
              <td className="px-3 py-2.5 font-mono">{r.chipTime ?? "-"}</td>
              <td className="px-3 py-2.5 font-mono text-stone-500">
                {r.gunTime ?? "-"}
              </td>
              <td className="px-3 py-2.5 font-mono text-stone-500">
                {r.pace ?? "-"}
              </td>
              <td className="px-3 py-2.5 text-stone-600">{r.gender ?? "-"}</td>
              <td className="px-3 py-2.5 text-stone-600">{r.category ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
