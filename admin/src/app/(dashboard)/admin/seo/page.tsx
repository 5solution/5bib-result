"use client";

/**
 * FEATURE-036 — Admin SEO manual trigger UI.
 *
 * Trang đơn giản cho 5BIB Back-Office Admin:
 *   - Xem 10 sync run gần nhất (cron + manual)
 *   - Button "Sync ngay" → POST /api/admin/seo/sync-slugs (BR-07)
 *
 * Auth: route nằm dưới (dashboard) — LogtoAdminGuard backend đã check.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { RefreshCcw, CheckCircle2, AlertCircle, Clock } from "lucide-react";

interface SyncLog {
  id: string;
  startedAt: string;
  finishedAt?: string;
  triggeredBy: "cron" | "manual";
  userId?: string;
  racesScanned: number;
  slugsGenerated: number;
  revalidatedPaths: string[];
  errors: string[];
  durationMs: number;
  lockSkipped: boolean;
}

interface SyncResult {
  racesScanned: number;
  slugsGenerated: number;
  revalidatedPaths: string[];
  errors: string[];
  durationMs: number;
  lockSkipped: boolean;
}

async function fetchLogs(): Promise<SyncLog[]> {
  const res = await fetch("/api/admin/seo/sync-logs?limit=10");
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

async function triggerSync(): Promise<SyncResult> {
  const res = await fetch("/api/admin/seo/sync-slugs", { method: "POST" });
  if (res.status === 409) {
    throw new Error("Một lần sync khác đang chạy — thử lại sau vài giây");
  }
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

function formatDate(s?: string): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return s;
  }
}

export default function AdminSeoPage() {
  const qc = useQueryClient();
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: logs, isLoading } = useQuery({
    queryKey: ["admin", "seo", "sync-logs"],
    queryFn: fetchLogs,
    refetchInterval: 30000,
  });

  const { mutate, isPending } = useMutation({
    mutationFn: triggerSync,
    onSuccess: (result) => {
      setLastResult(result);
      setErrorMsg(null);
      qc.invalidateQueries({ queryKey: ["admin", "seo", "sync-logs"] });
    },
    onError: (err: Error) => {
      setErrorMsg(err.message);
      setLastResult(null);
    },
  });

  const stats = logs?.[0]; // most recent

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">SEO Slug Sync</h1>
        <p className="mt-1 text-sm text-stone-600">
          Quản lý cron đồng bộ slug cho các trang SEO{" "}
          <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">/giai-chay/*</code>
          . Cron tự chạy mỗi Chủ Nhật 02:00 — có thể trigger thủ công.
        </p>
      </header>

      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Trạng thái mới nhất</h2>
            {stats ? (
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <dt className="text-stone-500">Chạy gần nhất:</dt>
                <dd className="font-medium">{formatDate(stats.startedAt)}</dd>
                <dt className="text-stone-500">Trigger:</dt>
                <dd className="font-medium">
                  {stats.triggeredBy === "cron" ? "🕒 Cron tự động" : "👤 Thủ công"}
                </dd>
                <dt className="text-stone-500">Quét:</dt>
                <dd className="font-medium">{stats.racesScanned} races</dd>
                <dt className="text-stone-500">Slug mới:</dt>
                <dd className="font-medium">{stats.slugsGenerated}</dd>
                <dt className="text-stone-500">Trạng thái:</dt>
                <dd className="font-medium">
                  {stats.lockSkipped ? (
                    <span className="text-amber-700">⚠️ Lock skip</span>
                  ) : stats.errors.length > 0 ? (
                    <span className="text-red-700">
                      ❌ {stats.errors.length} lỗi
                    </span>
                  ) : (
                    <span className="text-green-700">✅ Thành công</span>
                  )}
                </dd>
              </dl>
            ) : (
              <p className="mt-2 text-sm text-stone-500">
                {isLoading ? "Đang tải..." : "Chưa có lần sync nào."}
              </p>
            )}
          </div>
          <Button
            onClick={() => mutate()}
            disabled={isPending}
            className="flex items-center gap-2"
          >
            <RefreshCcw className={isPending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            {isPending ? "Đang sync..." : "Sync ngay"}
          </Button>
        </div>

        {lastResult && (
          <div className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-900">
            <CheckCircle2 className="inline h-4 w-4" /> Đã sync xong —{" "}
            <strong>{lastResult.slugsGenerated}</strong> slug mới /{" "}
            <strong>{lastResult.racesScanned}</strong> race quét — duration{" "}
            {lastResult.durationMs}ms.
          </div>
        )}
        {errorMsg && (
          <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-900">
            <AlertCircle className="inline h-4 w-4" /> {errorMsg}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">Lịch sử 10 lần gần nhất</h2>
        {isLoading ? (
          <div className="rounded-xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">
            <Clock className="mx-auto h-5 w-5 animate-spin" />
            <p className="mt-2">Đang tải...</p>
          </div>
        ) : !logs || logs.length === 0 ? (
          <div className="rounded-xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">
            Chưa có lịch sử sync nào.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs font-semibold uppercase text-stone-600">
                <tr>
                  <th className="px-3 py-2.5">Thời gian</th>
                  <th className="px-3 py-2.5">Trigger</th>
                  <th className="px-3 py-2.5">Quét</th>
                  <th className="px-3 py-2.5">Slug mới</th>
                  <th className="px-3 py-2.5">Duration</th>
                  <th className="px-3 py-2.5">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-stone-50">
                    <td className="px-3 py-2.5 font-mono">
                      {formatDate(log.startedAt)}
                    </td>
                    <td className="px-3 py-2.5">
                      {log.triggeredBy === "cron" ? "🕒 cron" : "👤 manual"}
                    </td>
                    <td className="px-3 py-2.5">{log.racesScanned}</td>
                    <td className="px-3 py-2.5 font-semibold">
                      {log.slugsGenerated}
                    </td>
                    <td className="px-3 py-2.5">{log.durationMs}ms</td>
                    <td className="px-3 py-2.5">
                      {log.lockSkipped ? (
                        <span className="text-amber-700">⚠️ skip</span>
                      ) : log.errors.length > 0 ? (
                        <span className="text-red-700">❌ {log.errors.length} lỗi</span>
                      ) : (
                        <span className="text-green-700">✅ OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
