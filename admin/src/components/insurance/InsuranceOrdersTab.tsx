"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useIglooRequests, useRetryIglooRequest } from "@/lib/insurance-hooks";
import {
  formatVnd,
  IGLOO_STATUS_LABEL,
  IGLOO_STATUS_TONE,
  packageLabel,
  sourceLabel,
  statusLabel,
} from "@/lib/insurance-labels";

const PAGE_SIZE = 20;
const STATUS_OPTIONS = ["all", ...Object.keys(IGLOO_STATUS_LABEL)];
const MAX_RETRY = 3;

export function InsuranceOrdersTab() {
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [retryTarget, setRetryTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const { data, isLoading, isError, refetch, isFetching } = useIglooRequests({
    status: status === "all" ? undefined : status,
    page,
    pageSize: PAGE_SIZE,
  });
  const retryMut = useRetryIglooRequest();

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function handleRetry(id: string, name: string) {
    try {
      await retryMut.mutateAsync(id);
      toast.success(`Đã gửi lại đơn cho ${name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Thử lại thất bại");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-56">
          <label className="mb-1 block text-sm font-medium">Trạng thái</label>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v ?? "all");
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "all" ? "Tất cả" : statusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? "Đang tải..." : "Làm mới"}
        </Button>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-10 text-center text-sm text-red-600">
            Lỗi tải danh sách đơn.
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-sm text-stone-500">
            Chưa có đơn nào. Sang tab &ldquo;Tạo bảo hiểm&rdquo; để tạo.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Họ tên</TableHead>
                <TableHead>Giải</TableHead>
                <TableHead>Gói</TableHead>
                <TableHead>Phí</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Số HĐ GIC</TableHead>
                <TableHead>Chứng nhận</TableHead>
                <TableHead>Nguồn</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead>Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.insuredName}</TableCell>
                  <TableCell
                    className="max-w-[160px] truncate"
                    title={r.raceTitle ?? ""}
                  >
                    {r.raceTitle ?? `Giải ${r.mysqlRaceId}`}
                  </TableCell>
                  <TableCell>{packageLabel(r.packageCode)}</TableCell>
                  <TableCell>{formatVnd(r.totalPayment)}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        IGLOO_STATUS_TONE[r.status] ?? "bg-stone-100 text-stone-700"
                      }
                      title={r.errorMessage ?? undefined}
                    >
                      {statusLabel(r.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.gicContractNo ?? "—"}
                  </TableCell>
                  <TableCell>
                    {r.certificateUrl ? (
                      <a
                        className="text-blue-600 underline"
                        href={r.certificateUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Xem PDF
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{sourceLabel(r.source)}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-stone-500">
                    {r.createdAt
                      ? new Date(r.createdAt).toLocaleString("vi-VN")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {r.status === "FAILED" && r.retryCount < MAX_RETRY ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setRetryTarget({ id: r.id, name: r.insuredName })
                        }
                      >
                        Thử lại
                      </Button>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Trước
          </Button>
          <span>
            Trang {page}/{totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Sau
          </Button>
        </div>
      )}

      <AlertDialog
        open={!!retryTarget}
        onOpenChange={(o) => !o && setRetryTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Gửi lại đơn cho {retryTarget?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Đơn sẽ được đưa lại hàng đợi gửi Igloo (tối đa {MAX_RETRY} lần
              thử).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (retryTarget) handleRetry(retryTarget.id, retryTarget.name);
                setRetryTarget(null);
              }}
            >
              Gửi lại
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
