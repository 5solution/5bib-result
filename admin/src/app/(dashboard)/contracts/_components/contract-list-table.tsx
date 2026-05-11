"use client";

/**
 * F-024 Contract List Table — DataTable filter Type/Status/Partner/Race/Date,
 * pagination 20.
 *
 * Server-driven filter via `listContracts({ ... })`. Real-time search via
 * 300ms debounce.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ContractStatusBadge } from "./contract-status-badge";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  RefreshCw,
  Eye,
} from "lucide-react";
import {
  listContracts,
  formatVND,
  type ContractType,
  type ContractStatus,
  type PaginatedContracts,
} from "@/lib/contracts-api";

const TYPE_LABEL: Record<ContractType, string> = {
  TICKET_SALES: "Bán vé",
  TIMING: "Tính giờ",
  RACEKIT: "Racekit",
  OPERATIONS: "Vận hành",
};

const PAGE_SIZE = 20;

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function ContractListTable() {
  const router = useRouter();
  const [data, setData] = useState<PaginatedContracts | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState<ContractType | "ALL">("ALL");
  const [filterStatus, setFilterStatus] = useState<ContractStatus | "ALL">(
    "ALL",
  );
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounced(searchInput, 300);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listContracts({
        contractType: filterType === "ALL" ? undefined : filterType,
        status: filterStatus === "ALL" ? undefined : filterStatus,
        q: debouncedSearch.trim() || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setData(res);
    } catch (err) {
      toast.error(`Không tải được danh sách: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterStatus, debouncedSearch, page]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          Hợp đồng dịch vụ
        </h1>
        <Button
          onClick={() => router.push("/contracts/create")}
          data-testid="btn-create-contract"
        >
          <Plus className="size-4" /> Tạo hợp đồng mới
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-64 flex-1 sm:max-w-sm">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted,#78716C)]" />
          <Input
            value={searchInput}
            onChange={(e) => {
              setPage(1);
              setSearchInput(e.target.value);
            }}
            placeholder="Tìm theo số HĐ / đối tác / race"
            className="pl-8"
            aria-label="Tìm hợp đồng"
          />
        </div>
        <Select
          value={filterType}
          onValueChange={(v) => {
            setPage(1);
            setFilterType(v as ContractType | "ALL");
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tất cả loại</SelectItem>
            <SelectItem value="TICKET_SALES">Bán vé</SelectItem>
            <SelectItem value="TIMING">Tính giờ</SelectItem>
            <SelectItem value="RACEKIT">Racekit</SelectItem>
            <SelectItem value="OPERATIONS">Vận hành</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filterStatus}
          onValueChange={(v) => {
            setPage(1);
            setFilterStatus(v as ContractStatus | "ALL");
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
            <SelectItem value="DRAFT">Nháp</SelectItem>
            <SelectItem value="ACTIVE">Đang hiệu lực</SelectItem>
            <SelectItem value="COMPLETED">Hoàn thành</SelectItem>
            <SelectItem value="CANCELLED">Huỷ</SelectItem>
            <SelectItem value="SENT">Đã gửi báo giá</SelectItem>
            <SelectItem value="ACCEPTED">Báo giá chấp nhận</SelectItem>
            <SelectItem value="REJECTED">Từ chối</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={load} aria-label="Tải lại">
          <RefreshCw className="size-4" />
        </Button>
      </div>

      <div className="rounded-lg border border-[var(--border,#E7E2D9)] bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Số hợp đồng</TableHead>
              <TableHead>Loại</TableHead>
              <TableHead>Đối tác</TableHead>
              <TableHead>Race</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="text-right">Tổng giá trị</TableHead>
              <TableHead>Ngày ký</TableHead>
              <TableHead aria-label="Actions" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <>
                {Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </>
            )}
            {!loading && data && data.items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-12 text-center text-[var(--text-muted,#78716C)]"
                >
                  Chưa có hợp đồng nào — bấm "Tạo hợp đồng mới" để bắt đầu
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              data?.items.map((c) => (
                <TableRow
                  key={c._id}
                  className="cursor-pointer hover:bg-[#FAF8F5]"
                  onClick={() => router.push(`/contracts/${c._id}`)}
                  data-testid={`contract-row-${c._id}`}
                >
                  <TableCell className="font-mono text-xs">
                    {c.contractNumber || "—"}
                  </TableCell>
                  <TableCell>{TYPE_LABEL[c.contractType]}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {c.client?.entityName || "—"}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {c.raceName || "—"}
                  </TableCell>
                  <TableCell>
                    <ContractStatusBadge status={c.status} />
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatVND(c.totalAmount)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {c.signDate?.slice(0, 10) || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/contracts/${c._id}`);
                      }}
                      aria-label="Xem chi tiết"
                    >
                      <Eye className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-end gap-3 text-sm">
          <span className="text-[var(--text-muted,#78716C)]">
            Trang {page} / {totalPages} · Tổng {data.total}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="size-4" /> Trước
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Sau <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
