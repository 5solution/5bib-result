"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { authHeaders } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CheckCircle,
} from "lucide-react";

interface Reconciliation {
  _id: string;
  tenant_id: number;
  mysql_race_id: number;
  race_title: string;
  tenant_name: string;
  period_start: string;
  period_end: string;
  fee_rate_applied: number | null;
  net_revenue: number;
  fee_amount: number;
  fee_vat_amount: number;
  payout_amount: number;
  status: "draft" | "reviewed" | "sent" | "signed" | "completed";
  xlsx_url: string | null;
  docx_url: string | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: "Nháp", className: "bg-zinc-500/20 text-zinc-400" },
  reviewed: { label: "Đã xem xét", className: "bg-blue-500/20 text-blue-400" },
  sent: { label: "Đã gửi", className: "bg-yellow-500/20 text-yellow-400" },
  signed: { label: "Đã ký", className: "bg-green-500/20 text-green-400" },
  completed: { label: "Hoàn tất", className: "bg-green-600/20 text-green-300" },
};

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <Badge className={c.className}>
      {status === "completed" && <CheckCircle className="mr-1 size-3" />}
      {c.label}
    </Badge>
  );
}

function formatVnd(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + " đ";
}

function formatDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatPeriod(start: string, end: string) {
  if (!start || !end) return "—";
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) =>
    d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${fmt(s)} – ${fmt(e)}`;
}

export default function ReconciliationsPage() {
  const { token } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<Reconciliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);

  const fetchItems = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page + 1),
        limit: "20",
        ...(status !== "all" && { status }),
      });
      const res = await fetch(`/api/reconciliations?${params}`, {
        headers: authHeaders(token).headers,
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      // Backend returns { data: [...], total: N }
      setItems(json.data ?? []);
      setTotal(json.total ?? 0);
      setTotalPages(Math.ceil((json.total ?? 0) / 20));
    } catch {
      toast.error("Không thể tải danh sách đối soát");
    } finally {
      setLoading(false);
    }
  }, [token, status, page]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">Đối soát doanh thu</h1>
          <p className="text-sm text-muted-foreground">{total} bản ghi đối soát</p>
        </div>
        <Link href="/reconciliations/new">
          <Button>
            <Plus className="mr-2 size-4" />
            Tạo đối soát mới
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Trạng thái</span>
          <Select value={status} onValueChange={(v) => { if (v) { setStatus(v); setPage(0); } }} items={{ all: "Tất cả trạng thái", draft: "Nháp", reviewed: "Đã xem xét", sent: "Đã gửi", signed: "Đã ký", completed: "Hoàn tất" }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả trạng thái</SelectItem>
              <SelectItem value="draft">Nháp</SelectItem>
              <SelectItem value="reviewed">Đã xem xét</SelectItem>
              <SelectItem value="sent">Đã gửi</SelectItem>
              <SelectItem value="signed">Đã ký</SelectItem>
              <SelectItem value="completed">Hoàn tất</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Merchant</TableHead>
                <TableHead>Giải đấu</TableHead>
                <TableHead className="hidden md:table-cell">Kỳ đối soát</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Doanh thu thực</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Phí</TableHead>
                <TableHead className="text-right">Thanh toán</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="hidden sm:table-cell">Ngày tạo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                    Không tìm thấy bản ghi đối soát nào
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow
                    key={item._id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/reconciliations/${item._id}`)}
                  >
                    <TableCell>
                      <span className="font-medium">{item.tenant_name}</span>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{item.race_title}</p>
                        <p className="text-xs text-muted-foreground">ID: {item.mysql_race_id}</p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {formatPeriod(item.period_start, item.period_end)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-right text-sm">
                      {formatVnd(item.net_revenue)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-right text-sm">
                      {formatVnd(item.fee_amount + item.fee_vat_amount)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatVnd(item.payout_amount)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {formatDate(item.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Trang {page + 1}/{totalPages} · {total} bản ghi
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
