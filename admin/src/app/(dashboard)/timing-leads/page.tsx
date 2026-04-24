"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { authHeaders } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Download, Eye } from "lucide-react";

type LeadStatus = "new" | "contacted" | "quoted" | "closed_won" | "closed_lost";
type LeadSource = "timing" | "solution" | "5sport-btc" | "5sport-athlete";

interface TimingLead {
  _id: string;
  lead_number: number;
  full_name: string;
  phone: string;
  email?: string;
  organization: string;
  athlete_count_range: string;
  package_interest: "basic" | "advanced" | "professional" | "unspecified";
  notes: string;
  source: LeadSource;
  status: LeadStatus;
  is_archived: boolean;
  staff_notes: string;
  city?: string;
  sport_type?: string;
  tournament_scale?: string;
  tournament_timing?: string;
  createdAt: string;
  updatedAt: string;
}

interface ListResponse {
  items: TimingLead[];
  total: number;
  page: number;
  limit: number;
}

const STATUS_LABEL: Record<LeadStatus, { label: string; className: string }> = {
  new: { label: "Mới", className: "bg-blue-100 text-blue-700 border-blue-200" },
  contacted: { label: "Đã liên hệ", className: "bg-amber-100 text-amber-700 border-amber-200" },
  quoted: { label: "Đã báo giá", className: "bg-purple-100 text-purple-700 border-purple-200" },
  closed_won: { label: "Chốt deal", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  closed_lost: { label: "Không chốt", className: "bg-gray-100 text-gray-600 border-gray-200" },
};

const PACKAGE_LABEL: Record<TimingLead["package_interest"], string> = {
  basic: "Basic",
  advanced: "Advanced",
  professional: "Professional",
  unspecified: "Chưa xác định",
};

const SOURCE_BADGE: Record<LeadSource, { label: string; className: string }> = {
  timing: { label: "Timing", className: "bg-sky-100 text-sky-700 border-sky-200" },
  solution: { label: "Solution", className: "bg-pink-100 text-pink-700 border-pink-200" },
  "5sport-btc": { label: "5Sport BTC", className: "bg-lime-100 text-lime-700 border-lime-200" },
  "5sport-athlete": { label: "5Sport VĐV", className: "bg-violet-100 text-violet-700 border-violet-200" },
};

export default function TimingLeadsPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<TimingLead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<LeadSource | "all">("all");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchLeads = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (q.trim()) params.set("q", q.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (sourceFilter !== "all") params.set("source", sourceFilter);
      if (includeArchived) params.set("include_archived", "true");
      const res = await fetch(`/api/admin/timing/leads?${params.toString()}`, {
        ...authHeaders(token),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data: ListResponse = await res.json();
      setItems(data.items);
      setTotal(data.total);
    } catch {
      toast.error("Không tải được danh sách lead");
    } finally {
      setLoading(false);
    }
  }, [token, page, limit, q, statusFilter, sourceFilter, includeArchived]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const onExport = async () => {
    if (!token) return;
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (sourceFilter !== "all") params.set("source", sourceFilter);
      if (includeArchived) params.set("include_archived", "true");
      const res = await fetch(
        `/api/admin/timing/leads/export?${params.toString()}`,
        { ...authHeaders(token) },
      );
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      a.download = `timing-leads-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Đã export CSV");
    } catch {
      toast.error("Không export được CSV");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Timing Leads</h1>
          <p className="text-sm text-muted-foreground">
            Danh sách yêu cầu báo giá từ landing timing.5bib.com
          </p>
        </div>
        <Button onClick={onExport} disabled={exporting || items.length === 0} variant="outline">
          <Download className="mr-2 size-4" />
          {exporting ? "Đang export..." : "Export CSV"}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div className="flex-1 min-w-[220px]">
          <Label htmlFor="q">Tìm kiếm</Label>
          <Input
            id="q"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Tên / SĐT / tổ chức"
          />
        </div>
        <div>
          <Label>Trạng thái</Label>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v as LeadStatus | "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="min-w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="new">Mới</SelectItem>
              <SelectItem value="contacted">Đã liên hệ</SelectItem>
              <SelectItem value="quoted">Đã báo giá</SelectItem>
              <SelectItem value="closed_won">Chốt deal</SelectItem>
              <SelectItem value="closed_lost">Không chốt</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Nguồn</Label>
          <Select
            value={sourceFilter}
            onValueChange={(v) => {
              setSourceFilter(v as LeadSource | "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="min-w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả nguồn</SelectItem>
              <SelectItem value="timing">Timing</SelectItem>
              <SelectItem value="solution">Solution</SelectItem>
              <SelectItem value="5sport-btc">5Sport BTC</SelectItem>
              <SelectItem value="5sport-athlete">5Sport VĐV</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => {
              setIncludeArchived(e.target.checked);
              setPage(1);
            }}
          />
          Hiện archived
        </label>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">#</TableHead>
              <TableHead>Họ tên</TableHead>
              <TableHead>SĐT</TableHead>
              <TableHead>Tổ chức</TableHead>
              <TableHead>Quy mô</TableHead>
              <TableHead>Gói</TableHead>
              <TableHead>Nguồn</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Ngày gửi</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={10}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-10">
                  Chưa có lead nào
                </TableCell>
              </TableRow>
            ) : (
              items.map((it) => {
                const s = STATUS_LABEL[it.status];
                return (
                  <TableRow key={it._id} className={it.is_archived ? "opacity-60" : ""}>
                    <TableCell className="font-mono text-xs">#{it.lead_number}</TableCell>
                    <TableCell className="font-medium">{it.full_name}</TableCell>
                    <TableCell className="font-mono text-xs">{it.phone}</TableCell>
                    <TableCell>{it.organization}</TableCell>
                    <TableCell className="text-xs">{it.athlete_count_range || "-"}</TableCell>
                    <TableCell className="text-xs">{PACKAGE_LABEL[it.package_interest]}</TableCell>
                    <TableCell>
                      {(() => {
                        const src = SOURCE_BADGE[it.source ?? "timing"];
                        return (
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${src.className}`}>
                            {src.label}
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${s.className}`}
                      >
                        {s.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(it.createdAt).toLocaleString("vi-VN", {
                        timeZone: "Asia/Ho_Chi_Minh",
                      })}
                    </TableCell>
                    <TableCell>
                      <Link href={`/timing-leads/${it._id}`}>
                        <Button size="sm" variant="ghost">
                          <Eye className="size-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Tổng: <strong>{total}</strong> lead · Trang {page}/{totalPages}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
