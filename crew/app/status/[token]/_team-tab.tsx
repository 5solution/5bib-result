"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  getLeaderTeam,
  leaderCheckin,
  leaderConfirmCompletion,
  leaderConfirmCompletionBulk,
  type LeaderMemberView,
  type LeaderPortalResponse,
} from "@/lib/leader-api";
import { StatusBadge, deriveStatusKey } from "@/lib/status-style";

/**
 * Leader "Nhóm của tôi" tab — lists every member of the same event and
 * offers per-status action buttons plus a bulk confirm-completion row.
 * Dynamic-imports html5-qrcode on demand so the initial status-page
 * bundle stays small for non-leader TNV.
 */
export function LeaderTeamTab({
  token,
  initial,
}: {
  token: string;
  initial: LeaderPortalResponse | null;
}): React.ReactElement {
  const [portal, setPortal] = useState<LeaderPortalResponse | null>(initial);
  const [err, setErr] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Active QR scan target — when set, renders the fullscreen modal. Only
  // one scan can run at a time across the whole tab.
  const [scanTarget, setScanTarget] = useState<LeaderMemberView | null>(null);

  // Suspicious-confirm modal: ask before confirming completion < 2h after checkin.
  const [suspiciousTarget, setSuspiciousTarget] = useState<
    | {
        member: LeaderMemberView;
        minutes: number;
      }
    | null
  >(null);
  const [suspiciousNote, setSuspiciousNote] = useState("");

  const reload = useCallback(async () => {
    try {
      const next = await getLeaderTeam(token);
      setPortal(next);
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [token]);

  useEffect(() => {
    if (!portal) void reload();
  }, [portal, reload]);

  function markBusy(id: number): () => void {
    setBusyIds((prev) => new Set(prev).add(id));
    return () => {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    };
  }

  function flash(msg: string): void {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }

  async function onManualCheckin(m: LeaderMemberView): Promise<void> {
    const done = markBusy(m.id);
    try {
      await leaderCheckin(token, m.id, "manual");
      flash(`Đã check-in ${m.full_name}`);
      await reload();
    } catch (e) {
      flash(`Lỗi: ${(e as Error).message}`);
    } finally {
      done();
    }
  }

  async function onQrScanned(m: LeaderMemberView, code: string): Promise<void> {
    const done = markBusy(m.id);
    try {
      await leaderCheckin(token, m.id, "qr_scan", code);
      flash(`Đã check-in ${m.full_name}`);
      setScanTarget(null);
      await reload();
    } catch (e) {
      flash(`Lỗi: ${(e as Error).message}`);
    } finally {
      done();
    }
  }

  async function onManualCheckinFromModal(m: LeaderMemberView): Promise<void> {
    setScanTarget(null);
    await onManualCheckin(m);
  }

  async function onConfirmCompletion(
    m: LeaderMemberView,
    note?: string,
  ): Promise<void> {
    const done = markBusy(m.id);
    try {
      const res = await leaderConfirmCompletion(token, m.id, note);
      flash(
        res.suspicious
          ? `Đã xác nhận ${m.full_name} — gắn cờ nghi vấn`
          : `Đã xác nhận hoàn thành ${m.full_name}`,
      );
      await reload();
    } catch (e) {
      flash(`Lỗi: ${(e as Error).message}`);
    } finally {
      done();
    }
  }

  // BR-LDR-05: warn before confirming completion if check-in was less than
  // 2h ago — ask for an optional note and confirm explicitly.
  function requestConfirmCompletion(m: LeaderMemberView): void {
    if (!m.checked_in_at) {
      void onConfirmCompletion(m);
      return;
    }
    const elapsedMs = Date.now() - new Date(m.checked_in_at).getTime();
    const minutes = Math.round(elapsedMs / 60_000);
    if (minutes < 120) {
      setSuspiciousNote("");
      setSuspiciousTarget({ member: m, minutes });
      return;
    }
    void onConfirmCompletion(m);
  }

  const checkedInIds = useMemo(
    () =>
      (portal?.members ?? [])
        .filter((m) => m.status === "checked_in")
        .map((m) => m.id),
    [portal],
  );

  async function onBulkConfirm(): Promise<void> {
    if (checkedInIds.length === 0) return;
    if (!confirm(`Xác nhận hoàn thành cho ${checkedInIds.length} thành viên?`))
      return;
    setBulkBusy(true);
    try {
      const summary = await leaderConfirmCompletionBulk(token, checkedInIds);
      flash(
        `Đã xác nhận ${summary.confirmed}${
          summary.suspicious_count
            ? ` (${summary.suspicious_count} nghi vấn)`
            : ""
        }${summary.skipped ? `, bỏ qua ${summary.skipped}` : ""}`,
      );
      await reload();
    } catch (e) {
      flash(`Lỗi: ${(e as Error).message}`);
    } finally {
      setBulkBusy(false);
    }
  }

  if (err) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
        {err}
      </div>
    );
  }

  if (!portal) {
    return (
      <div className="text-sm text-[color:var(--color-muted)]">
        Đang tải danh sách...
      </div>
    );
  }

  const members = portal.members;

  return (
    <div className="space-y-4">
      {toast ? (
        <div
          role="status"
          className="rounded-lg border bg-[color:var(--color-accent)]/10 p-2 text-sm"
        >
          {toast}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm">
          Tổng <strong>{members.length}</strong> thành viên · Đã check-in{" "}
          <strong>{checkedInIds.length}</strong>
        </p>
        <button
          type="button"
          disabled={checkedInIds.length === 0 || bulkBusy}
          onClick={() => {
            void onBulkConfirm();
          }}
          className="rounded-full border px-3 py-1 text-xs font-medium disabled:opacity-50"
          style={{
            background:
              checkedInIds.length > 0 ? "#1d4ed8" : "#f3f4f6",
            color: checkedInIds.length > 0 ? "#fff" : "#9ca3af",
            borderColor: checkedInIds.length > 0 ? "#1d4ed8" : "#e5e7eb",
          }}
        >
          {bulkBusy
            ? "Đang xử lý..."
            : `Xác nhận hoàn thành tất cả (${checkedInIds.length})`}
        </button>
      </div>

      <ul className="space-y-2">
        {members.map((m) => (
          <MemberRow
            key={m.id}
            member={m}
            busy={busyIds.has(m.id)}
            onManualCheckin={() => void onManualCheckin(m)}
            onStartQrScan={() => setScanTarget(m)}
            onConfirmCompletion={() => requestConfirmCompletion(m)}
          />
        ))}
      </ul>

      {scanTarget ? (
        <QrScannerModal
          member={scanTarget}
          disabled={busyIds.has(scanTarget.id)}
          onClose={() => setScanTarget(null)}
          onRead={(code) => void onQrScanned(scanTarget, code)}
          onManualFallback={() => void onManualCheckinFromModal(scanTarget)}
        />
      ) : null}

      {suspiciousTarget ? (
        <SuspiciousConfirmModal
          member={suspiciousTarget.member}
          minutes={suspiciousTarget.minutes}
          note={suspiciousNote}
          onNoteChange={setSuspiciousNote}
          onCancel={() => setSuspiciousTarget(null)}
          onConfirm={() => {
            const target = suspiciousTarget;
            setSuspiciousTarget(null);
            void onConfirmCompletion(target.member, suspiciousNote || undefined);
          }}
        />
      ) : null}
    </div>
  );
}

function MemberRow({
  member,
  busy,
  onManualCheckin,
  onStartQrScan,
  onConfirmCompletion,
}: {
  member: LeaderMemberView;
  busy: boolean;
  onManualCheckin: () => void;
  onStartQrScan: () => void;
  onConfirmCompletion: () => void;
}): React.ReactElement {
  const statusKey = deriveStatusKey(member);
  const isSuspicious = member.suspicious_checkin;
  const rowStyle: React.CSSProperties = {
    background: isSuspicious ? "#fef2f2" : "#ffffff",
    borderColor: isSuspicious ? "#fca5a5" : "#e5e7eb",
  };

  return (
    <li
      className="rounded-lg border p-3 space-y-2"
      style={rowStyle}
    >
      <div className="flex items-center gap-3">
        {member.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={member.avatar_url}
            alt=""
            className="size-10 rounded-full object-cover border"
          />
        ) : (
          <div className="size-10 rounded-full bg-gray-100 border" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-medium truncate">{member.full_name}</p>
            {isSuspicious ? (
              <span
                aria-label="Nghi vấn"
                title="Check-in đáng ngờ"
                className="inline-block size-1.5 rounded-full bg-red-600"
              />
            ) : null}
          </div>
          <p className="text-xs text-[color:var(--color-muted)] truncate">
            {member.role_name} · {member.phone}
          </p>
        </div>
        <StatusBadge status={statusKey} />
      </div>

      {member.id_card_url ? (
        <details className="text-xs">
          <summary className="cursor-pointer text-[color:var(--color-muted)]">
            Xem CCCD
          </summary>
          <a
            href={member.id_card_url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={member.id_card_url}
              alt={`CCCD của ${member.full_name}`}
              className="mt-1 h-32 rounded border object-contain"
            />
          </a>
        </details>
      ) : null}

      {/* Per-status action buttons — both always visible when qr_sent so the
          manual fallback is clickable even while QR scanner is open. */}
      {member.status === "qr_sent" ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onStartQrScan}
            className="rounded-full border px-3 py-1 text-xs font-medium bg-[color:var(--color-accent)] text-white disabled:opacity-50"
          >
            📲 Quét QR
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onManualCheckin}
            className="rounded-full border px-3 py-1 text-xs font-medium bg-white disabled:opacity-50"
          >
            ✋ Check-in thủ công
          </button>
        </div>
      ) : null}

      {member.status === "checked_in" ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onConfirmCompletion}
            className="rounded-full border px-3 py-1 text-xs font-medium bg-[color:var(--color-accent)] text-white disabled:opacity-50"
          >
            ✅ Xác nhận hoàn thành
          </button>
        </div>
      ) : null}

      {member.status === "completed" ? (
        <p className="text-xs text-[color:var(--color-muted)]">
          Đã hoàn thành
          {member.checked_in_at
            ? ` · check-in ${new Date(member.checked_in_at).toLocaleTimeString(
                "vi-VN",
              )}`
            : ""}
        </p>
      ) : null}
    </li>
  );
}

