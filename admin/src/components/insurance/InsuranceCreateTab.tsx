"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useCreateIglooRequests,
  useEligibleAthletes,
  useIglooRaces,
} from "@/lib/insurance-hooks";
import { formatVnd, IGLOO_SKIP_REASON_LABEL } from "@/lib/insurance-labels";

const PER_ORDER_VND = 10000;

export function InsuranceCreateTab() {
  const [raceId, setRaceId] = useState<number | undefined>(undefined);
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  // debounce search 300ms
  useEffect(() => {
    const t = setTimeout(() => setQ(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: races, isLoading: racesLoading } = useIglooRaces();
  const {
    data: eligible,
    isLoading: athletesLoading,
    isError,
  } = useEligibleAthletes({ raceId, q, page: 1, pageSize: 50 });
  const createMut = useCreateIglooRequests();

  const rows = eligible?.items ?? [];
  const selectableIds = rows.filter((r) => !r.hasOrder).map((r) => r.athletesId);
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  const totalPremium = useMemo(() => selected.size * PER_ORDER_VND, [selected]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) selectableIds.forEach((id) => next.delete(id));
      else selectableIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function handleCreate() {
    if (!raceId || selected.size === 0) return;
    try {
      const res = await createMut.mutateAsync({
        raceId,
        athleteIds: Array.from(selected),
      });
      const skipMsg = res.skipped.length
        ? ` (${res.skipped.length} bỏ qua: ${res.skipped
            .map((s) => IGLOO_SKIP_REASON_LABEL[s.reason] ?? s.reason)
            .join(", ")})`
        : "";
      toast.success(`Đã tạo ${res.created} đơn${skipMsg}`);
      setSelected(new Set());
      setConfirmOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Tạo đơn thất bại — thử lại",
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-72">
          <label className="mb-1 block text-sm font-medium">Chọn giải</label>
          {racesLoading ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <Select
              value={raceId ? String(raceId) : undefined}
              onValueChange={(v) => {
                setRaceId(Number(v));
                setSelected(new Set());
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="— Chọn giải sắp diễn ra —" />
              </SelectTrigger>
              <SelectContent>
                {(races ?? []).map((r) => (
                  <SelectItem key={r.mysqlRaceId} value={String(r.mysqlRaceId)}>
                    {r.title ?? `Giải ${r.mysqlRaceId}`}
                    {r.eventStartDate
                      ? ` — ${new Date(r.eventStartDate).toLocaleDateString("vi-VN")}`
                      : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="w-72">
          <label className="mb-1 block text-sm font-medium">Tìm VĐV</label>
          <Input
            placeholder="Tên / BIB / CCCD"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            disabled={!raceId}
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        {!raceId ? (
          <div className="p-10 text-center text-sm text-stone-500">
            Chọn một giải để xem danh sách VĐV đủ điều kiện.
          </div>
        ) : athletesLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-10 text-center text-sm text-red-600">
            Lỗi tải danh sách VĐV.
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-stone-500">
            {q
              ? "Không có VĐV khớp tìm kiếm."
              : "Giải này chưa có VĐV đủ điều kiện."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Chọn tất cả"
                  />
                </TableHead>
                <TableHead>Họ tên</TableHead>
                <TableHead>BIB</TableHead>
                <TableHead>Giới tính</TableHead>
                <TableHead>Năm sinh</TableHead>
                <TableHead>CCCD</TableHead>
                <TableHead>SĐT</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => (
                <TableRow key={a.athletesId}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(a.athletesId)}
                      onCheckedChange={() => toggle(a.athletesId)}
                      disabled={a.hasOrder}
                      aria-label={`Chọn ${a.fullName}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{a.fullName}</TableCell>
                  <TableCell className="font-mono">{a.bib ?? "—"}</TableCell>
                  <TableCell>{a.gender}</TableCell>
                  <TableCell>{a.dateOfBirth?.slice(0, 4) ?? "—"}</TableCell>
                  <TableCell className="font-mono">{a.idCard}</TableCell>
                  <TableCell className="font-mono">{a.phone}</TableCell>
                  <TableCell className="max-w-[180px] truncate" title={a.email}>
                    {a.email}
                  </TableCell>
                  <TableCell>
                    {a.hasOrder ? (
                      <Badge className="bg-stone-200 text-stone-600">
                        Đã có đơn
                      </Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-700">
                        Chưa có đơn
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Footer sticky */}
      <div className="sticky bottom-0 flex items-center justify-between rounded-md border bg-white px-4 py-3 shadow-sm">
        <div className="text-sm">
          Đã chọn <strong>{selected.size}</strong> VĐV — Tổng phí dự kiến:{" "}
          <strong>{formatVnd(totalPremium)}</strong>
        </div>
        <Button
          disabled={selected.size === 0}
          onClick={() => setConfirmOpen(true)}
        >
          Tạo bảo hiểm ({selected.size})
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xác nhận tạo bảo hiểm</DialogTitle>
            <DialogDescription>
              Tạo <strong>{selected.size}</strong> đơn bảo hiểm thật — 5Solution
              chịu phí <strong>{formatVnd(totalPremium)}</strong> (
              {formatVnd(PER_ORDER_VND)}/đơn). Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Huỷ
            </Button>
            <Button
              className="bg-orange-600 hover:bg-orange-700"
              disabled={createMut.isPending}
              onClick={handleCreate}
            >
              {createMut.isPending ? "Đang tạo..." : "Xác nhận"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
