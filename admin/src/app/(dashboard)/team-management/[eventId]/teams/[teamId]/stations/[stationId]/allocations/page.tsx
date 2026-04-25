"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  getStationAllocations,
  upsertStationAllocations,
  unlockAllocation,
  listSupplyItems,
  listStationsByCategory,
  type AllocationRow,
  type SupplyItem,
  type Station,
} from "@/lib/team-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Package, Lock, LockOpen, Save } from "lucide-react";
import { toast } from "sonner";

/**
 * Station allocation page — shows which supply items are allocated to this
 * station, allows admin to set/edit quantities, and unlock confirmed rows.
 *
 * Route: /team-management/[eventId]/teams/[teamId]/stations/[stationId]/allocations
 */
export default function StationAllocationsPage(): React.ReactElement {
  const router = useRouter();
  const params = useParams<{
    eventId: string;
    teamId: string;
    stationId: string;
  }>();
  const eventId = Number(params.eventId);
  const teamId = Number(params.teamId);
  const stationId = Number(params.stationId);
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();

  const [allocations, setAllocations] = useState<AllocationRow[] | null>(null);
  const [items, setItems] = useState<SupplyItem[]>([]);
  const [station, setStation] = useState<Station | null>(null);
  const [error, setError] = useState<string | null>(null);
  // draft qty edits: item_id → qty string
  const [draftQty, setDraftQty] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [unlockingId, setUnlockingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const [alloc, supplyItems, stations] = await Promise.all([
        getStationAllocations(token, stationId),
        listSupplyItems(token, eventId).catch(() => [] as SupplyItem[]),
        listStationsByCategory(token, teamId).catch(() => [] as Station[]),
      ]);
      setAllocations(alloc);
      setItems(supplyItems);
      const found = stations.find((s) => s.id === stationId) ?? null;
      setStation(found);
      // Initialize draft from current allocations
      const init: Record<number, string> = {};
      for (const a of alloc) {
        init[a.item_id] = String(a.allocated_qty);
      }
      setDraftQty(init);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [token, stationId, eventId, teamId]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/login");
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  async function handleSave(): Promise<void> {
    if (!token || !allocations) return;
    // Build upsert payload from all items that have a qty set (or existing alloc)
    const payload = Object.entries(draftQty)
      .map(([idStr, qtyStr]) => ({
        item_id: Number(idStr),
        allocated_qty: Math.max(0, parseInt(qtyStr, 10) || 0),
      }))
      .filter((r) => r.allocated_qty > 0 || allocations.some((a) => a.item_id === r.item_id));

    if (payload.length === 0) {
      toast.info("Chưa có thay đổi nào");
      return;
    }
    setSaving(true);
    try {
      await upsertStationAllocations(token, stationId, { allocations: payload });
      toast.success("Đã lưu phân bổ vật tư");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUnlock(allocationId: number): Promise<void> {
    if (!token) return;
    const note = prompt(
      "Lý do mở khóa phân bổ này (bắt buộc)?",
    );
    if (!note?.trim()) return;
    setUnlockingId(allocationId);
    try {
      await unlockAllocation(token, allocationId, note.trim());
      toast.success("Đã mở khóa — crew có thể chỉnh sửa lại");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUnlockingId(null);
    }
  }

  if (authLoading) return <Skeleton className="h-64" />;

  const stationName = station?.station_name ?? `Trạm #${stationId}`;

  return (
    <div className="space-y-4">
      {/* Breadcrumb + title */}
      <div className="flex items-center gap-2 flex-wrap">
        <Link
          href={`/team-management/${eventId}/teams/${teamId}/stations`}
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Danh sách trạm
        </Link>
        <span className="text-gray-400">/</span>
        <h1 className="font-display text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Package className="size-5 text-gray-400" />
          Vật tư tại trạm: {stationName}
        </h1>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          {error}{" "}
          <button
            type="button"
            onClick={() => void load()}
            className="underline"
          >
            Thử lại
          </button>
        </div>
      ) : allocations === null ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          {/* Info note */}
          <p className="text-sm text-gray-500">
            Phân bổ số lượng vật tư cụ thể cho trạm này. Crew/TNV tại trạm sẽ
            xác nhận khi nhận hàng (khóa allocation). Admin có thể mở khóa để
            chỉnh sửa lại.
          </p>

          {/* Allocation table */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="border-b text-xs font-semibold text-gray-500 uppercase tracking-wide"
                  style={{ background: "#f9fafb" }}
                >
                  <th className="px-4 py-3 text-left">Vật tư</th>
                  <th className="px-4 py-3 text-center">Đơn vị</th>
                  <th className="px-4 py-3 text-center">SL phân bổ</th>
                  <th className="px-4 py-3 text-center">SL xác nhận</th>
                  <th className="px-4 py-3 text-center">Trạng thái</th>
                  <th className="px-4 py-3 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allocations.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-gray-400 text-sm"
                    >
                      Chưa có phân bổ vật tư nào. Thêm từ danh sách vật tư bên
                      dưới.
                    </td>
                  </tr>
                ) : (
                  allocations.map((a) => (
                    <tr key={a.id} className="bg-white hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {a.item_name}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500">
                        {a.unit}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {a.is_locked ? (
                          <span className="font-mono">{a.allocated_qty}</span>
                        ) : (
                          <Input
                            type="number"
                            min={0}
                            value={draftQty[a.item_id] ?? String(a.allocated_qty)}
                            onChange={(e) =>
                              setDraftQty((prev) => ({
                                ...prev,
                                [a.item_id]: e.target.value,
                              }))
                            }
                            className="w-20 h-7 text-center text-sm mx-auto"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">
                        {a.confirmed_qty !== null ? (
                          <span className="font-mono">{a.confirmed_qty}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                        {a.shortage_qty !== null && a.shortage_qty > 0 ? (
                          <span className="ml-1 text-xs text-red-500">
                            (-{a.shortage_qty})
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {a.is_locked ? (
                          <Badge
                            className="text-[10px]"
                            style={{
                              background: "#dcfce7",
                              color: "#166534",
                              border: "none",
                            }}
                          >
                            <Lock className="size-2.5 mr-1" />
                            Đã xác nhận
                          </Badge>
                        ) : (
                          <Badge
                            className="text-[10px]"
                            style={{
                              background: "#fef9c3",
                              color: "#713f12",
                              border: "none",
                            }}
                          >
                            Chờ xác nhận
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {a.is_locked ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            disabled={unlockingId === a.id}
                            onClick={() => void handleUnlock(a.id)}
                          >
                            <LockOpen className="size-3" />
                            {unlockingId === a.id ? "…" : "Mở khóa"}
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Add new item row — show items not yet allocated */}
          {items.length > 0 && (
            <AddItemRow
              items={items}
              allocatedItemIds={allocations.map((a) => a.item_id)}
              onAdd={(itemId, qty) => {
                setDraftQty((prev) => ({ ...prev, [itemId]: String(qty) }));
                // Add a placeholder row to the allocations list so it shows in
                // the table immediately before saving — we patch the table
                // by reloading after save.
                toast.info("Nhấn 'Lưu phân bổ' để xác nhận");
              }}
            />
          )}

          {/* Save button */}
          <div className="flex justify-end gap-3">
            <Link
              href={`/team-management/${eventId}/teams/${teamId}/stations`}
              className="text-sm text-gray-500 hover:underline self-center"
            >
              Quay lại
            </Link>
            <Button
              onClick={() => void handleSave()}
              disabled={saving}
              className="gap-1.5"
            >
              <Save className="size-4" />
              {saving ? "Đang lưu…" : "Lưu phân bổ"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Add item row ─────────────────────────────────────────────

function AddItemRow({
  items,
  allocatedItemIds,
  onAdd,
}: {
  items: SupplyItem[];
  allocatedItemIds: number[];
  onAdd: (itemId: number, qty: number) => void;
}): React.ReactElement | null {
  const available = items.filter((i) => !allocatedItemIds.includes(i.id));
  const [selectedId, setSelectedId] = useState<number>(
    available[0]?.id ?? 0,
  );
  const [qty, setQty] = useState("1");

  if (available.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-gray-300 p-4"
      style={{ background: "#f9fafb" }}
    >
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-600">
          Thêm vật tư
        </label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(Number(e.target.value))}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        >
          {available.map((i) => (
            <option key={i.id} value={i.id}>
              {i.item_name} ({i.unit})
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-600">
          Số lượng
        </label>
        <Input
          type="number"
          min={1}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="w-24 text-sm"
        />
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          const q = parseInt(qty, 10);
          if (selectedId && q > 0) {
            onAdd(selectedId, q);
            setQty("1");
          }
        }}
      >
        Thêm
      </Button>
    </div>
  );
}
