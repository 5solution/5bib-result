"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { LeaderSupplyView } from "@/lib/supply-api";
import {
  leaderCreateAssignment,
  leaderCreateStation,
  leaderDeleteStation,
  leaderListAssignableMembers,
  leaderListStations,
  leaderRemoveAssignment,
  leaderUpdateStation,
  leaderUpdateStationStatus,
  type AssignableMember,
  type CreateStationInput,
  type StationAssignment,
  type StationStatus,
  type StationWithAssignments,
} from "@/lib/station-api";

/**
 * v1.9 — Full leader station manager.
 *
 * Leaders can create, edit, delete stations that belong to their team(s),
 * and assign / remove crew members. All mutations go through the token-auth
 * `/api/public/team-leader/:token/…` endpoints added in the v1.9 backend.
 *
 * Coverage % from supply allocations still derives from `leaderSupply` items
 * for backward compat.
 */
export function LeaderStationManager({
  token,
  leaderSupply,
}: {
  token: string;
  leaderSupply: LeaderSupplyView | null;
}): React.ReactElement {
  const [stations, setStations] = useState<StationWithAssignments[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Expanded station row (shows personnel + actions inline)
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StationWithAssignments | null>(
    null,
  );
  const [statusTarget, setStatusTarget] =
    useState<StationWithAssignments | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<StationWithAssignments | null>(null);
  const [assignTarget, setAssignTarget] =
    useState<StationWithAssignments | null>(null);

  const reload = useCallback(async () => {
    try {
      const data = await leaderListStations(token);
      setStations(data);
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function flash(type: "success" | "error", text: string): void {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 2800);
  }

  // Categories derived from supply view (most reliable) or from loaded stations
  const categories = useMemo(() => {
    if (
      leaderSupply?.managed_category_ids?.length &&
      leaderSupply.managed_category_names?.length
    ) {
      return leaderSupply.managed_category_ids.map((id, i) => ({
        id,
        name: leaderSupply.managed_category_names[i] ?? `Team ${id}`,
      }));
    }
    const map = new Map<number, string>();
    for (const s of stations) {
      if (!map.has(s.category_id)) {
        map.set(s.category_id, s.category_name ?? `Team ${s.category_id}`);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [leaderSupply, stations]);

  // Coverage map from supply allocations
  const coverageMap = useMemo(() => {
    const m = new Map<number, { itemCount: number; confirmedItemCount: number }>();
    for (const item of leaderSupply?.items ?? []) {
      for (const s of item.stations) {
        const ex = m.get(s.station_id);
        if (ex) {
          ex.itemCount += 1;
          if (s.is_locked) ex.confirmedItemCount += 1;
        } else {
          m.set(s.station_id, {
            itemCount: 1,
            confirmedItemCount: s.is_locked ? 1 : 0,
          });
        }
      }
    }
    return m;
  }, [leaderSupply]);

  if (loading) {
    return (
      <div className="py-6 text-center text-sm" style={{ color: "#9ca3af" }}>
        Đang tải danh sách trạm…
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        className="rounded-lg border p-3 text-sm"
        style={{
          background: "#fef2f2",
          borderColor: "#fca5a5",
          color: "#b91c1c",
        }}
      >
        {loadError}{" "}
        <button
          type="button"
          onClick={() => void reload()}
          className="underline"
        >
          Thử lại
        </button>
      </div>
    );
  }

  // Group by category
  const groups = new Map<
    number,
    {
      id: number;
      name: string;
      color: string | null;
      stations: StationWithAssignments[];
    }
  >();
  for (const s of stations) {
    const bucket = groups.get(s.category_id);
    if (bucket) {
      bucket.stations.push(s);
    } else {
      groups.set(s.category_id, {
        id: s.category_id,
        name: s.category_name ?? `Team ${s.category_id}`,
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
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs" style={{ color: "#6b7280" }}>
          <strong>{stations.length}</strong> trạm ·{" "}
          {leaderSupply?.managed_category_names?.length
            ? leaderSupply.managed_category_names.join(" + ")
            : "Nhóm của bạn"}
        </p>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold"
          style={{ background: "#1d4ed8", color: "#ffffff" }}
        >
          <span aria-hidden>＋</span> Thêm trạm
        </button>
      </div>

      {stations.length === 0 ? (
        <div
          className="rounded-xl border-2 border-dashed p-6 text-center text-sm"
          style={{ borderColor: "#e5e7eb", color: "#6b7280" }}
        >
          <p className="font-medium">Chưa có trạm nào</p>
          <p className="mt-1 text-xs">
            Nhấn &quot;Thêm trạm&quot; để tạo trạm đầu tiên cho nhóm.
          </p>
        </div>
      ) : (
        Array.from(groups.entries()).map(([catId, group]) => (
          <div key={catId} className="space-y-1.5">
            {showGroupHeaders && (
              <div className="flex items-center gap-2 px-1">
                <span
                  aria-hidden
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: group.color ?? "#9ca3af" }}
                />
                <h3 className="text-xs font-semibold" style={{ color: "#374151" }}>
                  {group.name} · {group.stations.length} trạm
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setCreateOpen(true);
                  }}
                  className="ml-auto text-[11px] underline"
                  style={{ color: "#1d4ed8" }}
                >
                  + thêm trạm
                </button>
              </div>
            )}

            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden">
              {group.stations.map((s) => {
                const cov = coverageMap.get(s.id) ?? {
                  itemCount: 0,
                  confirmedItemCount: 0,
                };
                const isExpanded = expandedId === s.id;
                const totalAssigned =
                  s.supervisor_count + s.worker_count;

                return (
                  <li key={s.id} className="bg-white">
                    {/* Station summary row */}
                    <button
                      type="button"
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : s.id)
                      }
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5 flex-wrap">
                          <span aria-hidden>📍</span>
                          <span className="truncate">{s.station_name}</span>
                          <StatusBadge status={s.status} />
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {s.location_description ?? "Chưa có mô tả vị trí"}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          👥 {totalAssigned} nhân sự
                          {cov.itemCount > 0
                            ? ` · 📦 ${cov.confirmedItemCount}/${cov.itemCount} vật tư`
                            : ""}
                        </p>
                      </div>
                      <span
                        className="text-gray-400 text-lg leading-none flex-shrink-0"
                        aria-hidden
                      >
                        {isExpanded ? "▲" : "▼"}
                      </span>
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div
                        className="px-3 pb-3 space-y-3"
                        style={{ background: "#f9fafb" }}
                      >
                        {/* Action buttons — safe actions first, destructive below separator */}
                        <div className="pt-1 space-y-2">
                          <div className="flex flex-wrap gap-2">
                            <ActionBtn
                              icon="✏️"
                              label="Chỉnh sửa"
                              onClick={() => {
                                setEditTarget(s);
                              }}
                            />
                            <ActionBtn
                              icon="🔄"
                              label="Trạng thái"
                              onClick={() => setStatusTarget(s)}
                            />
                          </div>
                          <div className="border-t pt-2">
                            <ActionBtn
                              icon="🗑️"
                              label="Xóa trạm"
                              danger
                              onClick={() => setDeleteTarget(s)}
                            />
                          </div>
                        </div>

                        {/* Personnel list */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-gray-700">
                              Nhân sự phân công
                            </p>
                            <button
                              type="button"
                              onClick={() => setAssignTarget(s)}
                              className="text-xs font-semibold rounded-md px-2 py-1"
                              style={{
                                background: "#dbeafe",
                                color: "#1d4ed8",
                              }}
                            >
                              + Phân công
                            </button>
                          </div>

                          {totalAssigned === 0 ? (
                            <p
                              className="text-xs italic"
                              style={{ color: "#9ca3af" }}
                            >
                              Chưa có ai được phân công tại trạm này.
                            </p>
                          ) : (
                            <ul className="space-y-1">
                              {[...s.supervisors, ...s.workers].map((m) => (
                                <AssignmentRow
                                  key={m.assignment_id}
                                  member={m}
                                  onRemove={async () => {
                                    try {
                                      await leaderRemoveAssignment(
                                        token,
                                        m.assignment_id,
                                      );
                                      flash(
                                        "success",
                                        `Đã xóa ${m.full_name} khỏi trạm`,
                                      );
                                      await reload();
                                    } catch (e) {
                                      flash(
                                        "error",
                                        (e as Error).message,
                                      );
                                    }
                                  }}
                                />
                              ))}
                            </ul>
                          )}
                        </div>

                        {/* Maps link */}
                        {s.gps_lat && s.gps_lng ? (
                          <a
                            href={`https://www.google.com/maps?q=${s.gps_lat},${s.gps_lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs underline"
                            style={{ color: "#1d4ed8" }}
                          >
                            🗺️ Xem vị trí trên bản đồ
                          </a>
                        ) : null}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}

      {/* Toast */}
      {toast ? (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg"
          style={{
            background: toast.type === "success" ? "#15803d" : "#b91c1c",
            color: "#ffffff",
            maxWidth: "90vw",
          }}
        >
          {toast.text}
        </div>
      ) : null}

      {/* Create station modal */}
      {createOpen ? (
        <StationFormModal
          title="Thêm trạm mới"
          categories={categories}
          onClose={() => setCreateOpen(false)}
          onSave={async (categoryId, data) => {
            await leaderCreateStation(token, categoryId, data);
            flash("success", "Đã tạo trạm thành công");
            setCreateOpen(false);
            await reload();
          }}
        />
      ) : null}

      {/* Edit station modal */}
      {editTarget ? (
        <StationFormModal
          title={`Chỉnh sửa: ${editTarget.station_name}`}
          categories={categories}
          initialCategoryId={editTarget.category_id}
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={async (_categoryId, data) => {
            await leaderUpdateStation(token, editTarget.id, data);
            flash("success", "Đã cập nhật trạm");
            setEditTarget(null);
            await reload();
          }}
        />
      ) : null}

      {/* Change status modal */}
      {statusTarget ? (
        <ChangeStatusModal
          station={statusTarget}
          onClose={() => setStatusTarget(null)}
          onSelect={async (status) => {
            await leaderUpdateStationStatus(token, statusTarget.id, status);
            flash("success", "Đã đổi trạng thái trạm");
            setStatusTarget(null);
            await reload();
          }}
        />
      ) : null}

      {/* Confirm delete modal */}
      {deleteTarget ? (
        <ConfirmDeleteModal
          station={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await leaderDeleteStation(token, deleteTarget.id);
            flash("success", "Đã xóa trạm");
            setDeleteTarget(null);
            if (expandedId === deleteTarget.id) setExpandedId(null);
            await reload();
          }}
        />
      ) : null}

      {/* Assign member modal */}
      {assignTarget ? (
        <AssignMemberModal
          token={token}
          station={assignTarget}
          onClose={() => setAssignTarget(null)}
          onAssigned={async () => {
            flash("success", "Đã phân công thành công");
            setAssignTarget(null);
            await reload();
          }}
          onError={(msg) => flash("error", msg)}
        />
      ) : null}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function StatusBadge({
  status,
}: {
  status: StationStatus;
}): React.ReactElement {
  const map: Record<StationStatus, { label: string; bg: string; color: string }> = {
    setup: { label: "Đang setup", bg: "#f1f5f9", color: "#475569" },
    active: { label: "Hoạt động", bg: "#dcfce7", color: "#166534" },
    closed: { label: "Đã đóng", bg: "#fee2e2", color: "#b91c1c" },
  };
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

function ActionBtn({
  icon,
  label,
  danger = false,
  onClick,
}: {
  icon: string;
  label: string;
  danger?: boolean;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium"
      style={
        danger
          ? { borderColor: "#fca5a5", color: "#b91c1c", background: "#fff" }
          : { borderColor: "#d1d5db", color: "#374151", background: "#fff" }
      }
    >
      <span aria-hidden>{icon}</span>
      {label}
    </button>
  );
}

function AssignmentRow({
  member,
  onRemove,
}: {
  member: StationAssignment;
  onRemove: () => Promise<void>;
}): React.ReactElement {
  const [busy, setBusy] = useState(false);

  return (
    <li className="flex items-center gap-2 rounded-lg border border-gray-100 bg-white px-2.5 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-gray-900 flex items-center gap-1">
          {member.full_name}
          {member.is_supervisor ? (
            <span
              className="rounded-full px-1.5 text-[10px] font-bold"
              style={{ background: "#fef3c7", color: "#92400e" }}
            >
              Leader
            </span>
          ) : null}
        </p>
        <p className="text-[11px] text-gray-500">
          {member.role_name ?? "—"}
          {member.duty ? ` · ${member.duty}` : ""}
          {" · "}
          {member.phone}
        </p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onRemove();
          } finally {
            setBusy(false);
          }
        }}
        className="flex-shrink-0 rounded-md border border-red-200 px-2 py-1 text-[11px] font-medium text-red-600 disabled:opacity-50"
      >
        {busy ? "…" : "Xóa"}
      </button>
    </li>
  );
}

// ─── Modals ──────────────────────────────────────────────────

function ModalOverlay({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: "rgba(0,0,0,0.5)" }}
    >
      <div
        className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl bg-white p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        style={{ boxShadow: "0 4px 32px rgba(0,0,0,0.18)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Đóng"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StationFormModal({
  title,
  categories,
  initialCategoryId,
  initial,
  onClose,
  onSave,
}: {
  title: string;
  categories: Array<{ id: number; name: string }>;
  initialCategoryId?: number;
  initial?: StationWithAssignments;
  onClose: () => void;
  onSave: (categoryId: number, data: CreateStationInput) => Promise<void>;
}): React.ReactElement {
  const defaultCat = initialCategoryId ?? categories[0]?.id ?? 0;
  const [categoryId, setCategoryId] = useState<number>(defaultCat);
  const [name, setName] = useState(initial?.station_name ?? "");
  const [location, setLocation] = useState(
    initial?.location_description ?? "",
  );
  const [sortOrder, setSortOrder] = useState(
    String(initial?.sort_order ?? 0),
  );
  const [gpsLat, setGpsLat] = useState(initial?.gps_lat ?? "");
  const [gpsLng, setGpsLng] = useState(initial?.gps_lng ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(): Promise<void> {
    if (!name.trim()) {
      setErr("Tên trạm không được để trống");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onSave(categoryId, {
        station_name: name.trim(),
        location_description: location.trim() || null,
        gps_lat: gpsLat ? parseFloat(gpsLat) : null,
        gps_lng: gpsLng ? parseFloat(gpsLng) : null,
        sort_order: parseInt(sortOrder, 10) || 0,
      });
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <ModalOverlay title={title} onClose={onClose}>
      <div className="space-y-3">
        {categories.length > 1 && !initial ? (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Thuộc team
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Tên trạm <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VD: Trạm Nước Km5"
            maxLength={200}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Mô tả vị trí
          </label>
          <textarea
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="VD: Gần cọc km 5, cạnh suối"
            maxLength={1000}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Vĩ độ (GPS Lat)
            </label>
            <input
              type="number"
              value={gpsLat}
              onChange={(e) => setGpsLat(e.target.value)}
              placeholder="21.028511"
              step="0.0000001"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Kinh độ (GPS Lng)
            </label>
            <input
              type="number"
              value={gpsLng}
              onChange={(e) => setGpsLng(e.target.value)}
              placeholder="105.8042"
              step="0.0000001"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Thứ tự hiển thị
          </label>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            min={0}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        {err ? (
          <p className="text-xs text-red-600 font-medium">{err}</p>
        ) : null}
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-700"
        >
          Hủy
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleSubmit()}
          className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: "#1d4ed8" }}
        >
          {busy ? "Đang lưu…" : "Lưu"}
        </button>
      </div>
    </ModalOverlay>
  );
}

function ChangeStatusModal({
  station,
  onClose,
  onSelect,
}: {
  station: StationWithAssignments;
  onClose: () => void;
  onSelect: (s: StationStatus) => Promise<void>;
}): React.ReactElement {
  const [busy, setBusy] = useState<StationStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const options: Array<{
    value: StationStatus;
    label: string;
    desc: string;
    bg: string;
    color: string;
  }> = [
    {
      value: "setup",
      label: "Đang setup",
      desc: "Trạm đang chuẩn bị, chưa vận hành",
      bg: "#f1f5f9",
      color: "#475569",
    },
    {
      value: "active",
      label: "Hoạt động",
      desc: "Trạm đang vận hành trong sự kiện",
      bg: "#dcfce7",
      color: "#166534",
    },
    {
      value: "closed",
      label: "Đã đóng",
      desc: "Trạm kết thúc hoặc tạm đóng",
      bg: "#fee2e2",
      color: "#b91c1c",
    },
  ];

  return (
    <ModalOverlay
      title={`Đổi trạng thái: ${station.station_name}`}
      onClose={onClose}
    >
      <div className="space-y-2">
        {options.map((opt) => {
          const isActive = station.status === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={busy !== null || isActive}
              onClick={async () => {
                setBusy(opt.value);
                setErr(null);
                try {
                  await onSelect(opt.value);
                } catch (e) {
                  setErr((e as Error).message);
                  setBusy(null);
                }
              }}
              className="w-full flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left disabled:opacity-60 transition-opacity"
              style={{
                borderColor: isActive ? opt.color : "#e5e7eb",
                background: isActive ? opt.bg : "#ffffff",
              }}
            >
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: opt.color }}>
                  {opt.label}
                  {isActive ? " (hiện tại)" : ""}
                </p>
                <p className="text-xs text-gray-500">{opt.desc}</p>
              </div>
              {busy === opt.value ? (
                <span className="text-xs text-gray-500">Đang lưu…</span>
              ) : null}
            </button>
          );
        })}
        {err ? (
          <p className="text-xs text-red-600 font-medium">{err}</p>
        ) : null}
      </div>
    </ModalOverlay>
  );
}

function ConfirmDeleteModal({
  station,
  onClose,
  onConfirm,
}: {
  station: StationWithAssignments;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}): React.ReactElement {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const hasAssignments =
    station.supervisor_count + station.worker_count > 0;

  return (
    <ModalOverlay title="Xóa trạm" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-gray-700">
          Bạn chắc chắn muốn xóa trạm{" "}
          <strong>&quot;{station.station_name}&quot;</strong>?
        </p>
        {hasAssignments ? (
          <div
            className="rounded-lg border p-3 text-xs"
            style={{
              background: "#fef3c7",
              borderColor: "#fcd34d",
              color: "#92400e",
            }}
          >
            ⚠️ Trạm này có{" "}
            {station.supervisor_count + station.worker_count} nhân sự đang
            được phân công. Xóa trạm sẽ bị từ chối — hãy xóa phân công
            trước.
          </div>
        ) : (
          <p className="text-xs text-gray-500">
            Hành động này không thể hoàn tác.
          </p>
        )}
        {err ? (
          <p className="text-xs text-red-600 font-medium">{err}</p>
        ) : null}
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-700"
        >
          Hủy
        </button>
        {!hasAssignments ? (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setErr(null);
              try {
                await onConfirm();
              } catch (e) {
                setErr((e as Error).message);
                setBusy(false);
              }
            }}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "#b91c1c" }}
          >
            {busy ? "Đang xóa…" : "Xóa trạm"}
          </button>
        ) : null}
      </div>
    </ModalOverlay>
  );
}

function AssignMemberModal({
  token,
  station,
  onClose,
  onAssigned,
  onError,
}: {
  token: string;
  station: StationWithAssignments;
  onClose: () => void;
  onAssigned: () => Promise<void>;
  onError: (msg: string) => void;
}): React.ReactElement {
  const [members, setMembers] = useState<AssignableMember[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [dutyMap, setDutyMap] = useState<Record<number, string>>({});

  useEffect(() => {
    leaderListAssignableMembers(token, station.id)
      .then((data) => setMembers(data))
      .catch((e: Error) => setLoadErr(e.message));
  }, [token, station.id]);

  const filtered = useMemo(() => {
    if (!members) return [];
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.full_name.toLowerCase().includes(q) ||
        m.phone.includes(q) ||
        m.role_name.toLowerCase().includes(q),
    );
  }, [members, search]);

  async function assign(m: AssignableMember): Promise<void> {
    setBusyId(m.registration_id);
    try {
      await leaderCreateAssignment(
        token,
        station.id,
        m.registration_id,
        dutyMap[m.registration_id] ?? null,
      );
      await onAssigned();
    } catch (e) {
      onError((e as Error).message);
      setBusyId(null);
    }
  }

  return (
    <ModalOverlay
      title={`Phân công: ${station.station_name}`}
      onClose={onClose}
    >
      {loadErr ? (
        <p className="text-sm text-red-600">{loadErr}</p>
      ) : members === null ? (
        <p className="text-sm text-gray-500">Đang tải danh sách…</p>
      ) : (
        <div className="space-y-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm tên, SĐT, vai trò…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />

          {filtered.length === 0 ? (
            <p className="text-xs text-gray-500 italic py-2">
              {members.length === 0
                ? "Tất cả thành viên đủ điều kiện đã được phân công tại trạm này."
                : "Không tìm thấy thành viên phù hợp."}
            </p>
          ) : (
            <ul className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
              {filtered.map((m) => (
                <li
                  key={m.registration_id}
                  className="rounded-xl border border-gray-100 bg-gray-50 p-2.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 flex items-center gap-1">
                        {m.full_name}
                        {m.is_leader_role ? (
                          <span
                            className="rounded-full px-1.5 text-[10px] font-bold"
                            style={{
                              background: "#fef3c7",
                              color: "#92400e",
                            }}
                          >
                            Leader
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-gray-500">
                        {m.role_name} · {m.phone}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busyId === m.registration_id}
                      onClick={() => void assign(m)}
                      className="flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                      style={{ background: "#1d4ed8" }}
                    >
                      {busyId === m.registration_id ? "…" : "Phân công"}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={dutyMap[m.registration_id] ?? ""}
                    onChange={(e) =>
                      setDutyMap((prev) => ({
                        ...prev,
                        [m.registration_id]: e.target.value,
                      }))
                    }
                    placeholder="Nhiệm vụ cụ thể (tuỳ chọn)"
                    maxLength={100}
                    className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={onClose}
        className="w-full rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-700"
      >
        Đóng
      </button>
    </ModalOverlay>
  );
}
