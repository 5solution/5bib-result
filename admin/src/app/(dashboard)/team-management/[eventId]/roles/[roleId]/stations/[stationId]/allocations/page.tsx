"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  getStationAllocations,
  upsertStationAllocations,
  unlockAllocation,
  listSupplements,
  createSupplement,
  listStations,
  listSupplyItems,
  type AllocationRow,
  type Station,
  type SupplementRow,
  type SupplyItem,
} from "@/lib/team-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Save,
  Unlock,
  Plus,
  Lock,
  Package,
} from "lucide-react";
import { toast } from "sonner";

export default function AllocationsPage(): React.ReactElement {
  const router = useRouter();
  const params = useParams<{ eventId: string; roleId: string; stationId: string }>();
  const eventId = Number(params.eventId);
  const roleId = Number(params.roleId);
  const stationId = Number(params.stationId);
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();

  const [station, setStation] = useState<Station | null>(null);
  const [rows, setRows] = useState<AllocationRow[] | null>(null);
  const [items, setItems] = useState<SupplyItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Local edits: item_id → allocated_qty
  const [edits, setEdits] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);
  const [supplementTarget, setSupplementTarget] = useState<AllocationRow | null>(null);
  const [unlockTarget, setUnlockTarget] = useState<AllocationRow | null>(null);
  const [supplementsByAlloc, setSupplementsByAlloc] = useState<
    Record<number, SupplementRow[]>
  >({});

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const [allocRows, stationList, itemList] = await Promise.all([
        getStationAllocations(token, stationId),
        listStations(token, eventId, roleId),
        listSupplyItems(token, eventId),
      ]);
      setRows(allocRows);
      setStation(stationList.find((s) => s.id === stationId) ?? null);
      setItems(itemList);
      setEdits({});
      // Load supplements in parallel for each allocation
      const supMap: Record<number, SupplementRow[]> = {};
      await Promise.all(
        allocRows.map(async (r) => {
          try {
            supMap[r.id] = await listSupplements(token, r.id);
          } catch {
            supMap[r.id] = [];
          }
        }),
      );
      setSupplementsByAlloc(supMap);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [token, stationId, eventId, roleId]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/login");
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  const dirtyCount = Object.keys(edits).length;

  // Merge rows: include unseen items from `items` for potential new allocations
  const mergedRows = useMemo(() => {
    if (!rows) return [];
    const byItem = new Map<number, AllocationRow>();
    for (const r of rows) byItem.set(r.item_id, r);
    const merged: Array<AllocationRow | { item_id: number; item_name: string; unit: string; placeholder: true }> = [];
    for (const r of rows) merged.push(r);
    // Allow adding items not yet allocated — only if useful:
    for (const it of items) {
      if (!byItem.has(it.id)) {
        merged.push({
          item_id: it.id,
          item_name: it.item_name,
          unit: it.unit,
          placeholder: true,
        });
      }
    }
    return merged;
  }, [rows, items]);

  async function handleSaveAll(): Promise<void> {
    if (!token || dirtyCount === 0) return;
    setSaving(true);
    try {
      const allocations = Object.entries(edits).map(([item_id, qty]) => ({
        item_id: Number(item_id),
        allocated_qty: qty,
      }));
      await upsertStationAllocations(token, stationId, { allocations });
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
        <Link href={`/team-management/${eventId}/roles/${roleId}/stations`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 size-4" /> Trạm
          </Button>
        </Link>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-gradient flex items-center gap-2">
          <Package className="size-6 sm:size-7 text-blue-600" />
          Vật tư tại Trạm {station?.station_name ?? `#${stationId}`}
        </h1>
        <div className="flex-1" />
        <Button
          onClick={() => void handleSaveAll()}
          disabled={dirtyCount === 0 || saving}
        >
          <Save className="mr-2 size-4" />
          {saving ? "Đang lưu..." : dirtyCount === 0 ? "Lưu phân bổ" : `Lưu (${dirtyCount})`}
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {rows === null ? (
        <Skeleton className="h-64" />
      ) : mergedRows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">
            Chưa có vật tư trong hệ thống. Tạo vật tư ở trang Kho vật tư trước.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vật tư</TableHead>
                  <TableHead className="w-36">Phân bổ</TableHead>
                  <TableHead className="w-24">Nhận</TableHead>
                  <TableHead className="w-28">Thiếu hụt</TableHead>
                  <TableHead className="w-36 text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mergedRows.map((r) => {
                  const isPlaceholder = "placeholder" in r && r.placeholder === true;
                  const alloc = isPlaceholder ? null : (r as AllocationRow);
                  const currentVal =
                    edits[r.item_id] !== undefined
                      ? edits[r.item_id]
                      : alloc?.allocated_qty ?? 0;
                  const isDirty = r.item_id in edits;
                  const locked = alloc?.is_locked ?? false;
                  return (
                    <TableRow key={r.item_id}>
                      <TableCell>
                        <div className="font-medium flex items-center gap-2">
                          {locked ? (
                            <Lock className="size-3.5 text-muted-foreground" />
                          ) : null}
                          {r.item_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {r.unit}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={currentVal}
                          disabled={locked}
                          onChange={(e) => {
                            const v = Number(e.target.value) || 0;
                            setEdits((prev) => {
                              const next = { ...prev };
                              if (v === (alloc?.allocated_qty ?? 0)) {
                                delete next[r.item_id];
                              } else {
                                next[r.item_id] = v;
                              }
                              return next;
                            });
                          }}
                          style={{
                            background: isDirty ? "#eff6ff" : undefined,
                            borderColor: isDirty ? "#2563eb" : undefined,
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-sm">
                        {alloc?.confirmed_qty ?? "—"}
                      </TableCell>
                      <TableCell>
                        {alloc?.shortage_qty != null && alloc.shortage_qty > 0 ? (
                          <Badge
                            style={{
                              background: "#fee2e2",
                              color: "#b91c1c",
                              border: "none",
                            }}
                          >
                            Thiếu {alloc.shortage_qty}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        {alloc && locked ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setUnlockTarget(alloc)}
                          >
                            <Unlock className="size-3.5 mr-1" /> Unlock
                          </Button>
                        ) : null}
                        {alloc ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSupplementTarget(alloc)}
                          >
                            <Plus className="size-3.5 mr-1" /> Bổ sung
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Supplements section */}
          <section className="space-y-2">
            <h2 className="font-semibold text-lg">Đợt bổ sung</h2>
            {rows.filter((r) => (supplementsByAlloc[r.id]?.length ?? 0) > 0)
              .length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Chưa có đợt bổ sung nào.
              </p>
            ) : (
              <div className="space-y-2">
                {rows.map((r) => {
                  const sups = supplementsByAlloc[r.id] ?? [];
                  if (sups.length === 0) return null;
                  return (
                    <div
                      key={r.id}
                      className="rounded-lg border bg-white p-3"
                    >
                      <div className="font-medium text-sm mb-1">
                        {r.item_name} <span className="text-muted-foreground">({r.unit})</span>
                      </div>
                      <div className="space-y-1">
                        {sups.map((s) => (
                          <div
                            key={s.id}
                            className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
                          >
                            <Badge variant="outline">Đợt {s.round_number}</Badge>
                            <span>Gửi: {s.qty}</span>
                            {s.confirmed_qty != null ? (
                              <span>· Nhận: {s.confirmed_qty}</span>
                            ) : (
                              <span>· <i>Chưa xác nhận</i></span>
                            )}
                            {s.note ? (
                              <span className="italic">"{s.note}"</span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      <SupplementDialog
        allocation={supplementTarget}
        onOpenChange={(o) => {
          if (!o) setSupplementTarget(null);
        }}
        onSaved={() => {
          setSupplementTarget(null);
          void load();
        }}
      />

      <UnlockDialog
        allocation={unlockTarget}
        onOpenChange={(o) => {
          if (!o) setUnlockTarget(null);
        }}
        onSaved={() => {
          setUnlockTarget(null);
          void load();
        }}
      />
    </div>
  );
}

function SupplementDialog({
  allocation,
  onOpenChange,
  onSaved,
}: {
  allocation: AllocationRow | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}): React.ReactElement {
  const { token } = useAuth();
  const [qty, setQty] = useState(0);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (allocation) {
      setQty(0);
      setNote("");
    }
  }, [allocation]);

  async function handleSubmit(): Promise<void> {
    if (!token || !allocation) return;
    if (qty <= 0) {
      toast.error("Số lượng phải > 0");
      return;
    }
    setSaving(true);
    try {
      await createSupplement(token, allocation.id, qty, note || null);
      toast.success("Đã tạo đợt bổ sung");
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={allocation != null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Bổ sung — {allocation?.item_name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Số lượng bổ sung ({allocation?.unit})</Label>
            <Input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label>Ghi chú (tùy chọn)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="VD: Gửi do trạm bị thiếu lúc 10h"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            disabled={saving}
            onClick={() => {
              void handleSubmit();
            }}
          >
            {saving ? "Đang lưu..." : "Tạo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UnlockDialog({
  allocation,
  onOpenChange,
  onSaved,
}: {
  allocation: AllocationRow | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}): React.ReactElement {
  const { token } = useAuth();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (allocation) setNote("");
  }, [allocation]);

  async function handleSubmit(): Promise<void> {
    if (!token || !allocation) return;
    if (!note.trim()) {
      toast.error("Ghi chú lý do unlock là bắt buộc");
      return;
    }
    setSaving(true);
    try {
      await unlockAllocation(token, allocation.id, note.trim());
      toast.success("Đã mở khóa allocation");
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={allocation != null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mở khóa — {allocation?.item_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Mở khóa để cho phép chỉnh sửa allocation đã được xác nhận. Admin note
            sẽ được lưu để audit.
          </p>
          <div>
            <Label>Ghi chú (bắt buộc)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="VD: Trạm bị thiếu → cần điều chỉnh lại số lượng"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            disabled={saving}
            onClick={() => {
              void handleSubmit();
            }}
          >
            {saving ? "Đang lưu..." : "Mở khóa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
