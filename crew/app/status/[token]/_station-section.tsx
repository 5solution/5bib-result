"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AssignmentMemberBrief,
  MyStationView,
  StationStatus,
} from "@/lib/station-api";
import type { LeaderSupplyView } from "@/lib/supply-api";
import { confirmSupply, confirmSupplement } from "@/lib/supply-api";

/**
 * v1.6 — "Vị trí & nhiệm vụ" section shown inside the Personal tab.
 *
 * Renders:
 *   1. Assigned station card (name, location, status badge, Google Maps link)
 *   2. "Crew phụ trách" list (if any) — click-to-call phone links
 *   3. "Đồng đội" list (other TNV/Crew on the same station, excluding self)
 *   4. For assignment_role === 'crew': supply confirmation UI pulled from the
 *      leader supply view when the caller is also a leader of the role.
 *
 * Gracefully degrades: null station → friendly empty state. No leader data →
 * no supply section rendered (pure crew without leader token cannot GET their
 * allocations through the current public API surface).
 */
export function StationSection({
  token,
  myStation,
  leaderSupply,
  roleName,
}: {
  token: string;
  myStation: MyStationView | null;
  leaderSupply: LeaderSupplyView | null;
  roleName: string;
}): React.ReactElement {
  if (myStation == null) {
    return (
      <section className="card space-y-2">
        <h2 className="font-semibold flex items-center gap-2">
          <span aria-hidden>📍</span>
          <span>Vị trí & nhiệm vụ</span>
        </h2>
        <p className="text-sm text-[color:var(--color-muted)]">
          Không tải được thông tin trạm. Vui lòng thử lại sau.
        </p>
      </section>
    );
  }

  const { station, my_is_supervisor, supervisor_list, teammate_list } =
    myStation;
  const isSupervisor = my_is_supervisor === true;

  return (
    <section className="card space-y-4">
      <div>
        <h2 className="font-semibold flex items-center gap-2">
          <span aria-hidden>📍</span>
          <span>Vị trí & nhiệm vụ</span>
        </h2>
        {roleName ? (
          <p
            className="mt-1 text-xs"
            style={{ color: "var(--5bib-text-muted)" }}
          >
            Role: <strong>{roleName}</strong>
            {my_is_supervisor != null ? (
              <>
                {" "}· Vai trò tại trạm:{" "}
                <strong>
                  {isSupervisor ? "Supervisor (👑)" : "Worker (👤)"}
                </strong>
              </>
            ) : null}
          </p>
        ) : null}
      </div>

      {station == null ? (
        <div
          className="rounded-lg border p-3 text-sm"
          style={{ background: "#fffbeb", borderColor: "#fcd34d", color: "#92400e" }}
        >
          <p className="font-medium">⏳ Bạn chưa được phân công trạm.</p>
          <p className="mt-0.5 text-xs">
            Admin sẽ cập nhật trước ngày vận hành.
          </p>
        </div>
      ) : (
        <>
          {/* v1.8 — Team badge on top of station card */}
          {station.category_name ? (
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                style={{
                  background: station.category_color ?? "#e5e7eb",
                  color: "#ffffff",
                }}
              >
                <span aria-hidden>🏷️</span>
                <span>Team {station.category_name}</span>
              </span>
            </div>
          ) : null}

          <StationCard station={station} />

          {supervisor_list.length > 0 ? (
            <MemberList
              title="👑 Supervisor"
              members={supervisor_list}
              emphasize
            />
          ) : null}

          {teammate_list.length > 0 ? (
            <MemberList title="👥 Đồng đội" members={teammate_list} />
          ) : null}

          {isSupervisor ? (
            <CrewSupplyBlock
              token={token}
              stationId={station.id}
              leaderSupply={leaderSupply}
            />
          ) : null}
        </>
      )}
    </section>
  );
}

/* ────────────────────────── Station card ───────────────────────── */

