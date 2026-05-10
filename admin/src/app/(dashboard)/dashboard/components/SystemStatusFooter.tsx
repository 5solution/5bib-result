"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import "@/lib/api";
import { authHeaders } from "@/lib/api";
import { dashboardControllerGetSystemStatus } from "@/lib/dashboard-sdk-shim";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";

/**
 * F-023 BR-DASH-19/20/25 — System Status footer + system-down banner.
 *
 * Polling 60s. 4 service: API / MyLaps / Email / Storage.
 * `systemDown` true → banner đỏ (caller render thông qua ref hoặc SSE
 * — hiện component tự render banner inline ở trên cùng group).
 */
type ServiceStatus = {
  key: string;
  label: string;
  status: "ok" | "degraded" | "down";
  message?: string;
  lastOkAt?: string;
};

type Snapshot = {
  services: ServiceStatus[];
  systemDown: boolean;
  checkedAt: string;
};

const POLL_MS = 60_000;

const STATUS_TONE: Record<
  ServiceStatus["status"],
  { dot: string; label: string }
> = {
  ok: { dot: "bg-emerald-500", label: "OK" },
  degraded: { dot: "bg-amber-500", label: "Chậm" },
  down: { dot: "bg-rose-600", label: "Lỗi" },
};

export function SystemStatusFooter() {
  const { token } = useAuth();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!token) return;
    async function load() {
      try {
        const res = await dashboardControllerGetSystemStatus({
          ...authHeaders(token),
        });
        const payload = res.data as unknown as Snapshot;
        if (!cancelled && payload) setSnap(payload);
      } catch {
        if (!cancelled) setSnap(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token]);

  if (loading) {
    return <Skeleton className="h-16 w-full" />;
  }
  if (!snap) return null;

  return (
    <div className="flex flex-col gap-3">
      {snap.systemDown ? (
        <div className="flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          <AlertTriangle className="size-4" />
          Hệ thống đang gặp sự cố — API hoặc MyLaps đỏ liên tục &gt; 5 phút.
        </div>
      ) : null}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-xs">
          {snap.services.map((s) => {
            const tone = STATUS_TONE[s.status];
            return (
              <span key={s.key} className="inline-flex items-center gap-2">
                <span
                  className={`inline-block size-2 rounded-full ${tone.dot}`}
                />
                <span className="font-medium text-stone-700">{s.label}</span>
                <span className="text-stone-500">· {tone.label}</span>
              </span>
            );
          })}
          <span className="ml-auto text-stone-400">
            Cập nhật:{" "}
            {new Date(snap.checkedAt).toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
