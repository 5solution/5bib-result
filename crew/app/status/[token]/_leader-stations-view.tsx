"use client";

import type { LeaderSupplyView } from "@/lib/supply-api";

/**
 * v1.6 — Read-only station roster for leaders. Derived from the leader
 * supply view (which is the only public surface that enumerates stations
 * belonging to the leader's role without adding a new backend endpoint).
 *
 * Leader-side station CRUD + assignments stay on the admin dashboard per
 * Danny's scope split; leaders only see coverage + status here.
 */
export function LeaderStationsView({
  leaderSupply,
}: {
  leaderSupply: LeaderSupplyView | null;
}): React.ReactElement {
  if (leaderSupply == null) {
    return (
      <div
        className="rounded-lg border p-3 text-sm"
        style={{ background: "#fef3c7", borderColor: "#fcd34d", color: "#92400e" }}
      >
        Không tải được danh sách trạm. Vui lòng thử lại sau.
      </div>
    );
  }

  // Dedupe stations across all items (a station appears once per item in the
  // nested tree). Use a Map keyed by station_id.
  const stationMap = new Map<
    number,
    { id: number; name: string; itemCount: number; confirmedItemCount: number }
  >();
  for (const item of leaderSupply.items) {
    for (const s of item.stations) {
      const existing = stationMap.get(s.station_id);
      if (existing) {
        existing.itemCount += 1;
        if (s.is_locked) existing.confirmedItemCount += 1;
      } else {
        stationMap.set(s.station_id, {
          id: s.station_id,
          name: s.station_name,
          itemCount: 1,
          confirmedItemCount: s.is_locked ? 1 : 0,
        });
      }
    }
  }

  const stations = Array.from(stationMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "vi"),
  );

  if (stations.length === 0) {
    return (
      <div
        className="rounded-lg border p-3 text-sm"
        style={{ background: "#f9fafb", borderColor: "#e5e7eb", color: "#6b7280" }}
      >
        Role của bạn chưa có trạm nào. Admin sẽ tạo trước ngày vận hành.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">
        Tổng <strong>{stations.length}</strong> trạm thuộc role{" "}
        <strong>{leaderSupply.role_name}</strong>. Quản lý chi tiết (CRUD + phân
        công crew/TNV) ở admin dashboard.
      </p>
      <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden">
        {stations.map((s) => (
          <li
            key={s.id}
            className="flex items-center gap-3 px-3 py-2.5 bg-white"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 truncate">
                📍 {s.name}
              </p>
              <p className="text-xs text-gray-500">
                {s.itemCount} vật tư · {s.confirmedItemCount} đã xác nhận
              </p>
            </div>
            <CoverageBadge
              total={s.itemCount}
              confirmed={s.confirmedItemCount}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function CoverageBadge({
  total,
  confirmed,
}: {
  total: number;
  confirmed: number;
}): React.ReactElement {
  const pct = total === 0 ? 0 : Math.round((confirmed / total) * 100);
  const color = pct === 100 ? "#15803d" : pct >= 50 ? "#b45309" : "#6b7280";
  const bg = pct === 100 ? "#dcfce7" : pct >= 50 ? "#fef3c7" : "#f3f4f6";
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold flex-shrink-0"
      style={{ background: bg, color }}
    >
      {pct}%
    </span>
  );
}