function StationCard({
  station,
}: {
  station: NonNullable<MyStationView["station"]>;
}): React.ReactElement {
  return (
    <article
      className="rounded-xl border p-3 space-y-1.5"
      style={{ background: "#f9fafb", borderColor: "#e5e7eb" }}
    >
      <p className="text-sm font-semibold flex items-center gap-1.5">
        <span aria-hidden>📌</span>
        <span>{station.station_name}</span>
      </p>
      {station.location_description ? (
        <p className="text-sm text-gray-700">{station.location_description}</p>
      ) : null}
      <div className="flex items-center gap-2 flex-wrap">
        <StationStatusBadge status={station.status} />
        {station.google_maps_url ? (
          <a
            href={station.google_maps_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium rounded-full border px-2.5 py-1 hover:bg-white"
            style={{ borderColor: "#bfdbfe", color: "#1d4ed8", background: "#eff6ff" }}
            aria-label={`Mở ${station.station_name} trên Google Maps`}
          >
            <span aria-hidden>📍</span>
            <span>Xem trên Google Maps</span>
            <span aria-hidden>→</span>
          </a>
        ) : null}
      </div>
    </article>
  );
}

function StationStatusBadge({
  status,
}: {
  status: StationStatus;
}): React.ReactElement {
  const cfg: Record<
    StationStatus,
    { label: string; bg: string; color: string; dot: string; pulse: boolean }
  > = {
    setup: {
      label: "Đang chuẩn bị",
      bg: "#f3f4f6",
      color: "#4b5563",
      dot: "#9ca3af",
      pulse: false,
    },
    active: {
      label: "Đang hoạt động",
      bg: "#dcfce7",
      color: "#15803d",
      dot: "#16a34a",
      pulse: true,
    },
    closed: {
      label: "Đã đóng",
      bg: "#1f2937",
      color: "#f9fafb",
      dot: "#6b7280",
      pulse: false,
    },
  };
  const c = cfg[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: c.bg, color: c.color }}
    >
      <span
        aria-hidden
        className={`inline-block size-1.5 rounded-full ${c.pulse ? "animate-pulse" : ""}`}
        style={{ background: c.dot }}
      />
      <span>{c.label}</span>
    </span>
  );
}

/* ────────────────────────── Member lists ───────────────────────── */

function MemberList({
  title,
  members,
  emphasize,
}: {
  title: string;
  members: AssignmentMemberBrief[];
  emphasize?: boolean;
}): React.ReactElement {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
        {title}
      </h3>
      <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden">
        {members.map((m) => (
          <MemberRow key={m.assignment_id} member={m} emphasize={emphasize} />
        ))}
      </ul>
    </div>
  );
}

function MemberRow({
  member,
  emphasize,
}: {
  member: AssignmentMemberBrief;
  emphasize?: boolean;
}): React.ReactElement {
  return (
    <li
      className="flex items-center gap-3 px-3 py-2.5"
      style={{ background: emphasize ? "#fffbeb" : "#ffffff" }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900 truncate">
          {member.is_supervisor ? (
            <span
              className="text-amber-500 mr-1"
              aria-label="Supervisor"
              title="Supervisor (leader role)"
            >
              👑
            </span>
          ) : null}
          {member.full_name}
        </p>
        <p className="text-xs text-gray-500">
          {member.role_name ? (
            <span className="italic">{member.role_name}</span>
          ) : null}
          {member.duty ? (
            <>
              {member.role_name ? " · " : ""}
              <span className="italic">🎯 {member.duty}</span>
            </>
          ) : null}
          {member.note ? ` · ${member.note}` : ""}
        </p>
      </div>
      <PhoneLink name={member.full_name} phone={member.phone} />
    </li>
  );
}

/* ────────────────────────── Phone link ─────────────────────────── */

function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^\d]/g, "");
  return hasPlus ? `+${digits}` : digits;
}