interface Html5QrcodeModule {
  Html5Qrcode: new (elementId: string) => {
    start: (
      camera: { facingMode: string },
      config: { fps: number; qrbox: { width: number; height: number } },
      onDecode: (text: string) => void,
      onError?: (msg: string) => void,
    ) => Promise<void>;
    stop: () => Promise<void>;
    clear: () => void;
  };
}

/**
 * Fullscreen QR scanner modal. Camera takes the whole viewport on mobile
 * so aiming is easy; bottom action bar exposes "Huỷ" + "Check-in thủ công"
 * so the leader never gets stuck behind the scanner if the camera fails
 * or the QR is unreadable. Lazily imports html5-qrcode — falls back to a
 * paste box when camera permission is denied or the lib fails to load.
 */
function QrScannerModal({
  member,
  disabled,
  onClose,
  onRead,
  onManualFallback,
}: {
  member: LeaderMemberView;
  disabled: boolean;
  onClose: () => void;
  onRead: (code: string) => void;
  onManualFallback: () => void;
}): React.ReactElement {
  const elementId = useRef(
    `qr-${Math.random().toString(36).slice(2, 9)}`,
  ).current;
  const [supported, setSupported] = useState<boolean | null>(null);
  const [pasted, setPasted] = useState("");

  useEffect(() => {
    let stopped = false;
    let instance: InstanceType<Html5QrcodeModule["Html5Qrcode"]> | null = null;
    (async () => {
      try {
        const mod = (await import("html5-qrcode")) as unknown as Html5QrcodeModule;
        if (stopped) return;
        instance = new mod.Html5Qrcode(elementId);
        await instance.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 280, height: 280 } },
          (decoded) => {
            if (stopped) return;
            stopped = true;
            instance?.stop().catch(() => undefined);
            onRead(extractToken(decoded));
          },
        );
        setSupported(true);
      } catch {
        setSupported(false);
      }
    })();
    return () => {
      stopped = true;
      instance?.stop().catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
    >
      {/* Top bar: member name + close */}
      <div className="flex items-center justify-between gap-3 bg-black/80 px-4 py-3 text-white">
        <div className="min-w-0">
          <p className="text-xs opacity-70">Đang check-in</p>
          <p className="truncate text-sm font-medium">{member.full_name}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="grid size-10 place-items-center rounded-full bg-white/15 text-xl leading-none hover:bg-white/25"
        >
          ✕
        </button>
      </div>

      {/* Camera area — fills remaining vertical space. Paste fallback if camera unavailable. */}
      <div className="flex-1 relative overflow-hidden">
        {supported === false ? (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-sm space-y-3 rounded-lg bg-white p-4">
              <p className="text-sm font-medium">Không bật được camera</p>
              <p className="text-xs text-gray-600">
                Dán link QR hoặc mã token từ trang check-in của TNV:
              </p>
              <input
                type="text"
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                placeholder="https://crew.5bib.com/checkin/<token>"
                className="w-full rounded border px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                disabled={disabled || pasted.trim().length === 0}
                onClick={() => onRead(extractToken(pasted))}
                className="w-full rounded-full px-3 py-2 text-sm font-medium bg-[color:var(--color-accent)] text-white disabled:opacity-50"
              >
                Xác nhận token
              </button>
            </div>
          </div>
        ) : (
          <>
            <div id={elementId} className="absolute inset-0 [&_video]:object-cover [&_video]:w-full [&_video]:h-full" />
            {/* Aiming guide overlay */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="size-64 rounded-lg border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
            <p className="absolute bottom-4 left-0 right-0 text-center text-xs text-white/80">
              Đưa mã QR vào khung vuông
            </p>
          </>
        )}
      </div>

      {/* Bottom action bar — manual fallback always clickable. */}
      <div className="bg-black/80 p-3 safe-bottom">
        <div className="mx-auto flex max-w-md gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-white/30 px-4 py-2 text-sm text-white"
          >
            Huỷ
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={onManualFallback}
            className="flex-1 rounded-full px-4 py-2 text-sm font-medium bg-white text-gray-900 disabled:opacity-50"
          >
            ✋ Check-in thủ công
          </button>
        </div>
      </div>
    </div>
  );
}

