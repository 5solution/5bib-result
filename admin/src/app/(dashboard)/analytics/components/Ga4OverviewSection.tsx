"use client";

/**
 * F-062 Wave 4 NEW — GA4 Overview Section (BR-SA-11 v3).
 *
 * GA4 Data API proxy với graceful fallback khi GA4 chưa configured.
 * Displays 5 KPI cards + top pages table + traffic sources.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, AlertCircle, BarChart3 } from "lucide-react";
import { useGa4Overview } from "@/lib/analytics-hooks";

interface Props {
  from?: string;
  to?: string;
  month?: string;
  tenantId?: number;
}

function fmtNum(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n));
}

function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}p ${s.toString().padStart(2, "0")}s`;
}

export function Ga4OverviewSection(props: Props) {
  const { data, isLoading } = useGa4Overview(props);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" /> GA4 Web Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 animate-pulse bg-stone-100 rounded" />
        </CardContent>
      </Card>
    );
  }

  const d = data as {
    available: boolean;
    error?: string;
    sessions?: number;
    pageviews?: number;
    bounceRate?: number;
    avgSessionDuration?: number;
    newUsers?: number;
    topPages?: Array<{ page: string; pageviews: number }>;
    trafficSources?: Array<{ source: string; sessions: number }>;
  };

  if (!d?.available) {
    return (
      <Card className="border-stone-200">
        <CardContent className="p-6 text-center">
          <AlertCircle className="h-8 w-8 mx-auto text-stone-400 mb-2" />
          <p className="text-sm text-stone-600">
            {d?.error ?? "GA4 chưa được cấu hình."}
          </p>
          <p className="text-xs text-stone-400 mt-1">
            Set <code>GA4_SERVICE_ACCOUNT_KEY_PATH</code> + <code>GA4_PROPERTY_ID</code> env to enable.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-600" />
          GA4 Web Analytics
        </CardTitle>
        <p className="text-xs text-stone-500">BR-SA-11 — Google Analytics 4 Data API proxy</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 5 KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Sessions", value: fmtNum(d.sessions ?? 0) },
            { label: "Pageviews", value: fmtNum(d.pageviews ?? 0) },
            { label: "New Users", value: fmtNum(d.newUsers ?? 0) },
            {
              label: "Bounce Rate",
              value: ((d.bounceRate ?? 0) * 100).toFixed(1) + "%",
            },
            {
              label: "Avg Session",
              value: fmtDuration(d.avgSessionDuration ?? 0),
            },
          ].map((k) => (
            <div key={k.label} className="bg-stone-50 rounded p-3 text-center">
              <div className="text-xs text-stone-500 uppercase tracking-wide">
                {k.label}
              </div>
              <div className="text-lg font-bold text-stone-900 tabular-nums mt-1">
                {k.value}
              </div>
            </div>
          ))}
        </div>

        {/* Top Pages + Traffic Sources */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Top Pages */}
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
              <ExternalLink className="h-3 w-3" /> Top 10 Pages
            </h3>
            <div className="space-y-1">
              {(d.topPages ?? []).slice(0, 10).map((p, i) => (
                <div
                  key={p.page}
                  className="flex items-center justify-between text-xs bg-stone-50 rounded px-2 py-1.5"
                >
                  <span className="font-mono truncate text-stone-600">
                    {i + 1}. {p.page}
                  </span>
                  <span className="tabular-nums font-bold ml-2 shrink-0">
                    {fmtNum(p.pageviews)}
                  </span>
                </div>
              ))}
              {(d.topPages ?? []).length === 0 && (
                <p className="text-xs text-stone-400">Không có data.</p>
              )}
            </div>
          </div>

          {/* Traffic Sources */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Top 5 Traffic Sources</h3>
            <div className="space-y-1">
              {(d.trafficSources ?? []).slice(0, 5).map((s) => {
                const max = Math.max(
                  1,
                  ...(d.trafficSources ?? []).map((t) => t.sessions),
                );
                const pct = (s.sessions / max) * 100;
                return (
                  <div key={s.source}>
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="truncate font-mono text-stone-700">
                        {s.source}
                      </span>
                      <span className="tabular-nums font-bold ml-2 shrink-0">
                        {fmtNum(s.sessions)}
                      </span>
                    </div>
                    <div className="h-2 bg-stone-100 rounded overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {(d.trafficSources ?? []).length === 0 && (
                <p className="text-xs text-stone-400">Không có data.</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
