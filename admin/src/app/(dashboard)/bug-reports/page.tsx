"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import "@/lib/api";
import {
  bugReportsAdminControllerList,
  bugReportsAdminControllerStats,
} from "@/lib/api-generated";
import type {
  BugReportAdminDto,
  BugReportStatsDto,
  PaginatedBugReportsAdminDto,
} from "@/lib/api-generated";
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bug, Search, AlertTriangle, Clock, CheckCircle2, ListChecks } from "lucide-react";

type BugStatusFilter = "all" | "new" | "triaged" | "in_progress" | "resolved" | "wont_fix" | "duplicate" | "reopened";
type BugSeverityFilter = "all" | "critical" | "high" | "medium" | "low" | "unknown";
type BugCategoryFilter = "all" | "payment" | "race_result" | "bib_avatar" | "account_login" | "ui_display" | "mobile_app" | "other";

const STATUS_LABEL: Record<string, string> = {
  new: "Mới",
  triaged: "Đã triage",
  in_progress: "Đang xử lý",
  resolved: "Đã giải quyết",
  wont_fix: "Không fix",
  duplicate: "Trùng lặp",
  reopened: "Reopen",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  new: "default",
  triaged: "secondary",
  in_progress: "default",
  resolved: "outline",
  wont_fix: "outline",
  duplicate: "outline",
  reopened: "destructive",
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: "🔴 Khẩn cấp",
  high: "🟠 Cao",
  medium: "🟡 Trung bình",
  low: "🟢 Thấp",
  unknown: "❔ Không rõ",
};

const CATEGORY_LABEL: Record<string, string> = {
  payment: "Thanh toán",
  race_result: "Kết quả",
  bib_avatar: "BIB & Avatar",
  account_login: "Tài khoản",
  ui_display: "UI/Hiển thị",
  mobile_app: "App di động",
  other: "Khác",
};

export default function BugReportsListPage() {
  const [data, setData] = useState<PaginatedBugReportsAdminDto | null>(null);
  const [stats, setStats] = useState<BugReportStatsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<BugStatusFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<BugSeverityFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<BugCategoryFilter>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let aborted = false;
    setLoading(true);
    (async () => {
      try {
        const [listRes, statsRes] = await Promise.all([
          bugReportsAdminControllerList({
            query: {
              page,
              limit: 20,
              ...(statusFilter !== "all" ? { status: statusFilter } : {}),
              ...(severityFilter !== "all" ? { severity: severityFilter } : {}),
              ...(categoryFilter !== "all" ? { category: categoryFilter } : {}),
              ...(search.trim() ? { q: search.trim() } : {}),
            },
          }),
          bugReportsAdminControllerStats(),
        ]);
        if (aborted) return;
        if (listRes.data) setData(listRes.data);
        if (statsRes.data) setStats(statsRes.data);
      } catch (err) {
        if (!aborted) toast.error(`Tải danh sách lỗi: ${(err as Error).message}`);
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => {
      aborted = true;
    };
  }, [page, statusFilter, severityFilter, categoryFilter, search]);

  const items = useMemo(() => data?.items ?? [], [data]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <Bug className="size-6 text-rose-600" />
            Báo lỗi sản phẩm
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bug reports từ user — xử lý theo SLA tương ứng severity.
          </p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid gap-3 md:grid-cols-5">
        <StatCard label="Mới" value={stats?.new} icon={ListChecks} tone="blue" />
        <StatCard label="Đã triage" value={stats?.triaged} icon={Clock} tone="amber" />
        <StatCard label="Đang xử lý" value={stats?.inProgress} icon={Clock} tone="purple" />
        <StatCard label="Đã giải quyết" value={stats?.resolved} icon={CheckCircle2} tone="green" />
        <StatCard label="Critical (mở)" value={stats?.critical} icon={AlertTriangle} tone="red" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-white p-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Tìm theo mã, tiêu đề, email..."
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setPage(1); setStatusFilter(v as BugStatusFilter); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Trạng thái" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={(v) => { setPage(1); setSeverityFilter(v as BugSeverityFilter); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả severity</SelectItem>
            {Object.entries(SEVERITY_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={(v) => { setPage(1); setCategoryFilter(v as BugCategoryFilter); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả category</SelectItem>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Mã</TableHead>
              <TableHead>Tiêu đề</TableHead>
              <TableHead className="w-[140px]">Category</TableHead>
              <TableHead className="w-[140px]">Severity</TableHead>
              <TableHead className="w-[140px]">Trạng thái</TableHead>
              <TableHead className="w-[180px]">Reporter</TableHead>
              <TableHead className="w-[140px]">Tạo lúc</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : items.length === 0
                ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                        Không có báo cáo nào khớp bộ lọc.
                      </TableCell>
                    </TableRow>
                  )
                : items.map((b) => <BugRow key={b.publicId} bug={b} />)}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Trang {data.page} / {data.totalPages} · {data.total} báo cáo
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded border px-3 py-1.5 disabled:opacity-50"
            >
              Trước
            </button>
            <button
              type="button"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              className="rounded border px-3 py-1.5 disabled:opacity-50"
            >
              Sau
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BugRow({ bug }: { bug: BugReportAdminDto }) {
  return (
    <TableRow className="hover:bg-stone-50">
      <TableCell className="font-mono text-xs font-bold">
        <Link href={`/bug-reports/${bug.publicId}`} className="text-blue-700 hover:underline">
          {bug.publicId}
        </Link>
      </TableCell>
      <TableCell>
        <Link
          href={`/bug-reports/${bug.publicId}`}
          className="line-clamp-1 font-semibold hover:underline"
          title={bug.title}
        >
          {bug.title}
        </Link>
      </TableCell>
      <TableCell className="text-xs">{CATEGORY_LABEL[bug.category] ?? bug.category}</TableCell>
      <TableCell className="text-xs">{SEVERITY_LABEL[bug.severity] ?? bug.severity}</TableCell>
      <TableCell>
        <Badge variant={STATUS_VARIANT[bug.status] ?? "default"}>
          {STATUS_LABEL[bug.status] ?? bug.status}
        </Badge>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground" title={bug.email}>
        {bug.email.length > 22 ? `${bug.email.slice(0, 22)}…` : bug.email}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {new Date(bug.createdAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}
      </TableCell>
    </TableRow>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | undefined;
  icon: React.ComponentType<{ className?: string }>;
  tone: "blue" | "amber" | "purple" | "green" | "red";
}) {
  const tones: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    red: "bg-rose-50 text-rose-700 border-rose-200",
  };
  return (
    <div className={`flex items-center gap-3 rounded-lg border bg-white p-3 ${tones[tone]}`}>
      <div className="grid size-9 place-items-center rounded-md bg-white/80">
        <Icon className="size-4" />
      </div>
      <div>
        <div className="text-[10px] font-extrabold uppercase tracking-wider opacity-80">{label}</div>
        <div className="text-xl font-extrabold">{value ?? "—"}</div>
      </div>
    </div>
  );
}
