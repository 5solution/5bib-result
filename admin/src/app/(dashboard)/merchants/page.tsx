"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { authHeaders } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Search,
  Pencil,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Clock,
  Star,
} from "lucide-react";

interface Merchant {
  id: number;
  name: string;
  tax_code: string | null;
  is_approved: boolean;
  is_starred: boolean;
  contract_status: "pending" | "active" | "suspended" | "terminated";
  service_fee_rate: number | null;
  manual_fee_per_ticket: number;
  fee_vat_rate: number;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  created_on: string;
}

const CONTRACT_LABELS: Record<
  string,
  { label: string; bg: string; text: string; border: string }
> = {
  pending: { label: "Chờ xử lý", bg: "#fef3c7", text: "#b45309", border: "#fcd34d" },
  active: { label: "Đang hoạt động", bg: "#dcfce7", text: "#15803d", border: "#86efac" },
  suspended: { label: "Tạm dừng", bg: "#ffedd5", text: "#9a3412", border: "#fdba74" },
  terminated: { label: "Đã chấm dứt", bg: "#fee2e2", text: "#b91c1c", border: "#fca5a5" },
};

function ContractBadge({ status }: { status: string }) {
  const c = CONTRACT_LABELS[status] ?? CONTRACT_LABELS.pending;
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border"
      style={{ background: c.bg, color: c.text, borderColor: c.border }}
    >
      {c.label}
    </span>
  );
}

function ApprovalBadge({ approved }: { approved: boolean }) {
  return approved ? (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border"
      style={{ background: "#dcfce7", color: "#15803d", borderColor: "#86efac" }}
    >
      <CheckCircle className="mr-1 size-3" />
      Đã duyệt
    </span>
  ) : (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border"
      style={{ background: "#f3f4f6", color: "#6b7280", borderColor: "#d1d5db" }}
    >
      <Clock className="mr-1 size-3" />
      Chờ duyệt
    </span>
  );
}

export default function MerchantsPage() {
  const { token } = useAuth();
  const router = useRouter();

  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [q, setQ] = useState("");
  const [approval, setApproval] = useState("all");
  const [contractStatus, setContractStatus] = useState("all");
  const [feeStatus, setFeeStatus] = useState("all");
  const [page, setPage] = useState(0);

  const fetchMerchants = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "20",
        ...(q && { q }),
        ...(approval !== "all" && { approval }),
        ...(contractStatus !== "all" && { contract_status: contractStatus }),
        ...(feeStatus !== "all" && { fee_status: feeStatus }),
      });
      const res = await fetch(`/api/merchants?${params}`, {
        headers: authHeaders(token).headers,
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setMerchants(json.data?.list ?? []);
      setTotal(json.data?.total ?? 0);
      setTotalPages(json.data?.totalPages ?? 0);
    } catch {
      toast.error("Không thể tải danh sách merchant");
    } finally {
      setLoading(false);
    }
  }, [token, q, approval, contractStatus, feeStatus, page]);

  useEffect(() => {
    fetchMerchants();
  }, [fetchMerchants]);

  async function toggleStar(merchantId: number) {
    if (!token) return;
    try {
      const res = await fetch(`/api/merchants/${merchantId}/star`, {
        method: "PATCH",
        headers: authHeaders(token).headers,
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      const updated = json.data;
      // Update in-place to avoid full refetch
      setMerchants(prev => {
        const next = prev.map(m => m.id === merchantId ? { ...m, is_starred: updated.is_starred } : m);
        // Re-sort: starred first
        next.sort((a, b) => {
          if (a.is_starred !== b.is_starred) return a.is_starred ? -1 : 1;
          return 0;
        });
        return next;
      });
    } catch {
      toast.error("Không thể cập nhật");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900">Quản lý Merchant</h1>
        <p className="text-sm text-muted-foreground">
          {total} merchant từ nền tảng 5BIB
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex flex-col gap-1 flex-1 min-w-[200px] max-w-sm">
          <span className="text-xs font-medium text-muted-foreground">Tìm kiếm</span>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tên, email, mã số thuế..."
              value={q}
              onChange={e => { setQ(e.target.value); setPage(0); }}
              className="pl-9"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Duyệt platform</span>
          <Select value={approval} onValueChange={v => { if (v) { setApproval(v); setPage(0); } }} items={{ all: "Tất cả", approved: "Đã duyệt", pending: "Chờ duyệt" }}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="approved">Đã duyệt</SelectItem>
              <SelectItem value="pending">Chờ duyệt</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Hợp đồng</span>
          <Select value={contractStatus} onValueChange={v => { if (v) { setContractStatus(v); setPage(0); } }} items={{ all: "Tất cả", pending: "Chờ xử lý", active: "Đang hoạt động", suspended: "Tạm dừng", terminated: "Đã chấm dứt" }}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="pending">Chờ xử lý</SelectItem>
              <SelectItem value="active">Đang hoạt động</SelectItem>
              <SelectItem value="suspended">Tạm dừng</SelectItem>
              <SelectItem value="terminated">Đã chấm dứt</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Phí dịch vụ</span>
          <Select value={feeStatus} onValueChange={v => { if (v) { setFeeStatus(v); setPage(0); } }} items={{ all: "Tất cả", has_fee: "Đã cấu hình", no_fee: "Chưa có phí" }}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="has_fee">Đã cấu hình</SelectItem>
              <SelectItem value="no_fee">Chưa có phí</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Merchant</TableHead>
                <TableHead className="hidden md:table-cell">Email liên hệ</TableHead>
                <TableHead>Phí dịch vụ</TableHead>
                <TableHead className="hidden sm:table-cell">Duyệt platform</TableHead>
                <TableHead className="hidden lg:table-cell">Hợp đồng</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {merchants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                    Không tìm thấy merchant nào
                  </TableCell>
                </TableRow>
              ) : (
                merchants.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="w-10 pr-0">
                      <button
                        onClick={() => toggleStar(m.id)}
                        className="hover:scale-110 transition-transform"
                        title={m.is_starred ? "Bỏ đánh dấu" : "Đánh dấu quan trọng"}
                      >
                        <Star className={`size-4 ${m.is_starred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40 hover:text-yellow-400"}`} />
                      </button>
                    </TableCell>
                    <TableCell>
                      <div>
                        <button
                          className="font-medium hover:underline text-left"
                          onClick={() => router.push(`/merchants/${m.id}`)}
                        >
                          {m.name}
                        </button>
                        {m.tax_code && (
                          <p className="text-xs text-muted-foreground">MST: {m.tax_code}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                      {m.contact_email ?? "—"}
                    </TableCell>
                    <TableCell>
                      {m.service_fee_rate != null ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium">{m.service_fee_rate}%</span>
                          <span className="text-xs text-muted-foreground">
                            {m.manual_fee_per_ticket.toLocaleString("vi-VN")}đ/vé · VAT {m.fee_vat_rate}%
                          </span>
                        </div>
                      ) : (
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border"
                          style={{ background: "#fee2e2", color: "#b91c1c", borderColor: "#fca5a5" }}
                        >
                          <AlertTriangle className="mr-1 size-3" />
                          Chưa có phí
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <ApprovalBadge approved={m.is_approved} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <ContractBadge status={m.contract_status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => router.push(`/merchants/${m.id}`)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Trang {page + 1} / {totalPages} · {total} merchant
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="size-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
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
