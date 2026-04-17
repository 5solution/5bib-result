"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  listRegistrations,
  listTeamRoles,
  bulkUpdateRegistrations,
  adminManualRegister,
  type RegistrationListRow,
  type TeamRole,
  type ManualRegisterInput,
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Search, UserPlus } from "lucide-react";
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
  const [manualOpen, setManualOpen] = useState(false);

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
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Danh sách nhân sự</h2>
        <Button
          size="sm"
          onClick={() => setManualOpen(true)}
          disabled={roles.length === 0}
        >
          <UserPlus className="mr-2 size-4" /> Thêm trực tiếp
        </Button>
      </div>

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

      <ManualRegisterDialog
        eventId={eventId}
        roles={roles}
        open={manualOpen}
        onOpenChange={setManualOpen}
        onDone={() => {
          setManualOpen(false);
          void load();
        }}
      />
    </div>
  );
}

function ManualRegisterDialog({
  eventId,
  roles,
  open,
  onOpenChange,
  onDone,
}: {
  eventId: number;
  roles: TeamRole[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}): React.ReactElement {
  const { token } = useAuth();
  const [roleId, setRoleId] = useState<number | null>(null);
  const [form, setForm] = useState<Omit<ManualRegisterInput, "role_id">>({
    full_name: "",
    email: "",
    phone: "",
    form_data: {},
    auto_approve: true,
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && roles.length > 0 && roleId == null) setRoleId(roles[0].id);
  }, [open, roles, roleId]);

  const selectedRole = roles.find((r) => r.id === roleId) ?? null;

  async function handleSubmit(): Promise<void> {
    if (!token || !roleId) return;
    if (!form.full_name || !form.email || !form.phone) {
      toast.error("Họ tên / email / SĐT bắt buộc");
      return;
    }
    setSaving(true);
    try {
      const res = await adminManualRegister(token, eventId, {
        role_id: roleId,
        ...form,
      });
      toast.success(res.message);
      onDone();
      setForm({
        full_name: "",
        email: "",
        phone: "",
        form_data: {},
        auto_approve: true,
        notes: "",
      });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Thêm nhân sự trực tiếp</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Vai trò *</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={roleId ?? ""}
              onChange={(e) => setRoleId(Number(e.target.value))}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.role_name} ({r.filled_slots}/{r.max_slots})
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Họ và tên *</Label>
            <Input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <Label>SĐT *</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>
          {selectedRole ? (
            <DynamicFormFields
              fields={selectedRole.form_fields}
              values={form.form_data}
              onChange={(values) => setForm({ ...form, form_data: values })}
            />
          ) : null}
          <div>
            <Label>Ghi chú (tùy chọn)</Label>
            <Input
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="VD: Leader team Hậu cần giới thiệu..."
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div>
              <Label>Duyệt ngay + gửi QR</Label>
              <p className="text-xs text-muted-foreground">
                BẬT (mặc định): approved + email QR luôn. TẮT: pending, duyệt
                thủ công sau.
              </p>
            </div>
            <Switch
              checked={form.auto_approve !== false}
              onCheckedChange={(v) => setForm({ ...form, auto_approve: v })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            onClick={() => {
              void handleSubmit();
            }}
            disabled={saving}
          >
            {saving ? "Đang thêm..." : "Thêm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DynamicFormFields({
  fields,
  values,
  onChange,
}: {
  fields: TeamRole["form_fields"];
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}): React.ReactElement {
  function set(key: string, val: unknown) {
    onChange({ ...values, [key]: val });
  }
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="text-xs font-medium text-muted-foreground">
        Dữ liệu form theo vai trò
      </p>
      {fields.map((f) => {
        const v = (values[f.key] ?? "") as string;
        if (f.type === "photo") {
          return (
            <div key={f.key}>
              <Label className="text-xs">
                {f.label}
                {f.required ? " *" : ""}
              </Label>
              <Input
                value={v}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder="S3 key hoặc URL (dán từ upload endpoint)"
              />
              {f.hint ? (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {f.hint}
                </p>
              ) : null}
            </div>
          );
        }
        if (f.type === "shirt_size") {
          return (
            <div key={f.key}>
              <Label className="text-xs">
                {f.label}
                {f.required ? " *" : ""}
              </Label>
              <select
                className="flex h-9 w-full rounded-md border px-2 text-sm"
                value={v}
                onChange={(e) => set(f.key, e.target.value)}
              >
                <option value="">—</option>
                {(f.options ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          );
        }
        return (
          <div key={f.key}>
            <Label className="text-xs">
              {f.label}
              {f.required ? " *" : ""}
            </Label>
            <Input
              type={
                f.type === "date"
                  ? "date"
                  : f.type === "email"
                    ? "email"
                    : f.type === "tel"
                      ? "tel"
                      : "text"
              }
              value={v}
              onChange={(e) => set(f.key, e.target.value)}
            />
          </div>
        );
      })}
    </div>
  );
}
