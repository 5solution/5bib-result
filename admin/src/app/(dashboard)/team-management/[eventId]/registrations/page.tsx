"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  listRegistrations,
  listTeamRoles,
  bulkUpdateRegistrations,
  type RegistrationListRow,
  type TeamRole,
} from "@/lib/team-api";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Search } from "lucide-react";
import { toast } from "sonner";

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-green-500/20 text-green-400",
  waitlisted: "bg-orange-500/20 text-orange-400",
  pending: "bg-yellow-500/20 text-yellow-400",
  rejected: "bg-red-500/20 text-red-400",
  cancelled: "bg-zinc-500/20 text-zinc-400",
};

const STATUS_LABELS: Record<string, string> = {
  approved: "Đã duyệt",
  waitlisted: "Chờ",
  pending: "Mới",
  rejected: "Từ chối",
  cancelled: "Đã hủy",
};

export default function RegistrationsListPage(): React.ReactElement {
  const router = useRouter();
  const params = useParams<{ eventId: string }>();
  const eventId = Number(params.eventId);
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();

  const [roles, setRoles] = useState<TeamRole[]>([]);
  const [rows, setRows] = useState<RegistrationListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterRoleId, setFilterRoleId] = useState<number | undefined>();
  const [page, setPage] = useState(1);
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [roleList, regs] = await Promise.all([
        listTeamRoles(token, eventId),
        listRegistrations(token, eventId, {
          status: filterStatus || undefined,
          role_id: filterRoleId,
          search: search || undefined,
          page,
          limit: 50,
        }),
      ]);
      setRoles(roleList);
      setRows(regs.data);
      setTotal(regs.total);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token, eventId, filterStatus, filterRoleId, search, page]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/login");
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  function toggleSelect(id: number, checked: boolean): void {
    const next = new Set(selection);
    if (checked) next.add(id);
    else next.delete(id);
    setSelection(next);
  }

  async function handleBulk(status: "approved" | "rejected" | "cancelled"): Promise<void> {
    if (!token || selection.size === 0) return;
    const ids = Array.from(selection);
    const action =
      status === "approved" ? "duyệt" : status === "rejected" ? "từ chối" : "hủy";
    if (!confirm(`Xác nhận ${action} ${ids.length} người đã chọn?`)) return;
    try {
      const result = await bulkUpdateRegistrations(token, { ids, status });
      toast.success(
        `Cập nhật: ${result.updated} · bỏ qua: ${result.skipped} · lỗi: ${result.failed_ids.length}`,
      );
      setSelection(new Set());
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (authLoading || !isAuthenticated) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Tìm theo tên, email, SĐT..."
            className="pl-8"
          />
        </div>
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={filterStatus}
          onChange={(e) => {
            setPage(1);
            setFilterStatus(e.target.value);
          }}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="approved">Đã duyệt</option>
          <option value="waitlisted">Chờ</option>
          <option value="pending">Mới</option>
          <option value="rejected">Từ chối</option>
          <option value="cancelled">Đã hủy</option>
        </select>
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={filterRoleId ?? ""}
          onChange={(e) => {
            setPage(1);
            setFilterRoleId(e.target.value ? Number(e.target.value) : undefined);
          }}
        >
          <option value="">Tất cả vai trò</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.role_name}
            </option>
          ))}
        </select>
      </div>

      {selection.size > 0 ? (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-2">
          <span className="text-sm font-medium">{selection.size} đã chọn</span>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => handleBulk("approved")}>
            Duyệt
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleBulk("rejected")}>
            Từ chối
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleBulk("cancelled")}>
            Hủy
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelection(new Set())}>
            Clear
          </Button>
        </div>
      ) : null}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <Checkbox
                  checked={selection.size > 0 && selection.size === rows.length}
                  onCheckedChange={(v) => {
                    if (v) setSelection(new Set(rows.map((r) => r.id)));
                    else setSelection(new Set());
                  }}
                />
              </TableHead>
              <TableHead>Tên</TableHead>
              <TableHead>Vai trò</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Hợp đồng</TableHead>
              <TableHead>Check-in</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Skeleton className="h-8" />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground py-8"
                >
                  Không có dữ liệu
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Checkbox
                      checked={selection.has(r.id)}
                      onCheckedChange={(v) => toggleSelect(r.id, v === true)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link
                      href={`/team-management/${eventId}/registrations/${r.id}`}
                      className="hover:underline"
                    >
                      {r.full_name}
                    </Link>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                  </TableCell>
                  <TableCell>{r.role_name ?? "—"}</TableCell>
                  <TableCell>{r.shirt_size ?? "—"}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_STYLES[r.status] ?? ""}>
                      {STATUS_LABELS[r.status] ?? r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.contract_status === "signed"
                      ? "✅ Đã ký"
                      : r.contract_status === "sent"
                        ? "⏳ Chờ ký"
                        : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.checked_in_at
                      ? new Date(r.checked_in_at).toLocaleString("vi-VN")
                      : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className="text-muted-foreground">
          {rows.length} / {total}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Trang trước
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={rows.length < 50}
            onClick={() => setPage((p) => p + 1)}
          >
            Trang sau
          </Button>
        </div>
      </div>
    </div>
  );
}
