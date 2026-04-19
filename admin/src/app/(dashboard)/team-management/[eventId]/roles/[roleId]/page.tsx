"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { listRegistrations, type RegistrationListRow } from "@/lib/team-api";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Users, Search, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 20;

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  pending_approval: { label: "Chờ duyệt",  color: "bg-amber-100 text-amber-800" },
  approved:         { label: "Đã duyệt",   color: "bg-emerald-100 text-emerald-800" },
  contract_sent:    { label: "Đã gửi HĐ",  color: "bg-blue-100 text-blue-800" },
  contract_signed:  { label: "Đã ký",      color: "bg-blue-100 text-blue-800" },
  qr_sent:          { label: "Đã gửi QR",  color: "bg-indigo-100 text-indigo-800" },
  checked_in:       { label: "Đã check-in",color: "bg-emerald-100 text-emerald-800" },
  completed:        { label: "Hoàn thành", color: "bg-slate-200 text-slate-800" },
  rejected:         { label: "Từ chối",    color: "bg-red-100 text-red-800" },
  waitlisted:       { label: "Waitlist",   color: "bg-purple-100 text-purple-800" },
  cancelled:        { label: "Đã huỷ",     color: "bg-gray-200 text-gray-700" },
};

export default function RoleOverviewPage(): React.ReactElement {
  const params   = useParams<{ eventId: string; roleId: string }>();
  const eventId  = Number(params.eventId);
  const roleId   = Number(params.roleId);
  const { token } = useAuth();

  const [rows,        setRows]        = useState<RegistrationListRow[] | null>(null);
  const [total,       setTotal]       = useState(0);
  const [byStatus,    setByStatus]    = useState<Record<string, number>>({});
  const [page,        setPage]        = useState(1);
  const [search,      setSearch]      = useState("");
  const [statusFilter,setStatusFilter]= useState<string | undefined>(undefined);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  // Debounce search input — wait 350 ms before firing API call
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (p: number, q: string, status: string | undefined) => {
    if (!token || !Number.isFinite(eventId) || !Number.isFinite(roleId)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listRegistrations(token, eventId, {
        role_id:  roleId,
        page:     p,
        limit:    PAGE_SIZE,
        search:   q || undefined,
        status:   status,
      });
      setRows(res.data);
      setTotal(res.total);
      if (res.by_status) setByStatus(res.by_status as Record<string, number>);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token, eventId, roleId]);

  // Initial load + reload when page or statusFilter changes
  useEffect(() => {
    void load(page, search, statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter]);

  // Debounced search
  function handleSearch(val: string) {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      void load(1, val, statusFilter);
    }, 350);
  }

  function handleStatusClick(s: string) {
    const next = statusFilter === s ? undefined : s;
    setStatusFilter(next);
    setPage(1);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ---- render ----

  if (error) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Users className="size-5 text-gray-400" />
            Nhân sự trong team
          </h2>
          <p className="text-xs text-gray-500">{total} người đã đăng ký</p>
        </div>
        <Link
          href={`/team-management/${eventId}/registrations?role_id=${roleId}`}
          className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
        >
          Trang nhân sự đầy đủ <ExternalLink className="size-3" />
        </Link>
      </div>

      {/* Status chips — click to filter */}
      {Object.keys(byStatus).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(byStatus)
            .sort((a, b) => b[1] - a[1])
            .map(([s, count]) => {
              const meta = STATUS_BADGE[s] ?? { label: s, color: "bg-gray-100 text-gray-700" };
              const active = statusFilter === s;
              return (
                <button
                  key={s}
                  onClick={() => handleStatusClick(s)}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all
                    ${active ? "ring-2 ring-offset-1 ring-gray-400 " + meta.color : meta.color + " opacity-80 hover:opacity-100"}`}
                >
                  {meta.label} · {count}
                </button>
              );
            })}
          {statusFilter && (
            <button
              onClick={() => handleStatusClick(statusFilter)}
              className="text-xs text-gray-400 hover:text-gray-600 px-2"
            >
              ✕ Bỏ lọc
            </button>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Tìm theo tên, SĐT, email..."
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 bg-white text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Table */}
      {rows === null || loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border bg-gray-50 p-8 text-center text-sm text-gray-500">
          {search || statusFilter ? "Không tìm thấy kết quả phù hợp." : "Chưa có ai đăng ký vào team này."}
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Họ tên</th>
                <th className="px-3 py-2 text-left font-medium">SĐT</th>
                <th className="px-3 py-2 text-left font-medium">Email</th>
                <th className="px-3 py-2 text-left font-medium">Trạng thái</th>
                <th className="px-3 py-2 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => {
                const meta = STATUS_BADGE[r.status] ?? { label: r.status, color: "bg-gray-100 text-gray-700" };
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-900">
                      {r.full_name}
                      {r.suspicious_checkin ? (
                        <Badge className="ml-2 bg-red-100 text-red-800 hover:bg-red-100" variant="secondary">
                          ⚠️
                        </Badge>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{r.phone}</td>
                    <td className="px-3 py-2 text-gray-700 truncate max-w-[200px]">{r.email}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.color}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/team-management/${eventId}/registrations/${r.id}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Chi tiết
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} / {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 border text-xs font-medium disabled:opacity-40 hover:bg-gray-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="size-3.5" /> Trước
            </button>

            {/* Page numbers — show up to 5 around current page */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "…" ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-gray-400">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p as number)}
                    className={`w-7 h-7 rounded-md text-xs font-medium border transition-colors
                      ${page === p ? "bg-blue-600 text-white border-blue-600" : "hover:bg-gray-50"}`}
                  >
                    {p}
                  </button>
                )
              )}

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 border text-xs font-medium disabled:opacity-40 hover:bg-gray-50 disabled:cursor-not-allowed"
            >
              Sau <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
