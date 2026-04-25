"use client";

/**
 * Result Image Creator — Share Analytics Widget (D-3).
 *
 * Pulls aggregated share-event data from the backend (`/race-results/admin/
 * result-image-stats`). Lets admin filter by race + time window and inspect:
 *  - total shares + unique athletes
 *  - template popularity (bar)
 *  - channel breakdown (bar)
 *  - template-fallback rate (KPI — goal < 10%, alert > 30%)
 *
 * Read-only page. Auto-refresh every 2 min.
 */
import { useCallback, useEffect, useState } from "react";
import { authHeaders } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BarChart } from "@/components/charts/BarChart";
import { Image as ImageIcon, Users, Share2, AlertTriangle } from "lucide-react";

interface ShareStats {
  totalShares: number;
  totalUniqueBibs: number;
  byTemplate: { template: string; count: number }[];
  byChannel: { channel: string; count: number }[];
  fallbackRate: number;
}

const WINDOWS: { value: string; label: string; hours: number | null }[] = [
  { value: "24h", label: "24 giờ qua", hours: 24 },
  { value: "7d", label: "7 ngày qua", hours: 24 * 7 },
  { value: "30d", label: "30 ngày qua", hours: 24 * 30 },
  { value: "all", label: "Toàn thời gian", hours: null },
];

const TEMPLATE_LABELS: Record<string, string> = {
  classic: "Classic",
  celebration: "Celebration",
  endurance: "Endurance",
  story: "Story (9:16)",
  sticker: "Sticker",
  podium: "Podium",
};

const CHANNEL_LABELS: Record<string, string> = {
  download: "Tải xuống",
  "web-share": "Native Share",
  "copy-link": "Copy / Fallback",
  unknown: "Không xác định",
};

export default function ResultImageStatsPage() {
  const [raceId, setRaceId] = useState<string>("");
  const [windowKey, setWindowKey] = useState<string>("7d");
  const [data, setData] = useState<ShareStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (raceId.trim()) params.set("raceId", raceId.trim());
      const win = WINDOWS.find((w) => w.value === windowKey);
      if (win?.hours) {
        const since = new Date(Date.now() - win.hours * 60 * 60 * 1000);
        params.set("since", since.toISOString());
      }

      const res = await fetch(
        `/api/race-results/admin/result-image-stats?${params.toString()}`,
        {
          ...authHeaders(),
          credentials: "include",
        },
      );
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const payload = (await res.json()) as { data: ShareStats };
      setData(payload.data);
    } catch (err) {
      setError((err as Error).message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [raceId, windowKey]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 2 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  const fallbackSeverity =
    !data?.fallbackRate || data.fallbackRate < 0.1
      ? "ok"
      : data.fallbackRate < 0.3
        ? "warn"
        : "alert";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Result Image — Share Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tổng hợp lượt chia sẻ ảnh kết quả theo template, kênh, và tỉ lệ fallback.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="raceId (tuỳ chọn)"
            value={raceId}
            onChange={(e) => setRaceId(e.target.value)}
            className="w-[280px]"
          />
          <Select value={windowKey} onValueChange={(v) => v && setWindowKey(v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WINDOWS.map((w) => (
                <SelectItem key={w.value} value={w.value}>
                  {w.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-4 text-sm text-destructive">
            Không tải được dữ liệu: {error}
          </CardContent>
        </Card>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Share2 className="size-5" />}
          label="Tổng lượt chia sẻ"
          value={data?.totalShares ?? 0}
          loading={loading}
        />
        <KpiCard
          icon={<Users className="size-5" />}
          label="Số VĐV chia sẻ (unique bib)"
          value={data?.totalUniqueBibs ?? 0}
          loading={loading}
        />
        <KpiCard
          icon={<ImageIcon className="size-5" />}
          label="Template phổ biến nhất"
          value={
            data?.byTemplate?.[0]
              ? TEMPLATE_LABELS[data.byTemplate[0].template] ??
                data.byTemplate[0].template
              : "—"
          }
          loading={loading}
          isText
        />
        <KpiCard
          icon={<AlertTriangle className="size-5" />}
          label="Tỉ lệ fallback (template không đủ điều kiện)"
          value={
            data ? `${(data.fallbackRate * 100).toFixed(2)}%` : "—"
          }
          loading={loading}
          isText
          severity={fallbackSeverity}
          hint={
            fallbackSeverity === "alert"
              ? "⚠ > 30% — user đang chọn template không đủ điều kiện. Xem lại gating UX."
              : fallbackSeverity === "warn"
                ? "Hơi cao (> 10%), theo dõi thêm."
                : "Healthy."
          }
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Template phổ biến</CardTitle>
            <CardDescription>Số lượt share theo template</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : data?.byTemplate && data.byTemplate.length > 0 ? (
              <BarChart
                data={data.byTemplate.map((t) => ({
                  label:
                    TEMPLATE_LABELS[t.template] ?? t.template,
                  value: t.count,
                }))}
                formatValue={(v) => new Intl.NumberFormat("vi-VN").format(v)}
              />
            ) : (
              <EmptyState />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kênh chia sẻ</CardTitle>
            <CardDescription>
              Download vs native-share vs copy-link
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : data?.byChannel && data.byChannel.length > 0 ? (
              <BarChart
                data={data.byChannel.map((c) => ({
                  label:
                    CHANNEL_LABELS[c.channel] ?? c.channel,
                  value: c.count,
                }))}
                formatValue={(v) => new Intl.NumberFormat("vi-VN").format(v)}
              />
            ) : (
              <EmptyState />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Breakdown tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BreakdownTable
          title="Bảng: Template"
          rows={(data?.byTemplate ?? []).map((t) => ({
            label: TEMPLATE_LABELS[t.template] ?? t.template,
            count: t.count,
            pct:
              data && data.totalShares > 0
                ? (t.count / data.totalShares) * 100
                : 0,
          }))}
          loading={loading}
        />
        <BreakdownTable
          title="Bảng: Kênh"
          rows={(data?.byChannel ?? []).map((c) => ({
            label: CHANNEL_LABELS[c.channel] ?? c.channel,
            count: c.count,
            pct:
              data && data.totalShares > 0
                ? (c.count / data.totalShares) * 100
                : 0,
          }))}
          loading={loading}
        />
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  loading,
  isText,
  severity,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  loading: boolean;
  isText?: boolean;
  severity?: "ok" | "warn" | "alert";
  hint?: string;
}) {
  const severityClass =
    severity === "alert"
      ? "text-red-600"
      : severity === "warn"
        ? "text-amber-600"
        : severity === "ok"
          ? "text-emerald-600"
          : "";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div
            className={`${isText ? "text-xl" : "text-3xl"} font-bold ${severityClass}`}
          >
            {typeof value === "number"
              ? new Intl.NumberFormat("vi-VN").format(value)
              : value}
          </div>
        )}
        {hint && !loading && (
          <p className="text-xs text-muted-foreground mt-1">{hint}</p>
        )}
      </CardContent>
    </Card>
  );
}

function BreakdownTable({
  title,
  rows,
  loading,
}: {
  title: string;
  rows: { label: string; count: number; pct: number }[];
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div
                key={r.label}
                className="flex items-center justify-between text-sm"
              >
                <span className="font-medium">{r.label}</span>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">
                    {new Intl.NumberFormat("vi-VN").format(r.count)}
                  </Badge>
                  <span className="text-muted-foreground w-12 text-right">
                    {r.pct.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">
      Chưa có dữ liệu share trong khoảng thời gian này.
    </div>
  );
}
