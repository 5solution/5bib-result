"use client";

/**
 * F-088 — Panel "Sức khỏe hệ thống": MISA status + token, lần scan cuối,
 * Telegram/email cấu hình, ngưỡng cảnh báo, daily counters hôm nay.
 */
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  Clock,
  Send,
  Mail,
  Gauge,
  KeyRound,
} from "lucide-react";
import {
  formatRelativeVi,
  type ReconcileHealth,
} from "@/lib/invoice-reconcile-api";

interface Props {
  health: ReconcileHealth | null;
  dailyCounters?: Record<string, number>;
}

const MISA_STATUS_LABEL: Record<string, string> = {
  OK: "🟢 Bình thường",
  DEGRADED: "🟡 Chậm (retry OK)",
  UNAVAILABLE: "🔴 Không kết nối",
};

function StatRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="flex items-center gap-2 text-sm text-stone-600">
        {icon}
        {label}
      </span>
      <span className="text-sm font-medium text-stone-900 text-right">
        {children}
      </span>
    </div>
  );
}

export function HealthPanel({ health, dailyCounters }: Props) {
  if (!health) return null;
  const c = dailyCounters ?? {};
  const alertsToday =
    (c["alert-warn"] ?? 0) +
    (c["alert-critical"] ?? 0) +
    (c["alert-breached"] ?? 0) +
    (c["alert-duplicate"] ?? 0) +
    (c["alert-misa-down"] ?? 0) +
    (c["alert-misa-auth"] ?? 0);

  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-stone-700">
        <Activity className="h-4 w-4" />
        Sức khỏe hệ thống
      </h2>

      <div className="mt-3 grid grid-cols-1 gap-x-8 gap-y-1 md:grid-cols-2">
        {/* Cột MISA + scan */}
        <div className="divide-y divide-stone-100">
          <StatRow icon={<Gauge className="h-4 w-4 text-stone-400" />} label="MISA Meinvoice">
            {health.misaConfigured
              ? (MISA_STATUS_LABEL[health.lastMisaStatus ?? "OK"] ??
                health.lastMisaStatus ??
                "—")
              : "Chưa cấu hình"}
          </StatRow>
          <StatRow icon={<KeyRound className="h-4 w-4 text-stone-400" />} label="Token MISA hết hạn">
            {health.misaTokenExpiresAt
              ? new Date(health.misaTokenExpiresAt).toLocaleDateString("vi-VN")
              : "—"}
          </StatRow>
          <StatRow icon={<Clock className="h-4 w-4 text-stone-400" />} label="Lần scan cuối">
            {health.lastScanTickAt ? formatRelativeVi(health.lastScanTickAt) : "Chưa scan"}
          </StatRow>
          <StatRow icon={<Activity className="h-4 w-4 text-stone-400" />} label="Race đang bật">
            {health.enabledRaceIds.length > 0
              ? health.enabledRaceIds.join(", ")
              : "Chưa bật race nào"}
          </StatRow>
        </div>

        {/* Cột kênh thông báo + ngưỡng */}
        <div className="divide-y divide-stone-100">
          <StatRow icon={<Send className="h-4 w-4 text-stone-400" />} label="Telegram bot">
            {health.telegramConfigured ? (
              <span className="flex items-center justify-end gap-2">
                <Badge variant="green">Bật</Badge>
                <span className="font-mono text-xs text-stone-500">
                  {health.telegramChatIdMasked ?? ""}
                </span>
              </span>
            ) : (
              <Badge variant="amber">Tắt</Badge>
            )}
          </StatRow>
          <StatRow icon={<Mail className="h-4 w-4 text-stone-400" />} label="Email dự phòng">
            <span className="font-mono text-xs text-stone-500">
              {health.emailRecipientsMasked.length > 0
                ? health.emailRecipientsMasked.join(", ")
                : "—"}
            </span>
          </StatRow>
          <StatRow icon={<Gauge className="h-4 w-4 text-stone-400" />} label="Ngưỡng cảnh báo">
            <span className="font-mono text-xs text-stone-500">
              WARN {health.thresholds.warnHours}h · CRIT {health.thresholds.criticalHours}h · phạt {health.thresholds.breachedHours}h
            </span>
          </StatRow>
          <StatRow icon={<Activity className="h-4 w-4 text-stone-400" />} label="Hôm nay">
            <span className="font-mono text-xs text-stone-500">
              {c["scan-ticks"] ?? 0} scan · MISA {c["misa-ok"] ?? 0}✓/{c["misa-fail"] ?? 0}✗ · {alertsToday} cảnh báo
            </span>
          </StatRow>
        </div>
      </div>
    </Card>
  );
}
