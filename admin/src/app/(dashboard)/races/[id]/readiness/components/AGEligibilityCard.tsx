"use client";

import { useAgEligibility } from "../hooks/useAgEligibility";

/**
 * F-019 v2 — AG Eligibility Card.
 *
 * Pre-race readiness surface for Awards/AG bracket compute. Shows:
 *   - Total athletes + DOB coverage % + readiness badge.
 *   - Missing DOB list (top 100 BIBs).
 *   - Bracket distribution preview (gender × bracket × count).
 *   - Vendor Category sanity check (populated/empty/malformed).
 *
 * Threshold:
 *   - ≥ 95% → READY (green).
 *   - 80-94% → WARNING (yellow).
 *   - < 80% → NOT READY (red).
 */
interface AGEligibilityCardProps {
  raceId: string;
}

const READINESS_BADGE: Record<
  "READY" | "WARNING" | "NOT_READY",
  { label: string; bg: string; text: string; ring: string }
> = {
  READY: {
    label: "READY",
    bg: "bg-emerald-50",
    text: "text-emerald-800",
    ring: "ring-emerald-300",
  },
  WARNING: {
    label: "WARNING",
    bg: "bg-amber-50",
    text: "text-amber-800",
    ring: "ring-amber-300",
  },
  NOT_READY: {
    label: "NOT READY",
    bg: "bg-rose-50",
    text: "text-rose-800",
    ring: "ring-rose-300",
  },
};

const BRACKET_SOURCE_LABEL: Record<"5bib" | "vendor" | "hybrid", string> = {
  "5bib": "5BIB Independent (Path A)",
  vendor: "Vendor Trust Mode (Path B)",
  hybrid: "Hybrid (A first, B fallback)",
};

export function AGEligibilityCard({ raceId }: AGEligibilityCardProps) {
  const { data, isLoading, error, refetch } = useAgEligibility(raceId);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
        <div className="h-5 w-48 animate-pulse rounded bg-stone-200"></div>
        <div className="mt-4 h-24 animate-pulse rounded bg-stone-100"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-800">
        <h3 className="text-base font-semibold">Lỗi tải báo cáo eligibility AG</h3>
        <p className="mt-1 text-sm">{(error as Error).message}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-3 rounded-md border border-rose-300 bg-white px-3 py-1 text-sm font-medium text-rose-700 hover:bg-rose-100"
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const badge = READINESS_BADGE[data.readinessLevel];
  const coveragePct = Math.round(data.coverage * 100);

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-stone-900">
            AG Bracket Eligibility (F-019 v2)
          </h3>
          <p className="mt-1 text-sm text-stone-600">
            Báo cáo DOB coverage + bracket distribution + vendor health cho
            Awards podium compute. Source: 5BIB Independent calc + 2-layer
            verify (advisory v2).
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${badge.bg} ${badge.text} ${badge.ring}`}
        >
          {badge.label}
        </span>
      </div>

      {/* Coverage stats */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-stone-200 bg-stone-50 p-3">
          <p className="text-xs uppercase tracking-wider text-stone-500">
            Tổng athletes
          </p>
          <p className="mt-1 text-2xl font-semibold text-stone-900">
            {data.totalAthletes.toLocaleString("vi-VN")}
          </p>
        </div>
        <div className="rounded-md border border-stone-200 bg-stone-50 p-3">
          <p className="text-xs uppercase tracking-wider text-stone-500">
            Có DOB (coverage)
          </p>
          <p className="mt-1 text-2xl font-semibold text-stone-900">
            {coveragePct}%
            <span className="ml-2 text-sm font-normal text-stone-500">
              ({data.withDob}/{data.totalAthletes})
            </span>
          </p>
        </div>
        <div className="rounded-md border border-stone-200 bg-stone-50 p-3">
          <p className="text-xs uppercase tracking-wider text-stone-500">
            Thiếu DOB
          </p>
          <p className="mt-1 text-2xl font-semibold text-stone-900">
            {data.withoutDob.toLocaleString("vi-VN")}
          </p>
        </div>
      </div>

      {/* Bracket source */}
      <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
        <strong className="font-semibold">Bracket source:</strong>{" "}
        {BRACKET_SOURCE_LABEL[data.bracketSource]}
        {data.lastSyncedAt && (
          <span className="ml-2 text-xs text-blue-700">
            · Last age sync:{" "}
            {new Date(data.lastSyncedAt).toLocaleString("vi-VN")}
          </span>
        )}
      </div>

      {/* Bracket distribution */}
      {data.bracketDistribution.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-stone-800">
            Phân bố bracket (preview)
          </h4>
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full divide-y divide-stone-200 text-sm">
              <thead className="bg-stone-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-stone-700">
                    Giới
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-stone-700">
                    Bracket
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-stone-700">
                    Số athletes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {data.bracketDistribution.map((b) => (
                  <tr key={`${b.gender}-${b.ageGroup}`}>
                    <td className="px-3 py-2 font-medium text-stone-800">
                      {b.gender === "M" ? "Nam" : "Nữ"}
                    </td>
                    <td className="px-3 py-2 text-stone-700">{b.ageGroup}</td>
                    <td className="px-3 py-2 text-right text-stone-700">
                      {b.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Vendor Category sanity */}
      <div className="mt-4 rounded-md border border-stone-200 bg-stone-50 p-3 text-sm">
        <h4 className="font-semibold text-stone-800">
          Vendor Category sanity check
        </h4>
        <p className="mt-1 text-xs text-stone-600">
          Vendor RaceResult <code>Category</code> field cho Path B fallback +
          Pattern H verify. Empty &gt; 0 = vendor đẩy whitespace (giống bug
          Giải Công An) → BTC sửa config trước race day.
        </p>
        <ul className="mt-2 grid grid-cols-3 gap-2 text-xs">
          <li className="rounded bg-emerald-50 p-2 text-emerald-800 ring-1 ring-emerald-200">
            <span className="font-semibold">{data.vendorCategoryHealth.populated}</span>{" "}
            populated
          </li>
          <li className="rounded bg-rose-50 p-2 text-rose-800 ring-1 ring-rose-200">
            <span className="font-semibold">{data.vendorCategoryHealth.empty}</span>{" "}
            empty/whitespace
          </li>
          <li className="rounded bg-amber-50 p-2 text-amber-800 ring-1 ring-amber-200">
            <span className="font-semibold">{data.vendorCategoryHealth.malformed}</span>{" "}
            malformed
          </li>
        </ul>
      </div>

      {/* Missing DOB list */}
      {data.missingDobBibs.length > 0 && (
        <details className="mt-4 group">
          <summary className="cursor-pointer text-sm font-medium text-stone-700 hover:text-stone-900">
            Danh sách BIB thiếu DOB ({data.missingDobBibs.length} hiển thị
            {data.withoutDob > data.missingDobBibs.length
              ? ` / ${data.withoutDob} tổng`
              : ""}
            )
          </summary>
          <div className="mt-2 max-h-40 overflow-auto rounded-md border border-stone-200 bg-stone-50 p-2 font-mono text-xs text-stone-700">
            {data.missingDobBibs.join(", ")}
          </div>
        </details>
      )}
    </div>
  );
}