function PhoneLink({
  name,
  phone,
}: {
  name: string;
  phone: string;
}): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const normalized = normalizePhone(phone);

  const onCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard writes can fail on iOS old / insecure origin — ignore silently
    }
  };

  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <a
        href={`tel:${normalized}`}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-blue-700 transition-opacity hover:opacity-90"
        style={{ minHeight: 44 }}
        aria-label={`Gọi ${name} số ${phone}`}
      >
        <span aria-hidden>📲</span>
        <span>Gọi</span>
      </a>
      <button
        type="button"
        onClick={onCopy}
        className="px-2 py-2 rounded-lg text-xs font-medium border text-gray-600 bg-white transition-colors hover:bg-gray-50"
        style={{ minHeight: 44, borderColor: "#e5e7eb" }}
        aria-label="Copy số điện thoại"
        title={copied ? "Đã copy" : "Copy số"}
      >
        {copied ? "✓" : "📋"}
      </button>
    </div>
  );
}

/* ────────────────────── Crew supply block ──────────────────────── */

interface StationAllocationRow {
  allocation_id: number;
  item_id: number;
  item_name: string;
  unit: string;
  allocated_qty: number;
  confirmed_qty: number | null;
  shortage_qty: number | null;
  is_locked: boolean;
  confirmed_at: string | null;
  confirmation_note: string | null;
  supplements: Array<{
    id: number;
    round_number: number;
    qty: number;
    unit: string;
    note: string | null;
    confirmed_qty: number | null;
    confirmed_at: string | null;
    item_name: string;
  }>;
}

/**
 * Flatten the leader supply tree down to rows that belong to `stationId`.
 * Returns null when leaderSupply is null (caller is a pure crew without leader
 * rights) — component renders a graceful "contact leader" state in that case.
 */
function extractStationRows(
  leaderSupply: LeaderSupplyView | null,
  stationId: number,
): StationAllocationRow[] | null {
  if (leaderSupply == null) return null;
  const rows: StationAllocationRow[] = [];
  for (const item of leaderSupply.items) {
    const match = item.stations.find((s) => s.station_id === stationId);
    if (!match) continue;
    rows.push({
      allocation_id: match.allocation_id,
      item_id: item.item_id,
      item_name: item.item_name,
      unit: item.unit,
      allocated_qty: match.allocated_qty,
      confirmed_qty: match.confirmed_qty,
      shortage_qty: match.shortage_qty,
      is_locked: match.is_locked,
      confirmed_at: match.confirmed_at,
      confirmation_note: match.confirmation_note,
      supplements: match.supplements.map((s) => ({
        id: s.id,
        round_number: s.round_number,
        qty: s.qty,
        unit: item.unit,
        note: s.note,
        confirmed_qty: s.confirmed_qty,
        confirmed_at: s.confirmed_at,
        item_name: item.item_name,
      })),
    });
  }
  return rows;
}

