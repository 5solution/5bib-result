"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  getSupplyOverview,
  upsertSupplyPlanFulfill,
  type EventSupplyOverview,
  type SupplyOverviewCell,
} from "@/lib/team-api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Save, RefreshCw } from "lucide-react";
import { toast } from "sonner";

// Key for the dirty-cell map: `${role_id}:${item_id}` → fulfilled_qty
type DirtyMap = Record<string, number>;

export default function SupplyPlanPage(): React.ReactElement {
  const router = useRouter();
  const params = useParams<{ eventId: string }>();
  const eventId = Number(params.eventId);
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();

  const [overview, setOverview] = useState<EventSupplyOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState<DirtyMap>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const data = await getSupplyOverview(token, eventId);
      setOverview(data);
      setDirty({});
    } catch (err) {
      setError((err as Error).message);
    }
  }, [token, eventId]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/sign-in");
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  const dirtyByRole = useMemo(() => {
    const map: Record<number, Array<{ item_id: number; fulfilled_qty: number }>> = {};
    for (const [key, val] of Object.entries(dirty)) {
      const [roleIdStr, itemIdStr] = key.split(":");
      if (!roleIdStr || !itemIdStr) continue;
      const rid = Number(roleIdStr);
      const iid = Number(itemIdStr);
      if (!map[rid]) map[rid] = [];
      map[rid].push({ item_id: iid, fulfilled_qty: val });
    }
    return map;
  }, [dirty]);

  const dirtyCount = Object.keys(dirty).length;

  async function handleSaveAll(): Promise<void> {
    if (!token || !overview || dirtyCount === 0) return;
    setSaving(true);
    try {
      const promises = Object.entries(dirtyByRole).map(([rid, items]) =>
        upsertSupplyPlanFulfill(token, eventId, Number(rid), { items }),
      );
      await Promise.all(promises);
      toast.success(`Đã lưu ${dirtyCount} ô`);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || !isAuthenticated) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-gradient flex items-center gap-2">
          <BarChart3 className="size-6 sm:size-7 text-blue-600" /> Kế Hoạch Vật
          Tư
        </h1>
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={saving}
        >
          <RefreshCw className="mr-2 size-4" /> Refresh
        </Button>
          <Button
            onClick={() => void handleSaveAll()}
            disabled={dirtyCount === 0 || saving}
          >
            <Save className="mr-2 size-4" />
            {saving
              ? "Đang lưu..."
              : dirtyCount === 0
              ? "Lưu fulfill"
              : `Lưu fulfill (${dirtyCount})`}
          </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {overview === null ? (
        <Skeleton className="h-96" />
      ) : overview.items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <BarChart3 className="mx-auto size-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">
            Chưa có leader nào order vật tư. Chờ leader gửi request.
          </p>
        </div>
      ) : overview.roles.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">Chưa có team/role.</p>
        </div>
      ) : (
        <OverviewMatrix
          overview={overview}
          dirty={dirty}
          onCellChange={(roleId, itemId, value) => {
            setDirty((prev) => {
              const key = `${roleId}:${itemId}`;
              const next = { ...prev };
              // Find original to detect "reset to original" → remove key
              const row = overview.items.find((i) => i.item_id === itemId);
              const cell = row?.cells.find((c) => c.role_id === roleId);
              const original = cell?.fulfilled_qty ?? null;
              if (value === original) {
                delete next[key];
              } else {
                next[key] = value;
              }
              return next;
            });
          }}
        />
      )}
    </div>
  );
}

function OverviewMatrix({
  overview,
  dirty,
  onCellChange,
}: {
  overview: EventSupplyOverview;
  dirty: DirtyMap;
  onCellChange: (roleId: number, itemId: number, value: number) => void;
}): React.ReactElement {
  // Keep only roles that have at least one requested_qty > 0 — keep all for flexibility.
  const roles = overview.roles;

  function gapOf(cell: SupplyOverviewCell, overrideFulfill?: number): number | null {
    const fulfilled =
      overrideFulfill !== undefined ? overrideFulfill : cell.fulfilled_qty;
    if (fulfilled === null) return null;
    return fulfilled - cell.requested_qty;
  }

  return (
    <div className="overflow-x-auto border rounded-lg bg-white">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wide">
          <tr>
            <th
              className="text-left px-3 py-2 font-semibold sticky left-0 bg-muted/60 z-10 min-w-[180px]"
              rowSpan={2}
            >
              Vật tư
            </th>
            {roles.map((r) => (
              <th
                key={r.role_id}
                className="text-center px-2 py-2 font-semibold border-l"
                colSpan={3}
              >
                {r.role_name}
              </th>
            ))}
          </tr>
          <tr>
            {roles.map((r) => (
              <th
                key={`${r.role_id}-sub`}
                colSpan={3}
                className="border-l p-0"
              >
                <div className="grid grid-cols-3 text-[11px] font-medium text-muted-foreground">
                  <span className="text-center py-1 border-r">Order</span>
                  <span className="text-center py-1 border-r">Fulfill</span>
                  <span className="text-center py-1">Gap</span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {overview.items.map((row) => (
            <tr key={row.item_id} className="border-t">
              <td className="px-3 py-2 font-medium sticky left-0 bg-white z-10 border-r">
                <div>{row.item_name}</div>
                <div className="text-xs text-muted-foreground">{row.unit}</div>
              </td>
              {roles.map((r) => {
                const cell = row.cells.find((c) => c.role_id === r.role_id);
                const key = `${r.role_id}:${row.item_id}`;
                const isDirty = key in dirty;
                const fulfillVal = isDirty
                  ? dirty[key]!
                  : cell?.fulfilled_qty ?? null;
                const gap = cell ? gapOf(cell, fulfillVal ?? undefined) : null;
                const requested = cell?.requested_qty ?? 0;
                return (
                  <Fragment key={r.role_id}>
                    <td
                      className="border-l text-center px-2 py-2 text-sm"
                    >
                      {requested === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        requested
                      )}
                    </td>
                    <td
                      className="border-l text-center px-1 py-1"
                    >
                      {requested === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          value={fulfillVal ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "") {
                              onCellChange(r.role_id, row.item_id, 0);
                            } else {
                              onCellChange(r.role_id, row.item_id, Number(v));
                            }
                          }}
                          className="w-20 text-center text-sm rounded border bg-white px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          style={{
                            borderColor: isDirty ? "#2563eb" : "#d1d5db",
                            background: isDirty ? "#eff6ff" : "white",
                          }}
                        />
                      )}
                    </td>
                    <td
                      className="border-l text-center px-1 py-2 text-xs font-medium"
                    >
                      {requested === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : gap === null ? (
                        <span
                          className="inline-block px-1.5 py-0.5 rounded"
                          style={{ background: "#fef3c7", color: "#b45309" }}
                        >
                          ⏳ Chờ
                        </span>
                      ) : gap === 0 ? (
                        <span
                          className="inline-block px-1.5 py-0.5 rounded"
                          style={{ background: "#dcfce7", color: "#166534" }}
                        >
                          ✅ Đủ
                        </span>
                      ) : gap < 0 ? (
                        <span
                          className="inline-block px-1.5 py-0.5 rounded"
                          style={{ background: "#fee2e2", color: "#b91c1c" }}
                        >
                          ❌ Thiếu {Math.abs(gap)}
                        </span>
                      ) : (
                        <span
                          className="inline-block px-1.5 py-0.5 rounded"
                          style={{ background: "#dbeafe", color: "#1d4ed8" }}
                        >
                          ℹ️ Dư {gap}
                        </span>
                      )}
                    </td>
                  </Fragment>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
