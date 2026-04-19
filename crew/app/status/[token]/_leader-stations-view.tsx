"use client";

import type { LeaderStationBrief, LeaderSupplyView } from "@/lib/supply-api";

/**
 * v1.8.1 — Read-only station roster for leaders.
 *
 * Source of truth is `leaderSupply.stations` (top-level list populated by
 * backend regardless of allocations). Older deployments only exposed stations
 * nested under items[].stations[] — we fall back to that path for backward
 * compat if the new field is absent.
 *
 * Coverage % ("N% vật tư đã xác nhận tại trạm") is still derived from the
 * allocation graph inside items[].
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

  // Build per-station coverage counts from the allocation graph.
  const coverageMap = new Map<
    number,
    { itemCount: number; confirmedItemCount: number }
  >();
  for (const item of leaderSupply.items) {
    for (const s of item.stations) {
      const existing = coverageMap.get(s.station_id);
      if (existing) {
        existing.itemCount += 1;
        if (s.is_locked) existing.confirmedItemCount += 1;
      } else {
        coverageMap.set(s.station_id, {
          itemCount: 1,
          confirmedItemCount: s.is_locked ? 1 : 0,
        });
      }
    }
  }

  // Prefer backend-provided top-level list; fall back to deriving from items
  // for deployments still on the old shape.
  let stations: LeaderStationBrief[] = leaderSupply.stations ?? [];
  if (stations.length === 0 && leaderSupply.items.length > 0) {
    const seen = new Map<number, LeaderStationBrief>();
    for (const item of leaderSupply.items) {
      for (const s of item.stations) {
        if (!seen.has(s.station_id)) {
          seen.set(s.station_id, {
            id: s.station_id,
            station_name: s.station_name,
            category_id: 0,
            category_name: null,
            category_color: null,
            location_description: null,
            gps_lat: null,
            gps_lng: null,
            google_maps_url: null,
            status: "setup",
            sort_order: 0,
            assignment_count: 0,
          });
        }
      }
    }
    stations = Array.from(seen.values());
  }

  if (stations.length === 0) {
    return (
      <div
        className="rounded-lg border p-3 text-sm"
        style={{ background: "#f9fafb", borderColor: "#e5e7eb", color: "#6b7280" }}
      >
        Team của bạn chưa có trạm nào. Admin sẽ tạo trước ngày vận hành.
      </div>
    );
  }

  // Group by category for a cleaner hierarchy when leader manages multiple
  // teams. Single-team leaders get a flat list (group rendering skips headers).
  const groups = new Map<
    string,
    { name: string; color: string | null; stations: LeaderStationBrief[] }
  >();
  for (const s of stations) {
    const key = `${s.category_id}:${s.category_name ?? ""}`;
    const bucket = groups.get(key);
    if (bucket) {
      bucket.stations.push(s);
    } else {
      groups.set(key, {
        name: s.category_name ?? "Không có team",
        color: s.category_color,
        stations: [s],
      });
    }
  }
  for (const g of groups.values()) {
    g.stations.sort(
      (a, b) =>
        a.sort_order - b.sort_order ||
        a.station_name.localeCompare(b.station_name, "vi"),
    );
  }
  const showGroupHeaders = groups.size > 1;

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Tổng <strong>{stations.length}</strong> trạm thuộc{" "}
        {leaderSupply.managed_category_names?.length
          ? leaderSupply.managed_category_names.join(" + ")
          : `role ${leaderSupply.role_name}`}
        . Tạo/sửa trạm + phân công crew/TNV ở admin dashboard.
      </p>

      {Array.from(groups.entries()).map(([key, group]) => (
        <div key={key} className="space-y-1.5">
          {showGroupHeaders ? (
            <div className="flex items-center gap-2 px-1">
              <span
                aria-hidden
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ background: group.color ?? "#9ca3af" }}
              />
              <h3 className="text-xs font-semibold text-gray-700">
                {group.name} · {group.stations.length} trạm
              </h3>
            </div>
          ) : null}
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden">
            {group.stations.map((s) => {
              const cov = coverageMap.get(s.id) ?? {
                itemCount: 0,
                confirmedItemCount: 0,
              };
              return (
                <li
                  key={s.id}
                  className="flex items-center gap-3 px-3 py-2.5 bg-white"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate flex items-center gap-1.5">
                      <span aria-hidden>📍</span>
                      <span className="truncate">{s.station_name}</span>
                      <StatusBadge status={s.status} />
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {s.location_description ?? "Chưa có mô tả vị trí"}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      👥 {s.assignment_count} nhân sự
                      {cov.itemCount > 0 ? (
                        <>
                          {" · "}
                          📦 {cov.itemCount} vật tư · {cov.confirmedItemCount}{" "}
                          đã xác nhận
                        </>
                      ) : null}
                      {s.google_maps_url ? (
                        <>
                          {" · "}
                          <a
                            href={s.google_maps_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            Xem bản đồ
                          </a>
                        </>
                      ) : null}
                    </p>
                  </div>
                  {cov.itemCount > 0 ? (
                    <CoverageBadge
                      total={cov.itemCount}
                      confirmed={cov.confirmedItemCount}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: "setup" | "active" | "closed";
}): React.ReactElement {
  const map = {
    setup: { label: "Đang setup", bg: "#f1f5f9", color: "#475569" },
    active: { label: "Active", bg: "#dcfce7", color: "#166534" },
    closed: { label: "Đóng", bg: "#fee2e2", color: "#b91c1c" },
  } as const;
  const v = map[status];
  return (
    <span
      className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
      style={{ background: v.bg, color: v.color }}
    >
      {v.label}
    </span>
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
