"use client";

/**
 * F-069 M3 — Trang quản lý quyền BTC xem báo cáo (admin).
 *
 * Page-level RBAC gate `isAdmin` defense-in-depth (backend cũng enforce
 * LogtoAdminGuard). Consume 7 endpoint M2a qua generated SDK (house style:
 * direct SDK fn + useState/useEffect như races/page.tsx).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { authHeaders } from "@/lib/api";
import { RestrictedAccess } from "@/components/admin-shell/restricted-access";
import { useConfirm } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  merchantPortalAdminControllerList,
  merchantPortalAdminControllerRemove,
} from "@/lib/api-generated/sdk.gen";
import type { AccessConfigListItemDto } from "@/lib/api-generated/types.gen";
import { AccessListTable } from "./_components/access-list-table";
import { AccessFormDialog } from "./_components/access-form-dialog";
import { MerchantPortalEmptyState } from "./_components/empty-state";

const PAGE_SIZE = 20;

function MerchantPortalClient() {
  const { token } = useAuth();
  const confirm = useConfirm();

  const [items, setItems] = useState<AccessConfigListItemDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [permissionFilter, setPermissionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1); // 1-indexed (backend min 1)

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AccessConfigListItemDto | null>(
    null,
  );

  // Debounce search input 300ms.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const fetchList = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setHasError(false);
    try {
      const { data, error } = await merchantPortalAdminControllerList({
        query: {
          page,
          pageSize: PAGE_SIZE,
          q: debouncedQ || undefined,
          permissionFilter:
            permissionFilter === "all"
              ? undefined
              : (permissionFilter as "ticket_only" | "ticket_and_revenue"),
          statusFilter:
            statusFilter === "all"
              ? undefined
              : (statusFilter as "active" | "inactive"),
        },
        ...authHeaders(token),
      });
      if (error) throw error;
      setItems(data?.items ?? []);
      setTotal(data?.total ?? 0);
    } catch {
      setHasError(true);
      toast.error("Không tải được danh sách quyền BTC");
    } finally {
      setLoading(false);
    }
  }, [token, page, debouncedQ, permissionFilter, statusFilter]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const isFiltered =
    debouncedQ !== "" || permissionFilter !== "all" || statusFilter !== "all";
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function openCreate() {
    setEditingItem(null);
    setDialogOpen(true);
  }

  function openEdit(item: AccessConfigListItemDto) {
    setEditingItem(item);
    setDialogOpen(true);
  }

  async function handleDelete(item: AccessConfigListItemDto) {
    if (!token) return;
    const ok = await confirm({
      title: "Gỡ quyền BTC",
      description: `Gỡ quyền xem báo cáo của "${item.userName}"? BTC sẽ không đăng nhập merchant portal được nữa.`,
      confirmText: "Gỡ quyền",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      const { error } = await merchantPortalAdminControllerRemove({
        path: { id: item.id },
        ...authHeaders(token),
      });
      if (error) throw error;
      toast.success("Đã gỡ quyền BTC.");
      // Nếu xóa item cuối của trang > 1, lùi 1 trang.
      if (items.length === 1 && page > 1) setPage((p) => p - 1);
      else fetchList();
    } catch {
      toast.error("Gỡ quyền thất bại");
    }
  }

  function clearFilters() {
    setQ("");
    setDebouncedQ("");
    setPermissionFilter("all");
    setStatusFilter("all");
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Quyền BTC xem báo cáo</h1>
          <p className="text-sm text-[var(--text-muted,#78716C)]">
            Gán user Logto vào BTC để xem báo cáo vé / doanh thu trên merchant portal.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Gán quyền mới
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted,#78716C)]" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo tên hoặc email..."
            className="h-9 pl-8 text-sm"
            aria-label="Tìm theo tên hoặc email"
          />
        </div>
        <Select
          value={permissionFilter}
          onValueChange={(val) => {
            setPermissionFilter(val ?? "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-[180px] text-sm">
            <SelectValue placeholder="Mức quyền" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả mức quyền</SelectItem>
            <SelectItem value="ticket_only">Chỉ báo cáo vé</SelectItem>
            <SelectItem value="ticket_and_revenue">Vé + Doanh thu</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(val) => {
            setStatusFilter(val ?? "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-[160px] text-sm">
            <SelectValue placeholder="Trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            <SelectItem value="active">Đang hoạt động</SelectItem>
            <SelectItem value="inactive">Đã khóa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      ) : hasError ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-red-600">Không tải được dữ liệu.</p>
          <Button variant="outline" onClick={fetchList}>
            Thử lại
          </Button>
        </div>
      ) : items.length === 0 ? (
        <MerchantPortalEmptyState
          filtered={isFiltered}
          onCreate={openCreate}
          onClearFilter={clearFilters}
        />
      ) : (
        <>
          <AccessListTable
            items={items}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
          {/* Pagination */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--text-muted,#78716C)]">
              {total} cấu hình · Trang {page}/{totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Trước
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Sau
              </Button>
            </div>
          </div>
        </>
      )}

      <AccessFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingItem={editingItem}
        onSaved={fetchList}
      />
    </div>
  );
}

export default function MerchantPortalPage() {
  const { isAdmin, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAdmin) {
    return (
      <RestrictedAccess message="Quản lý quyền BTC chỉ dành cho admin — bạn không có quyền truy cập." />
    );
  }
  return <MerchantPortalClient />;
}
