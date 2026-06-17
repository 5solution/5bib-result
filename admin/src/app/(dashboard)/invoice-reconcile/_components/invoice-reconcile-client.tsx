"use client";

/**
 * F-076 — Invoice Reconcile client orchestrator.
 *
 * Composes: Layer2 banner + KPI strip + Missing rows table + MISA orphan
 * collapse + Trigger button + Auto-poll 60s (cron 5p + Redis cache).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, AlertTriangle, Send } from "lucide-react";
import {
  getReconcileReport,
  getReconcileHealth,
  triggerReconcile,
  sendHeartbeat,
  setOrderResolved,
  InvoiceReconcileApiError,
  type ReconcileReport,
  type ReconcileHealth,
} from "@/lib/invoice-reconcile-api";
import { KpiStrip } from "./kpi-strip";
import { MissingRowsTable } from "./missing-rows-table";
import { MisaOrphanCollapse } from "./misa-orphan-collapse";
import { Layer2StatusBanner } from "./layer2-status-banner";
import { HealthPanel } from "./health-panel";

export function InvoiceReconcileClient() {
  const [report, setReport] = useState<ReconcileReport | null>(null);
  const [health, setHealth] = useState<ReconcileHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [triggerDisabledUntil, setTriggerDisabledUntil] = useState(0);
  const [sendingHb, setSendingHb] = useState(false);
  const [hbDisabledUntil, setHbDisabledUntil] = useState(0);
  const [hideResolved, setHideResolved] = useState(false);

  // F-088 BUG-03 fix — optimistic resolved overrides. Auto-poll 60s ghi đè
  // report; map này merge lại để row vừa đánh dấu KHÔNG nhảy về trạng thái cũ
  // trong cửa sổ trước khi server commit SADD. Tự clear khi server đã bắt kịp.
  const overridesRef = useRef<Map<number, boolean>>(new Map());

  const applyOverrides = useCallback((data: ReconcileReport): ReconcileReport => {
    const ov = overridesRef.current;
    if (ov.size === 0) return data;
    const missing = data.missing.map((m) => {
      if (!ov.has(m.orderId)) return m;
      const want = ov.get(m.orderId)!;
      if (m.resolved === want) {
        ov.delete(m.orderId); // server đã bắt kịp → bỏ override
        return m;
      }
      return { ...m, resolved: want };
    });
    return { ...data, missing };
  }, []);

  const fetchReport = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const data = await getReconcileReport();
        setReport(applyOverrides(data));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        if (!silent) toast.error(`Không tải được báo cáo: ${msg}`);
      } finally {
        setLoading(false);
      }
    },
    [applyOverrides],
  );

  const fetchHealth = useCallback(async () => {
    try {
      setHealth(await getReconcileHealth());
    } catch {
      // best-effort — panel ẩn nếu lỗi
    }
  }, []);

  useEffect(() => {
    void fetchReport();
    void fetchHealth();
    // Auto-poll every 60s (cron 5p + Redis cache hit fast)
    const id = setInterval(() => {
      void fetchReport(true);
      void fetchHealth();
    }, 60_000);
    return () => clearInterval(id);
  }, [fetchReport, fetchHealth]);

  const onSendHeartbeat = useCallback(async () => {
    if (sendingHb || Date.now() < hbDisabledUntil) return;
    setSendingHb(true);
    setHbDisabledUntil(Date.now() + 10_000); // 10s min disable (BE throttle 3/min)
    try {
      const { sent } = await sendHeartbeat();
      if (sent) {
        toast.success("Đã gửi heartbeat lên Telegram");
      } else {
        toast.warning("Gửi heartbeat không thành công — kiểm tra cấu hình bot");
      }
    } catch (e) {
      if (e instanceof InvoiceReconcileApiError && e.status === 429) {
        toast.warning("Gửi quá nhanh — thử lại sau 1 phút");
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(`Lỗi gửi heartbeat: ${msg}`);
      }
    } finally {
      setSendingHb(false);
    }
  }, [sendingHb, hbDisabledUntil]);

  const onResolve = useCallback(
    async (orderId: number, resolved: boolean) => {
      // Optimistic: ghi override (chống poll ghi đè) + update ngay UI
      overridesRef.current.set(orderId, resolved);
      setReport((prev) =>
        prev
          ? {
              ...prev,
              missing: prev.missing.map((m) =>
                m.orderId === orderId ? { ...m, resolved } : m,
              ),
            }
          : prev,
      );
      try {
        await setOrderResolved(orderId, resolved);
        toast.success(resolved ? "Đã đánh dấu xử lý" : "Đã bỏ đánh dấu");
      } catch (e) {
        // Rollback override + UI
        overridesRef.current.delete(orderId);
        setReport((prev) =>
          prev
            ? {
                ...prev,
                missing: prev.missing.map((m) =>
                  m.orderId === orderId ? { ...m, resolved: !resolved } : m,
                ),
              }
            : prev,
        );
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(`Lỗi cập nhật: ${msg}`);
      }
    },
    [],
  );

  const onTrigger = useCallback(async () => {
    if (triggering) return;
    if (Date.now() < triggerDisabledUntil) return;
    setTriggering(true);
    setTriggerDisabledUntil(Date.now() + 5000); // 5s min disable per PRD
    try {
      const updated = await triggerReconcile();
      setReport(applyOverrides(updated));
      toast.success(
        `Đối soát xong — ${updated.missingCount} đơn còn thiếu`,
      );
    } catch (e) {
      if (e instanceof InvoiceReconcileApiError && e.status === 409) {
        toast.warning("Đang có cron khác chạy, thử lại sau 5 phút");
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(`Lỗi đối soát: ${msg}`);
      }
    } finally {
      setTriggering(false);
    }
  }, [triggering, triggerDisabledUntil, applyOverrides]);

  if (loading && !report) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-80" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error && !report) {
    return (
      <Card className="m-6 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 text-red-500" aria-hidden />
          <div>
            <h2 className="text-lg font-semibold text-red-700">
              Không tải được báo cáo
            </h2>
            <p className="mt-1 text-sm text-stone-600">{error}</p>
            <Button
              onClick={() => void fetchReport()}
              variant="outline"
              className="mt-3"
            >
              Thử lại
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  if (!report) return null;

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">
            Đối soát hóa đơn MISA Meinvoice
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            Cập nhật lần cuối:{" "}
            <span className="font-mono">
              {new Date(report.runAt).toLocaleString("vi-VN")}
            </span>{" "}
            • Cron mỗi 5 phút (08:00 – 22:00 ICT)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={onSendHeartbeat}
            disabled={sendingHb || Date.now() < hbDisabledUntil}
            variant="outline"
          >
            <Send className={`h-4 w-4 mr-2 ${sendingHb ? "animate-pulse" : ""}`} />
            {sendingHb ? "Đang gửi..." : "Gửi heartbeat ngay"}
          </Button>
          <Button
            onClick={onTrigger}
            disabled={triggering || Date.now() < triggerDisabledUntil}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${triggering ? "animate-spin" : ""}`}
            />
            {triggering ? "Đang đối soát..." : "Chạy reconcile ngay"}
          </Button>
        </div>
      </div>

      {/* Layer2 banner */}
      <Layer2StatusBanner status={report.layer2Status} />

      {/* No race enabled empty state */}
      {report.raceIdsScanned.length === 0 ? (
        <Card className="p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
          <h2 className="mt-3 text-lg font-semibold text-stone-900">
            Chưa có race nào bật e-invoice
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            Set env <code>INVOICE_RECONCILE_ENABLED_RACES=140,220</code> rồi
            restart backend.
          </p>
        </Card>
      ) : (
        <>
          {/* KPI strip (F-088: +cumulative +error breakdown) */}
          <KpiStrip report={report} />

          {/* F-088 — Health panel */}
          <HealthPanel health={health} dailyCounters={report.dailyCounters} />

          {/* Missing rows table (F-088: resolve actions) */}
          <MissingRowsTable
            rows={report.missing}
            onResolve={onResolve}
            hideResolved={hideResolved}
            onToggleHideResolved={() => setHideResolved((v) => !v)}
          />

          {/* MISA orphan collapse */}
          <MisaOrphanCollapse rows={report.misaOrphan} />
        </>
      )}
    </div>
  );
}
