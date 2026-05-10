"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import "@/lib/api";
import { authHeaders } from "@/lib/api";
import { dashboardControllerGetPendingTasks } from "@/lib/dashboard-sdk-shim";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2 } from "lucide-react";

/**
 * F-023 BR-DASH-13/14/15/22 — Pending Tasks panel (4 nhóm count + link).
 */
type TaskGroup = {
  key: string;
  label: string;
  count: number;
  href: string;
};

export function PendingTasksPanel() {
  const { token } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<TaskGroup[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!token) return;
    async function load() {
      try {
        const res = await dashboardControllerGetPendingTasks({
          ...authHeaders(token),
        });
        const payload = res.data as unknown as {
          groups?: TaskGroup[];
          total?: number;
        };
        if (cancelled) return;
        setGroups(payload?.groups ?? []);
        setTotal(payload?.total ?? 0);
      } catch {
        if (!cancelled) {
          setGroups([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return <Skeleton className="h-32 w-full" />;
  }

  return (
    <section>
      <h2 className="mb-3 font-display text-lg font-semibold text-stone-900">
        Việc cần xử lý
      </h2>
      {total === 0 ? (
        <Card>
          <CardContent className="flex items-center gap-3 p-6 text-sm text-emerald-700">
            <CheckCircle2 className="size-5" />
            Bạn đã xử lý tất cả!
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {groups?.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => router.push(g.href)}
              className="rounded-lg border border-stone-200 bg-white p-4 text-left transition hover:border-blue-300 hover:shadow-sm"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                {g.label}
              </p>
              <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-stone-900">
                {g.count}
              </p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
