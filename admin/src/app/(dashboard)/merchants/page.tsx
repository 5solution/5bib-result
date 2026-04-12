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
} from "lucide-react";

interface Merchant {
  id: number;
  name: string;
  tax_code: string | null;
  is_approved: boolean;
  contract_status: "pending" | "active" | "suspended" | "terminated";
  service_fee_rate: number | null;
  manual_fee_per_ticket: number;
  fee_vat_rate: number;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  created_on: string;
}

const CONTRACT_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: "Chờ xử lý", className: "bg-yellow-500/20 text-yellow-400" },
  active: { label: "Đang hoạt động", className: "bg-green-500/20 text-green-400" },
  suspended: { label: "Tạm dừng", className: "bg-orange-500/20 text-orange-400" },
  terminated: { label: "Đã chấm dứt", className: "bg-red-500/20 text-red-400" },
};

function ContractBadge({ status }: { status: string }) {
  const c = CONTRACT_LABELS[status] ?? CONTRACT_LABELS.pending;
  return <Badge className={c.className}>{c.label}</Badge>;
}

function ApprovalBadge({ approved }: { approved: boolean }) {
  return approved ? (
    <Badge className="bg-green-500/20 text-green-400">
      <CheckCircle className="mr-1 size-3" />
      Đã duyệt
    </Badge>
  ) : (
    <Badge className="bg-zinc-500/20 text-zinc-400">
      <Clock className="mr-1 size-3" />
      Chờ duyệt
    </Badge>
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Quản lý Merchant</h1>
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
          <Select value={approval} onValueChange={v => { if (v) { setApproval(v); setPage(0); } }}>
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
          <Select value={contractStatus} onValueChange={v => { if (v) { setContractStatus(v); setPage(0); } }}>
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
          <Select value={feeStatus} onValueChange={v => { if (v) { setFeeStatus(v); setPage(0); } }}>
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
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    Không tìm thấy merchant nào
                  </TableCell>
                </TableRow>
              ) : (
                merchants.map(m => (
                  <TableRow key={m.id}>
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
                        <Badge className="bg-red-500/20 text-red-400">
                          <AlertTriangle className="mr-1 size-3" />
                          Chưa có phí
                        </Badge>
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
