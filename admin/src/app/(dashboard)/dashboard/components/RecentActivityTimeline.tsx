"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import "@/lib/api";
import { authHeaders } from "@/lib/api";
import { dashboardControllerGetRecentActivity } from "@/lib/dashboard-sdk-shim";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * F-023 BR-DASH-16/17/18/23 — Recent Activity timeline.
 *
 * Refetch mỗi 60s. Format timestamp tương đối tiếng Việt ("2 phút trước").
 */
type ActivityItem = {
  id: string;
  actor: { userId: string; displayName?: string; role?: string };
  action: string;
  entity: { type: string; id: string; displayName?: string };
  metadata?: Record<string, unknown>;
  createdAt: string;
};

const ACTION_LABELS: Record<string, string> = {
  "race.force_update_status": "force-update trạng thái",
  "race.publish": "publish giải",
  "race.lock": "khoá giải",
  "recon.send": "gửi đối soát",
  "claim.approve": "duyệt khiếu nại",
  "podium.publish": "publish podium",
  "podium.final": "chốt podium FINAL",
  "medical.state_change": "đổi trạng thái medical",
};

const REFETCH_INTERVAL_MS = 60_000;

function relativeTimeVi(iso: string): string {
  try {
    const t = new Date(iso).getTime();
    const diff = Math.max(0, Date.now() - t);
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return `${sec} giây trước`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} phút trước`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} giờ trước`;
    const day = Math.floor(hr / 24);
    return `${day} ngày trước`;
  } catch {
    return "";
  }
}

export function RecentActivityTimeline() {
  const { token } = useAuth();
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!token) return;
    async function load() {
      try {
        const res = await dashboardControllerGetRecentActivity({
          query: { limit: 10 },
          ...authHeaders(token),
        });
        const payload = res.data as unknown as { items?: ActivityItem[] };
        if (!cancelled) setItems(payload?.items ?? []);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    const id = setInterval(load, REFETCH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token]);

  if (loading) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (!items || items.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-stone-500">
          Chưa có hoạt động gần đây
        </CardContent>
      </Card>
    );
  }

  return (
    <section>
      <h2 className="mb-3 font-display text-lg font-semibold text-stone-900">
        Hoạt động gần đây
      </h2>
      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-stone-100">
            {items.map((it) => {
              const verb = ACTION_LABELS[it.action] ?? it.action;
              const actorName =
                it.actor.displayName?.trim() || it.actor.userId.slice(0, 8);
              return (
                <li
                  key={it.id}
                  className="flex items-start gap-3 px-5 py-3 text-sm"
                >
                  <span className="mt-1 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                    {actorName.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-stone-800">
                      <span className="font-semibold">{actorName}</span>{" "}
                      <span className="text-stone-600">{verb}</span>{" "}
                      {it.entity.displayName ? (
                        <span className="font-medium text-stone-900">
                          {it.entity.displayName}
                        </span>
                      ) : (
                        <span className="font-mono text-xs text-stone-500">
                          {it.entity.type}:{it.entity.id.slice(0, 8)}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-stone-400">
                      {relativeTimeVi(it.createdAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