function extractToken(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const parts = url.pathname.split("/").filter(Boolean);
      return parts[parts.length - 1] ?? trimmed;
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

function SuspiciousConfirmModal({
  member,
  minutes,
  note,
  onNoteChange,
  onCancel,
  onConfirm,
}: {
  member: LeaderMemberView;
  minutes: number;
  note: string;
  onNoteChange: (s: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}): React.ReactElement | null {
  // Portal to document.body so any `transform`/`filter` on ancestors
  // (Tabs panel, etc.) can't hijack the `fixed` positioning — mobile
  // users were seeing the dialog render at the top of the page because
  // the containing block shifted when an ancestor had `transform`.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 overscroll-contain"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-base">Xác nhận hoàn thành sớm?</h3>
        <p className="text-sm">
          <strong>{member.full_name}</strong> mới check-in <strong>{minutes} phút</strong>{" "}
          trước. Bạn có chắc chắn muốn xác nhận hoàn thành?
        </p>
        <label className="block text-xs text-[color:var(--color-muted)]">
          Ghi chú (tuỳ chọn)
          <textarea
            rows={2}
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            maxLength={500}
            className="mt-1 w-full rounded border px-2 py-1 text-sm"
            placeholder="VD: đổi ca sớm, đi khách VIP..."
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border px-3 py-1 text-xs"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full border px-3 py-1 text-xs font-medium bg-[color:var(--color-accent)] text-white"
          >
            Xác nhận vẫn tiếp tục
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
