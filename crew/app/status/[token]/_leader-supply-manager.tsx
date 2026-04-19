"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getLeaderSupplyView,
  leaderCreateSupplement,
  leaderUpsertStationAllocations,
  leaderUpsertSupplyRequest,
  type LeaderSupplyView,
} from "@/lib/supply-api";

/**
 * v1.6 — Full supply workflow for leaders.
 *
 * Step 1 (Order): table — rows = items of the role, editable requested_qty.
 *   Admin fulfillment (fulfilled_qty / gap_qty) is read-only feedback.
 *
 * Step 2 (Allocation): matrix — rows = stations of role, cols = items.
 *   Each cell is editable allocated_qty (unless is_locked). Bottom row shows
 *   allocated sum vs admin-fulfilled capacity with a running "còn lại".
 *
 * Supplement: each locked allocation row exposes a "+ Bổ sung" button that
 *   opens a modal to add a new round with qty + optional note.
 */
type Step = "order" | "allocation";

export function LeaderSupplyManager({
  token,
  initial,
}: {
  token: string;
  initial: LeaderSupplyView | null;
}): React.ReactElement {
  const router = useRouter();
  const [view, setView] = useState<LeaderSupplyView | null>(initial);
  const [loadError, setLoadError] = useState<string | null>(
    initial ? null : "Chưa tải được dữ liệu vật tư.",
  );
  const [step, setStep] = useState<Step>("order");
  const [toast, setToast] = useState<
    { type: "success" | "error"; text: string } | null
  >(null);
  const [supplementTarget, setSupplementTarget] = useState<{
    allocationId: number;
    stationName: string;
    itemName: string;
    unit: string;
  } | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    try {
      const next = await getLeaderSupplyView(token);
      setView(next);
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, [token]);

  useEffect(() => {
    if (!view) void reload();
  }, [view, reload]);

  function flash(type: "success" | "error", text: string): void {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 2500);
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
        {loadError}
        <button
          type="button"
          onClick={() => void reload()}
          className="ml-2 underline"
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="text-sm text-[color:var(--color-muted)]">
        Đang tải vật tư...
      </div>
    );
  }

  // v1.6 Option B2: multi-managed. Fall back to single role_name if the
  // server is pre-B2 (still shipping `role_name` only).
  const managedNames =
    view.managed_role_names && view.managed_role_names.length > 0
      ? view.managed_role_names
      : view.role_name
        ? [view.role_name]
        : [];
  const managedHeader =
    managedNames.length === 0
      ? "Chưa quản lý team nào"
      : managedNames.join(" + ");

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">
        Vật tư — {managedHeader}
      </h3>
      {toast ? (
        <div
          role="status"
          className="rounded-lg border p-2 text-xs"
          style={
            toast.type === "success"
              ? {
                  background: "#dcfce7",
                  borderColor: "#86efac",
                  color: "#15803d",
                }
              : {
                  background: "#fee2e2",
                  borderColor: "#fca5a5",
                  color: "#b91c1c",
                }
          }
        >
          {toast.text}
        </div>
      ) : null}

      <div className="flex gap-2 text-xs">
        <StepButton active={step === "order"} onClick={() => setStep("order")}>
          1. Order
        </StepButton>
        <StepButton
          active={step === "allocation"}
          onClick={() => setStep("allocation")}
        >
          2. Phân bổ
        </StepButton>
      </div>

      {step === "order" ? (
        <OrderStep
          token={token}
          view={view}
          onSaved={(next) => {
            flash("success", "Đã gửi order.");
            setView(next);
            setTimeout(() => router.refresh(), 600);
          }}
          onError={(m) => flash("error", m)}
        />
      ) : null}

      {step === "allocation" ? (
        <AllocationStep
          token={token}
          view={view}
          onSaved={(updatedView) => {
            flash("success", "Đã lưu phân bổ.");
            setView(updatedView);
            setTimeout(() => router.refresh(), 600);
          }}
          onError={(m) => flash("error", m)}
          onOpenSupplement={(target) => setSupplementTarget(target)}
        />
      ) : null}

      {supplementTarget ? (
        <SupplementModal
          target={supplementTarget}
          onCancel={() => setSupplementTarget(null)}
          onConfirm={async (qty, note) => {
            try {
              await leaderCreateSupplement(
                token,
                supplementTarget.allocationId,
                qty,
                note,
              );
              setSupplementTarget(null);
              flash("success", "Đã tạo đợt bổ sung.");
              await reload();
              setTimeout(() => router.refresh(), 600);
            } catch (e) {
              flash("error", (e as Error).message);
            }
          }}
        />
      ) : null}
    </div>
  );
}

function StepButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border px-3 py-1.5 font-medium transition-colors"
      style={
        active
          ? {
              background: "#1d4ed8",
              color: "#ffffff",
              borderColor: "#1d4ed8",
            }
          : {
              background: "#ffffff",
              color: "#374151",
              borderColor: "#d1d5db",
            }
      }
    >
      {children}
    </button>
  );
}

/* ────────────────────────── Order step ─────────────────────────── */

function OrderStep({
  token,
  view,
  onSaved,
  onError,
}: {
  token: string;
  view: LeaderSupplyView;
  onSaved: (next: LeaderSupplyView) => void;
  onError: (msg: string) => void;
}): React.ReactElement {
  const [inputs, setInputs] = useState<Record<number, string>>(() => {
    const m: Record<number, string> = {};
    for (const it of view.items) m[it.item_id] = String(it.requested_qty);
    return m;
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSave(): Promise<void> {
    setSubmitting(true);
    try {
      const items = view.items.map((it) => ({
        item_id: it.item_id,
        requested_qty: Number(inputs[it.item_id] ?? it.requested_qty) || 0,
      }));
      await leaderUpsertSupplyRequest(token, { items });
      const next = await getLeaderSupplyView(token);
      onSaved(next);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (view.items.length === 0) {
    return (
      <p className="text-xs text-gray-500">
        Chưa có vật tư nào được tạo. Admin cần thêm vật tư chung trước, sau đó
        bạn sẽ order ở đây.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">
        Nhập số lượng bạn muốn yêu cầu. Admin sẽ xác nhận số thực tế (fulfilled).
      </p>
      <div className="overflow-x-auto -mx-1 sm:mx-0">
        <table className="w-full text-xs">
          <thead>
            <tr
              className="text-left"
              style={{ background: "#f9fafb", color: "#6b7280" }}
            >
              <th className="px-2 py-2 font-semibold">Vật tư</th>
              <th className="px-2 py-2 font-semibold whitespace-nowrap">
                Yêu cầu
              </th>
              <th className="px-2 py-2 font-semibold whitespace-nowrap">
                Đã cấp
              </th>
              <th className="px-2 py-2 font-semibold whitespace-nowrap">
                Gap
              </th>
            </tr>
          </thead>
          <tbody>
            {view.items.map((it) => {
              const fulfilled = it.fulfilled_qty ?? 0;
              const gap = it.gap_qty ?? 0;
              return (
                <tr
                  key={it.item_id}
                  className="border-t border-gray-100 bg-white"
                >
                  <td className="px-2 py-2">
                    <p className="font-medium text-gray-900">{it.item_name}</p>
                    <p className="text-gray-500">{it.unit}</p>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step="1"
                      value={inputs[it.item_id] ?? ""}
                      onChange={(e) =>
                        setInputs((p) => ({ ...p, [it.item_id]: e.target.value }))
                      }
                      className="input w-20 text-xs"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <span className="mono-data">{fulfilled}</span>
                  </td>
                  <td className="px-2 py-2">
                    <span
                      className="mono-data"
                      style={{
                        color: gap > 0 ? "#b45309" : "#15803d",
                      }}
                    >
                      {gap > 0 ? `-${gap}` : "✓"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={submitting}
        className="rounded-xl bg-blue-700 text-white px-4 py-2 text-sm font-bold hover:bg-blue-800 disabled:opacity-60"
      >
        {submitting ? "Đang gửi..." : "💾 Gửi order"}
      </button>
    </div>
  );
}

/* ──────────────────────── Allocation step ──────────────────────── */

interface MatrixCellKey {
  stationId: number;
  itemId: number;
}

function cellKey(k: MatrixCellKey): string {
  return `${k.stationId}:${k.itemId}`;
}

function AllocationStep({
  token,
  view,
  onSaved,
  onError,
  onOpenSupplement,
}: {
  token: string;
  view: LeaderSupplyView;
  onSaved: (next: LeaderSupplyView) => void;
  onError: (msg: string) => void;
  onOpenSupplement: (t: {
    allocationId: number;
    stationName: string;
    itemName: string;
    unit: string;
  }) => void;
}): React.ReactElement {
  // Collect unique stations across all items (same derivation as stations
  // view). Preserve station order by first-seen in items.
  const stations = useMemo(() => {
    const map = new Map<number, { id: number; name: string }>();
    for (const it of view.items) {
      for (const s of it.stations) {
        if (!map.has(s.station_id)) {
          map.set(s.station_id, { id: s.station_id, name: s.station_name });
        }
      }
    }
    return Array.from(map.values());
  }, [view]);

  // Build quick lookup of (stationId, itemId) → station row
  const grid = useMemo(() => {
    const g = new Map<string, LeaderSupplyView["items"][number]["stations"][number]>();
    for (const it of view.items) {
      for (const s of it.stations) {
        g.set(cellKey({ stationId: s.station_id, itemId: it.item_id }), s);
      }
    }
    return g;
  }, [view]);

  const [inputs, setInputs] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const it of view.items) {
      for (const s of it.stations) {
        m[cellKey({ stationId: s.station_id, itemId: it.item_id })] = String(
          s.allocated_qty,
        );
      }
    }
    return m;
  });

  const [submittingStation, setSubmittingStation] = useState<number | null>(null);

  function getCellValue(stationId: number, itemId: number): number {
    const raw = inputs[cellKey({ stationId, itemId })];
    const n = Number(raw);
    return Number.isNaN(n) ? 0 : n;
  }

  function itemAllocSum(itemId: number): number {
    return stations.reduce((acc, st) => acc + getCellValue(st.id, itemId), 0);
  }

  async function handleSaveStation(stationId: number): Promise<void> {
    setSubmittingStation(stationId);
    try {
      const allocations: Array<{ item_id: number; allocated_qty: number }> = [];
      for (const it of view.items) {
        const cell = grid.get(cellKey({ stationId, itemId: it.item_id }));
        if (!cell) continue;
        if (cell.is_locked) continue; // cannot change locked rows
        allocations.push({
          item_id: it.item_id,
          allocated_qty: getCellValue(stationId, it.item_id),
        });
      }
      await leaderUpsertStationAllocations(token, stationId, { allocations });
      const next = await getLeaderSupplyView(token);
      onSaved(next);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setSubmittingStation(null);
    }
  }

  if (view.items.length === 0 || stations.length === 0) {
    return (
      <p className="text-xs text-gray-500">
        Chưa có vật tư hoặc trạm để phân bổ. Kiểm tra lại bước Order và admin
        đã tạo trạm chưa.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Rows = trạm · Cột = vật tư. Ô bị khoá (🔒) khi crew đã xác nhận nhận —
        muốn đổi phải nhờ admin unlock.
      </p>

      <div className="overflow-x-auto -mx-1 sm:mx-0 rounded-lg border border-gray-200">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="sticky left-0 bg-gray-50 px-2 py-2 text-left font-semibold text-gray-600 z-10">
                Trạm
              </th>
              {view.items.map((it) => (
                <th
                  key={it.item_id}
                  className="px-2 py-2 text-left font-semibold text-gray-600 whitespace-nowrap"
                >
                  {it.item_name}
                  <br />
                  <span className="text-gray-400 font-normal">{it.unit}</span>
                </th>
              ))}
              <th className="px-2 py-2 text-left font-semibold text-gray-600">
                Lưu
              </th>
            </tr>
          </thead>
          <tbody>
            {stations.map((st) => (
              <tr key={st.id} className="border-t border-gray-100 bg-white">
                <td className="sticky left-0 bg-white px-2 py-2 font-medium text-gray-900 whitespace-nowrap z-10">
                  {st.name}
                </td>
                {view.items.map((it) => {
                  const cell = grid.get(
                    cellKey({ stationId: st.id, itemId: it.item_id }),
                  );
                  if (!cell) {
                    return (
                      <td key={it.item_id} className="px-2 py-2 text-gray-300">
                        —
                      </td>
                    );
                  }
                  const locked = cell.is_locked;
                  const key = cellKey({
                    stationId: st.id,
                    itemId: it.item_id,
                  });
                  return (
                    <td key={it.item_id} className="px-2 py-2 align-top">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step="1"
                          readOnly={locked}
                          value={inputs[key] ?? ""}
                          onChange={(e) =>
                            setInputs((p) => ({ ...p, [key]: e.target.value }))
                          }
                          className={`input w-16 text-xs ${locked ? "bg-gray-100" : ""}`}
                          aria-label={`Phân bổ ${it.item_name} cho ${st.name}`}
                        />
                        {locked ? (
                          <span title="Đã khoá" aria-label="Đã khoá">🔒</span>
                        ) : null}
                      </div>
                      {locked ? (
                        <div className="mt-1 text-[10px] text-gray-500 space-y-0.5">
                          <p>
                            ✅ {cell.confirmed_qty ?? 0}/{cell.allocated_qty}
                          </p>
                          {cell.shortage_qty != null && cell.shortage_qty > 0 ? (
                            <p className="text-amber-700">
                              thiếu {cell.shortage_qty}
                            </p>
                          ) : null}
                          {cell.confirmed_by?.phone ? (
                            <a
                              href={`tel:${cell.confirmed_by.phone.replace(/[^\d+]/g, "")}`}
                              className="text-blue-700 underline"
                            >
                              📲 {cell.confirmed_by.name ?? "Crew"}
                            </a>
                          ) : null}
                          {cell.confirmation_note ? (
                            <p className="italic text-gray-600">
                              “{cell.confirmation_note}”
                            </p>
                          ) : null}
                          <button
                            type="button"
                            onClick={() =>
                              onOpenSupplement({
                                allocationId: cell.allocation_id,
                                stationName: st.name,
                                itemName: it.item_name,
                                unit: it.unit,
                              })
                            }
                            className="mt-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-medium border border-amber-200 hover:bg-amber-200"
                          >
                            + Bổ sung
                          </button>
                        </div>
                      ) : null}
                    </td>
                  );
                })}
                <td className="px-2 py-2">
                  <button
                    type="button"
                    disabled={submittingStation === st.id}
                    onClick={() => void handleSaveStation(st.id)}
                    className="rounded-full bg-blue-700 text-white px-3 py-1.5 text-[11px] font-semibold hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap"
                  >
                    {submittingStation === st.id ? "..." : "💾 Lưu"}
                  </button>
                </td>
              </tr>
            ))}

            {/* Summary rows */}
            <tr className="bg-gray-50 border-t-2 border-gray-300">
              <td className="sticky left-0 bg-gray-50 px-2 py-2 font-semibold text-gray-700 z-10">
                Tổng phân bổ
              </td>
              {view.items.map((it) => (
                <td key={it.item_id} className="px-2 py-2 font-semibold">
                  {itemAllocSum(it.item_id)}
                </td>
              ))}
              <td />
            </tr>
            <tr className="bg-gray-50">
              <td className="sticky left-0 bg-gray-50 px-2 py-2 text-gray-600 z-10">
                Được cấp
              </td>
              {view.items.map((it) => (
                <td key={it.item_id} className="px-2 py-2 text-gray-600">
                  {it.fulfilled_qty ?? 0}
                </td>
              ))}
              <td />
            </tr>
            <tr className="bg-gray-50 border-b-2 border-gray-300">
              <td className="sticky left-0 bg-gray-50 px-2 py-2 text-gray-600 z-10">
                Còn lại
              </td>
              {view.items.map((it) => {
                const remain = (it.fulfilled_qty ?? 0) - itemAllocSum(it.item_id);
                return (
                  <td
                    key={it.item_id}
                    className="px-2 py-2 font-semibold"
                    style={{
                      color: remain < 0 ? "#b91c1c" : "#15803d",
                    }}
                  >
                    {remain}
                  </td>
                );
              })}
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ──────────────────────── Supplement modal ─────────────────────── */

function SupplementModal({
  target,
  onCancel,
  onConfirm,
}: {
  target: {
    allocationId: number;
    stationName: string;
    itemName: string;
    unit: string;
  };
  onCancel: () => void;
  onConfirm: (qty: number, note: string | null) => Promise<void>;
}): React.ReactElement {
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(): Promise<void> {
    const n = Number(qty);
    if (!qty || Number.isNaN(n) || n <= 0) return;
    setBusy(true);
    try {
      await onConfirm(n, note.trim() || null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-base">Bổ sung vật tư</h3>
        <p className="text-xs text-gray-500">
          Cho <strong>{target.stationName}</strong> — vật tư{" "}
          <strong>{target.itemName}</strong>.
        </p>
        <div>
          <label className="block text-xs text-gray-600 mb-1">
            Số lượng ({target.unit}) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step="1"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="input text-sm"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">
            Ghi chú (tùy chọn)
          </label>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            className="textarea text-sm"
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-full border px-3 py-1.5 text-xs font-medium"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={busy || !qty}
            className="rounded-full bg-blue-700 text-white px-3 py-1.5 text-xs font-semibold hover:bg-blue-800 disabled:opacity-50"
          >
            {busy ? "Đang gửi..." : "Gửi bổ sung"}
          </button>
        </div>
      </div>
    </div>
  );
}
