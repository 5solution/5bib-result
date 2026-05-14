/**
 * FEATURE-027 — Recent Results section.
 *
 * Config: { title, raceId, limit }
 *
 * Server-side fetch race-results /api/race-results?raceId=X&limit=N
 * Show top N finishers (rank 1..N).
 */

import type { SectionResponseDto } from "@/lib/api-generated";
import { getRaceUrl } from "../internal-urls";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";

type RecentResultsConfig = {
  title?: string;
  raceId?: string;
  limit?: number;
};

type Result = {
  Bib?: number | string;
  Name?: string;
  OverallRank?: string;
  ChipTime?: string;
  GunTime?: string;
  Category?: string;
};

type Race = {
  id?: string;
  _id?: string;
  slug?: string;
  name?: string;
};

async function fetchRace(raceId: string): Promise<Race | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/races/${encodeURIComponent(raceId)}`, {
      next: { revalidate: 300, tags: [`race:${raceId}`] },
    });
    if (!res.ok) return null;
    return (await res.json()) as Race;
  } catch {
    return null;
  }
}

async function fetchResults(raceId: string, limit: number): Promise<Result[]> {
  try {
    const params = new URLSearchParams({ raceId, limit: String(limit), pageNo: "1" });
    const res = await fetch(`${BACKEND_URL}/api/race-results?${params.toString()}`, {
      next: { revalidate: 60, tags: [`race-results:${raceId}`] },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const list: Result[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.results)
          ? data.results
          : [];
    return list.slice(0, limit);
  } catch {
    return [];
  }
}

export async function RecentResultsSection({ section }: { section: SectionResponseDto }) {
  const c = section.config as RecentResultsConfig;
  if (!c.raceId) return null;
  const limit = c.limit ?? 5;
  const [race, results] = await Promise.all([
    fetchRace(c.raceId),
    fetchResults(c.raceId, limit),
  ]);
  if (results.length === 0) return null;

  return (
    <section className="px-6 py-14">
      <div className="mx-auto max-w-[var(--promo-max-width,1200px)]">
        {c.title && (
          <h2 className="mb-2 font-[var(--promo-font)] text-2xl font-bold tracking-tight">
            {c.title}
          </h2>
        )}
        {race?.name && (
          <div className="mb-6 text-sm text-stone-500">{race.name}</div>
        )}
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-stone-100">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-stone-600">#</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-stone-600">VĐV</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-stone-600">BIB</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-stone-600">Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={`${r.Bib}-${i}`} className="border-t hover:bg-stone-50">
                  <td className="px-4 py-3 font-mono font-bold text-[var(--promo-primary)]">
                    {r.OverallRank ?? i + 1}
                  </td>
                  <td className="px-4 py-3 font-semibold">{r.Name ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-stone-500">{r.Bib ?? "—"}</td>
                  <td className="px-4 py-3 font-mono">{r.ChipTime ?? r.GunTime ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {race?.slug && (
          <div className="mt-4 text-right">
            <a
              href={getRaceUrl(race.slug)}
              data-promo-cta
              data-promo-section-id={section._id}
              data-promo-cta-label="Xem toàn bộ kết quả"
              data-promo-cta-url={getRaceUrl(race.slug)}
              className="text-sm font-semibold text-[var(--promo-primary)] hover:underline"
            >
              Xem toàn bộ kết quả →
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
