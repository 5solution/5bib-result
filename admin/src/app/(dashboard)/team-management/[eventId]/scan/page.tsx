"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  lookupRegistrations,
  staffCheckinScan,
  type CheckinLookupResult,
  type StaffCheckinScanResponse,
} from "@/lib/team-api";
import type { Html5Qrcode } from "html5-qrcode";

type ScanStatus =
  | { kind: "idle" }
  | { kind: "success"; data: StaffCheckinScanResponse }
  | { kind: "duplicate"; message: string }
  | { kind: "not_approved"; message: string }
  | { kind: "invalid"; message: string };

interface SessionLogEntry {
  ts: number;
  full_name: string;
  role_name: string;
  checked_in_at: string;
}

const SCANNER_ELEMENT_ID = "qr-scanner-region";
const RESUME_AFTER_MS = 2000;

/**
 * Accept both a full URL ("https://.../checkin/<token>") and a raw token.
 */
function extractToken(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const segments = url.pathname.split("/").filter(Boolean);
      return segments[segments.length - 1] ?? trimmed;
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

function classifyError(message: string): ScanStatus {
  const lower = message.toLowerCase();
  if (lower.includes("already checked in")) {
    return { kind: "duplicate", message };
  }
  if (
    lower.includes("not found") ||
    lower.includes("different event") ||
    lower.includes("token")
  ) {
    return { kind: "invalid", message };
  }
  if (lower.includes("status")) {
    return { kind: "not_approved", message };
  }
  return { kind: "invalid", message };
}

export default function ScanPage(): React.ReactElement {
  const router = useRouter();
  const params = useParams<{ eventId: string }>();
  const eventId = Number(params.eventId);
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();

  const [cameraOn, setCameraOn] = useState(false);
  const [status, setStatus] = useState<ScanStatus>({ kind: "idle" });
  const [searchInput, setSearchInput] = useState("");
  const [lookupResults, setLookupResults] = useState<CheckinLookupResult[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState("");
  const [checkingInId, setCheckingInId] = useState<number | null>(null);
  const [sessionLog, setSessionLog] = useState<SessionLogEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/sign-in");
  }, [authLoading, isAuthenticated, router]);

  const handleResult = useCallback(
    async (scanned: string) => {
      if (!token) return;
      const normalized = extractToken(scanned);
      if (!normalized) return;
      setSubmitting(true);
      try {
        const data = await staffCheckinScan(token, normalized, eventId);
        setStatus({ kind: "success", data });
        setSessionLog((prev) =>
          [
            {
              ts: Date.now(),
              full_name: data.full_name,
              role_name: data.role_name,
              checked_in_at: data.checked_in_at,
            },
            ...prev,
          ].slice(0, 10),
        );
      } catch (err) {
        setStatus(classifyError((err as Error).message));
      } finally {
        setSubmitting(false);
      }
    },
    [token, eventId],
  );

  // Camera scanner lifecycle
  useEffect(() => {
    let cancelled = false;
    if (!cameraOn) return;

    setCameraError(null);

    void (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (decodedText) => {
            if (isProcessingRef.current) return;
            isProcessingRef.current = true;
            void (async () => {
              await handleResult(decodedText);
              setTimeout(() => {
                isProcessingRef.current = false;
              }, RESUME_AFTER_MS);
            })();
          },
          () => {
            // per-frame decode failures are noisy — ignore
          },
        );
      } catch (err) {
        if (!cancelled) {
          setCameraError(
            (err as Error).message ||
              "Không thể truy cập camera. Kiểm tra quyền truy cập camera.",
          );
          setCameraOn(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      if (scanner) {
        void (async () => {
          try {
            if (scanner.isScanning) {
              await scanner.stop();
            }
            scanner.clear();
          } catch {
            // ignore — happens when stopping before start completes
          }
        })();
        scannerRef.current = null;
      }
      isProcessingRef.current = false;
    };
  }, [cameraOn, handleResult]);

  // Debounced lookup for the search-by-name/phone/CCCD fallback.
  useEffect(() => {
    if (!token) return;
    const trimmed = searchInput.trim();
    if (trimmed.length < 2) {
      setLookupResults([]);
      setLookupError(null);
      setLookupLoading(false);
      setLastQuery("");
      return;
    }
    const handle = setTimeout(() => {
      let cancelled = false;
      setLookupLoading(true);
      setLookupError(null);
      void (async () => {
        try {
          const rows = await lookupRegistrations(token, trimmed, eventId);
          if (cancelled) return;
          setLookupResults(rows);
          setLastQuery(trimmed);
        } catch (err) {
          if (cancelled) return;
          setLookupError((err as Error).message);
          setLookupResults([]);
        } finally {
          if (!cancelled) setLookupLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput, eventId, token]);

  async function refreshLookup(): Promise<void> {
    if (!token) return;
    const trimmed = searchInput.trim();
    if (trimmed.length < 2) return;
    try {
      const rows = await lookupRegistrations(token, trimmed, eventId);
      setLookupResults(rows);
      setLastQuery(trimmed);
    } catch {
      // ignore — banner already shows the scan result
    }
  }

  async function onCheckinRow(row: CheckinLookupResult): Promise<void> {
    if (!token || checkingInId != null) return;
    setCheckingInId(row.id);
    setSubmitting(true);
    try {
      const data = await staffCheckinScan(token, row.qr_code, eventId);
      setStatus({ kind: "success", data });
      setSessionLog((prev) =>
        [
          {
            ts: Date.now(),
            full_name: data.full_name,
            role_name: data.role_name,
            checked_in_at: data.checked_in_at,
          },
          ...prev,
        ].slice(0, 10),
      );
      await refreshLookup();
    } catch (err) {
      setStatus(classifyError((err as Error).message));
      // Duplicate / not-approved still mean the row state may have changed
      // upstream (another staff member checked in), so refresh.
      await refreshLookup();
    } finally {
      setSubmitting(false);
      setCheckingInId(null);
    }
  }

  if (authLoading || !isAuthenticated) {
    return (
      <div className="text-sm text-muted-foreground">Đang tải…</div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-gradient">Scan QR check-in</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Nhân sự race-day quét QR của TNV để check-in. Camera không tự bật —
          bấm nút để bật khi bắt đầu ca.
        </p>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Camera</span>
          <Button
            size="sm"
            variant={cameraOn ? "destructive" : "default"}
            onClick={() => setCameraOn((v) => !v)}
          >
            {cameraOn ? "Tắt camera" : "Bật camera"}
          </Button>
        </div>
        <div
          id={SCANNER_ELEMENT_ID}
          className="w-full min-h-[240px] rounded-md overflow-hidden bg-black/5"
        />
        {!cameraOn ? (
          <p className="text-xs text-muted-foreground">
            Camera đang tắt. Bấm &quot;Bật camera&quot; để bắt đầu quét.
          </p>
        ) : null}
        {cameraError ? (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-500">
            {cameraError}
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Tra cứu thủ công</h2>
          <p className="text-xs text-muted-foreground">
            Dùng khi QR không quét được. Tìm trong danh sách đã duyệt theo
            tên / SĐT / CCCD.
          </p>
        </div>
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Tìm theo tên / SĐT / CCCD (gõ 2 ký tự trở lên)"
          autoComplete="off"
          aria-label="Tra cứu TNV"
        />
        <LookupResults
          query={searchInput.trim()}
          lastQuery={lastQuery}
          loading={lookupLoading}
          error={lookupError}
          results={lookupResults}
          checkingInId={checkingInId}
          disabled={submitting}
          onCheckin={(row) => void onCheckinRow(row)}
        />
      </div>

      <ResultBanner status={status} />

      <div className="rounded-lg border p-4">
        <h2 className="text-sm font-semibold mb-2">
          Phiên làm việc · {sessionLog.length} lượt check-in thành công
        </h2>
        {sessionLog.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Chưa có check-in nào trong phiên này.
          </p>
        ) : (
          <ul className="divide-y">
            {sessionLog.map((entry) => (
              <li
                key={entry.ts}
                className="flex items-center justify-between py-1.5 text-sm"
              >
                <span className="font-medium">{entry.full_name}</span>
                <span className="text-muted-foreground text-xs">
                  {entry.role_name} ·{" "}
                  {new Date(entry.checked_in_at).toLocaleTimeString("vi-VN")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ResultBanner({ status }: { status: ScanStatus }): React.ReactElement | null {
  if (status.kind === "idle") return null;
  if (status.kind === "success") {
    const d = status.data;
    return (
      <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-4">
        <div className="text-sm font-bold text-green-700 dark:text-green-400">
          ✅ Check-in thành công
        </div>
        <div className="mt-1 text-base font-semibold">{d.full_name}</div>
        <div className="text-xs text-muted-foreground">
          {d.role_name} · {new Date(d.checked_in_at).toLocaleString("vi-VN")}
        </div>
      </div>
    );
  }
  if (status.kind === "duplicate") {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
        <div className="text-sm font-bold text-amber-700 dark:text-amber-400">
          ⚠️ Đã check-in trước đó
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {status.message}
        </div>
      </div>
    );
  }
  if (status.kind === "not_approved") {
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4">
        <div className="text-sm font-bold text-red-700 dark:text-red-400">
          ❌ Không đủ điều kiện check-in
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {status.message}
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4">
      <div className="text-sm font-bold text-red-700 dark:text-red-400">
        ❌ QR không hợp lệ
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{status.message}</div>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const last = parts[parts.length - 1] ?? "";
  const first = parts[0] ?? "";
  return ((last[0] ?? "") + (first[0] ?? "")).toUpperCase();
}

interface LookupResultsProps {
  query: string;
  lastQuery: string;
  loading: boolean;
  error: string | null;
  results: CheckinLookupResult[];
  checkingInId: number | null;
  disabled: boolean;
  onCheckin: (row: CheckinLookupResult) => void;
}

function LookupResults(props: LookupResultsProps): React.ReactElement | null {
  const {
    query,
    lastQuery,
    loading,
    error,
    results,
    checkingInId,
    disabled,
    onCheckin,
  } = props;

  if (query.length < 2) {
    return (
      <p className="text-xs text-muted-foreground">
        Gõ ít nhất 2 ký tự để tìm. Ví dụ: tên, 4 số cuối CCCD, hoặc số điện
        thoại.
      </p>
    );
  }
  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-md border p-2 animate-pulse"
          >
            <div className="h-10 w-10 rounded-full bg-muted" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-1/3 rounded bg-muted" />
              <div className="h-2.5 w-1/2 rounded bg-muted/70" />
            </div>
            <div className="h-8 w-20 rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-500">
        {error}
      </div>
    );
  }
  if (results.length === 0 && lastQuery.length >= 2) {
    return (
      <p className="text-xs text-muted-foreground">
        Không tìm thấy. Thử tên / 4 số cuối CCCD.
      </p>
    );
  }
  if (results.length === 0) return null;

  return (
    <ul className="divide-y rounded-md border">
      {results.map((row) => {
        const checkedIn = row.checked_in_at != null;
        const ts = row.checked_in_at
          ? new Date(row.checked_in_at).toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : null;
        return (
          <li
            key={row.id}
            className={`flex items-center gap-3 p-2.5 ${
              checkedIn ? "opacity-60" : ""
            }`}
          >
            {row.avatar_photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.avatar_photo_url}
                alt={row.full_name}
                className="h-10 w-10 rounded-full object-cover border"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-[11px] font-semibold text-muted-foreground border">
                {initials(row.full_name)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">
                {row.full_name}
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                {row.role_name}
                {row.phone_masked ? ` · ${row.phone_masked}` : ""}
                {row.cccd_last4 ? ` · CCCD •••${row.cccd_last4}` : ""}
              </div>
            </div>
            {checkedIn ? (
              <div className="text-xs text-green-700 dark:text-green-400 font-medium whitespace-nowrap">
                ✅ Đã check-in{ts ? ` ${ts}` : ""}
              </div>
            ) : (
              <Button
                size="sm"
                onClick={() => onCheckin(row)}
                disabled={disabled || checkingInId != null}
              >
                {checkingInId === row.id ? "Đang…" : "Check-in"}
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