function CrewSupplyBlock({
  token,
  stationId,
  leaderSupply,
}: {
  token: string;
  stationId: number;
  leaderSupply: LeaderSupplyView | null;
}): React.ReactElement {
  const router = useRouter();
  const initialRows = useMemo(
    () => extractStationRows(leaderSupply, stationId),
    [leaderSupply, stationId],
  );

  const [rows, setRows] = useState<StationAllocationRow[] | null>(initialRows);
  const [confirmInputs, setConfirmInputs] = useState<Record<number, string>>(
    () => {
      const init: Record<number, string> = {};
      for (const r of initialRows ?? []) {
        if (!r.is_locked) init[r.item_id] = String(r.allocated_qty);
      }
      return init;
    },
  );
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [supplementInputs, setSupplementInputs] = useState<
    Record<number, string>
  >({});
  const [busySupplementIds, setBusySupplementIds] = useState<Set<number>>(
    new Set(),
  );
  const [toast, setToast] = useState<
    { type: "success" | "error"; text: string } | null
  >(null);

  function flash(type: "success" | "error", text: string): void {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 2500);
  }

  if (rows == null) {
    return (
      <div
        className="rounded-lg border p-3 text-sm space-y-1"
        style={{ background: "#f9fafb", borderColor: "#e5e7eb" }}
      >
        <p className="font-semibold flex items-center gap-1.5">
          <span aria-hidden>📦</span>
          <span>Vật tư trạm của bạn</span>
        </p>
        <p className="text-xs text-gray-600">
          Liên hệ leader của role để biết kế hoạch vật tư. Bạn có thể xác nhận
          sau khi nhận vật tư tại trạm.
        </p>
      </div>
    );
  }

  const unlockedRows = rows.filter((r) => !r.is_locked);
  const allInputsFilled = unlockedRows.every((r) => {
    const v = confirmInputs[r.item_id];
    return v != null && v.trim() !== "" && !Number.isNaN(Number(v));
  });

  async function handleConfirm(): Promise<void> {
    if (unlockedRows.length === 0) return;
    if (!allInputsFilled) {
      flash("error", "Vui lòng nhập số lượng nhận cho tất cả vật tư.");
      return;
    }
    setSubmitting(true);
    try {
      const receipts = unlockedRows.map((r) => ({
        item_id: r.item_id,
        confirmed_qty: Number(confirmInputs[r.item_id] ?? 0),
      }));
      const updated = await confirmSupply(token, {
        receipts,
        note: note.trim() || null,
      });
      // Merge updates back into rows by allocation_id
      setRows((prev) =>
        prev
          ? prev.map((row) => {
              const u = updated.find((x) => x.id === row.allocation_id);
              if (!u) return row;
              return {
                ...row,
                allocated_qty: u.allocated_qty,
                confirmed_qty: u.confirmed_qty,
                shortage_qty: u.shortage_qty,
                is_locked: u.is_locked,
                confirmed_at: u.confirmed_at,
                confirmation_note: u.confirmation_note,
              };
            })
          : prev,
      );
      flash("success", "Đã xác nhận nhận vật tư tại trạm.");
      setTimeout(() => router.refresh(), 600);
    } catch (e) {
      flash("error", (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmSupplement(
    supplementId: number,
  ): Promise<void> {
    const raw = supplementInputs[supplementId];
    const qty = Number(raw);
    if (!raw || Number.isNaN(qty) || qty < 0) {
      flash("error", "Nhập số lượng hợp lệ.");
      return;
    }
    setBusySupplementIds((prev) => new Set(prev).add(supplementId));
    try {
      await confirmSupplement(token, {
        supplement_id: supplementId,
        confirmed_qty: qty,
      });
      setRows((prev) =>
        prev
          ? prev.map((row) => ({
              ...row,
              supplements: row.supplements.map((s) =>
                s.id === supplementId
                  ? {
                      ...s,
                      confirmed_qty: qty,
                      confirmed_at: new Date().toISOString(),
                    }
                  : s,
              ),
            }))
          : prev,
      );
      flash("success", "Đã xác nhận đợt bổ sung.");
      setTimeout(() => router.refresh(), 600);
    } catch (e) {
      flash("error", (e as Error).message);
    } finally {
      setBusySupplementIds((prev) => {
        const next = new Set(prev);
        next.delete(supplementId);
        return next;
      });
    }
  }

  const hasSupplements = rows.some((r) => r.supplements.length > 0);

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
        📦 Vật tư trạm của bạn
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

      {rows.length === 0 ? (
        <p className="text-xs text-gray-500">
          Trạm của bạn chưa có phân bổ vật tư nào.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden">
          {rows.map((row) => (
            <li key={row.allocation_id} className="px-3 py-3 bg-white space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {row.item_name}
                </p>
                <p className="text-xs text-gray-500 whitespace-nowrap">
                  Kế hoạch: <strong>{row.allocated_qty}</strong> {row.unit}
                </p>
              </div>
              {row.is_locked ? (
                <div
                  className="rounded-md p-2 text-xs flex flex-wrap gap-2"
                  style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}
                >
                  <span className="text-green-800 font-medium">
                    ✅ Đã xác nhận: <strong>{row.confirmed_qty ?? 0}</strong>{" "}
                    {row.unit}
                  </span>
                  {row.shortage_qty != null && row.shortage_qty > 0 ? (
                    <span className="text-amber-700">
                      Thiếu: {row.shortage_qty} {row.unit}
                    </span>
                  ) : null}
                  {row.confirmed_at ? (
                    <span className="text-gray-600">
                      {new Date(row.confirmed_at).toLocaleString("vi-VN")}
                    </span>
                  ) : null}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600">Đã nhận:</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step="1"
                    className="input w-24 text-sm"
                    value={confirmInputs[row.item_id] ?? ""}
                    onChange={(e) =>
                      setConfirmInputs((prev) => ({
                        ...prev,
                        [row.item_id]: e.target.value,
                      }))
                    }
                  />
                  <span className="text-xs text-gray-500">{row.unit}</span>
                </div>
              )}
              {row.is_locked && row.confirmation_note ? (
                <p className="text-xs text-gray-500 italic">
                  Ghi chú: {row.confirmation_note}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {unlockedRows.length > 0 ? (
        <>
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              Ghi chú (tùy chọn)
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              className="textarea text-sm"
              placeholder="VD: thiếu 5 chai nước so với kế hoạch..."
            />
          </div>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={submitting || !allInputsFilled}
            className="w-full rounded-xl bg-blue-700 py-3 text-sm font-bold text-white hover:bg-blue-800 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting
              ? "Đang gửi..."
              : "✅ Xác nhận đã nhận vật tư tại trạm"}
          </button>
        </>
      ) : rows.length > 0 ? (
        <p className="text-xs text-gray-500 italic">
          Bạn đã xác nhận tất cả vật tư. Nếu cần sửa, liên hệ admin để unlock.
        </p>
      ) : null}

      {hasSupplements ? (
        <div className="space-y-2 pt-1">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
            🔁 Lịch sử bổ sung
          </h4>
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden">
            {rows.flatMap((row) =>
              row.supplements.map((s) => (
                <li key={s.id} className="px-3 py-2 bg-white text-xs space-y-1">
                  <p className="font-semibold text-gray-900">
                    {s.item_name} — Đợt {s.round_number}
                  </p>
                  <p className="text-gray-600">
                    Leader gửi: <strong>{s.qty}</strong> {s.unit}
                    {s.note ? ` · ${s.note}` : ""}
                  </p>
                  {s.confirmed_qty != null ? (
                    <p className="text-green-700">
                      ✅ Đã xác nhận: <strong>{s.confirmed_qty}</strong>{" "}
                      {s.unit}
                      {s.confirmed_at
                        ? ` · ${new Date(s.confirmed_at).toLocaleString("vi-VN")}`
                        : ""}
                    </p>
                  ) : (
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step="1"
                        className="input w-20 text-xs"
                        value={supplementInputs[s.id] ?? ""}
                        onChange={(e) =>
                          setSupplementInputs((prev) => ({
                            ...prev,
                            [s.id]: e.target.value,
                          }))
                        }
                        placeholder="SL"
                      />
                      <button
                        type="button"
                        disabled={busySupplementIds.has(s.id)}
                        onClick={() => void handleConfirmSupplement(s.id)}
                        className="rounded-full bg-blue-700 text-white px-3 py-1.5 font-semibold hover:opacity-90 disabled:opacity-50"
                      >
                        {busySupplementIds.has(s.id)
                          ? "..."
                          : "Xác nhận nhận"}
                      </button>
                    </div>
                  )}
                </li>
              )),
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
