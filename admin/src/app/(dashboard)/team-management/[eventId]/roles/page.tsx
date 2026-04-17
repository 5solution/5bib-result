"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  listTeamRoles,
  createTeamRole,
  deleteTeamRole,
  sendContracts,
  listContractTemplates,
  DEFAULT_FORM_FIELDS,
  type TeamRole,
  type CreateRoleInput,
  type ContractTemplate,
} from "@/lib/team-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, Send } from "lucide-react";
import { toast } from "sonner";

export default function RolesPage(): React.ReactElement {
  const router = useRouter();
  const params = useParams<{ eventId: string }>();
  const eventId = Number(params.eventId);
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();

  const [roles, setRoles] = useState<TeamRole[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      setRoles(await listTeamRoles(token, eventId));
    } catch (err) {
      setError((err as Error).message);
    }
  }, [token, eventId]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/login");
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  async function handleDelete(id: number): Promise<void> {
    if (!token) return;
    if (!confirm("Xóa vai trò này? (chỉ được xóa nếu chưa có người đăng ký)")) return;
    try {
      await deleteTeamRole(token, id);
      toast.success("Đã xóa");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleSendContracts(roleId: number): Promise<void> {
    if (!token) return;
    try {
      const preview = await sendContracts(token, roleId, true);
      const ok = confirm(
        `Sẽ gửi HĐ cho ${preview.queued} người (đã gửi: ${preview.already_sent}, skip: ${preview.skipped}). Xác nhận?`,
      );
      if (!ok) return;
      const result = await sendContracts(token, roleId, false);
      toast.success(`Đã gửi ${result.queued} hợp đồng`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (authLoading || !isAuthenticated) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/team-management">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 size-4" /> Quay lại
          </Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Vai trò — Sự kiện #{eventId}</h1>
        <div className="flex-1" />
        <Link href="/team-management/contract-templates">
          <Button variant="outline" size="sm">
            Mẫu hợp đồng
          </Button>
        </Link>
        <CreateRoleDialog
          eventId={eventId}
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={() => {
            setCreateOpen(false);
            void load();
          }}
        />
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {roles === null ? (
        <Skeleton className="h-64" />
      ) : roles.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          Chưa có vai trò nào. Thêm Leader / Crew / TNV ở nút trên.
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên vai trò</TableHead>
                <TableHead>Slots</TableHead>
                <TableHead>Đơn giá</TableHead>
                <TableHead>Waitlist</TableHead>
                <TableHead>Sort</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.role_name}</TableCell>
                  <TableCell>
                    {r.filled_slots} / {r.max_slots}
                  </TableCell>
                  <TableCell>
                    {Number(r.daily_rate).toLocaleString("vi-VN")} ₫/ngày × {r.working_days}
                  </TableCell>
                  <TableCell>{r.waitlist_enabled ? "Có" : "—"}</TableCell>
                  <TableCell>{r.sort_order}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Gửi hợp đồng hàng loạt"
                      onClick={() => {
                        void handleSendContracts(r.id);
                      }}
                    >
                      <Send className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        void handleDelete(r.id);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function CreateRoleDialog({
  eventId,
  open,
  onOpenChange,
  onCreated,
}: {
  eventId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const { token } = useAuth();
  const [form, setForm] = useState<CreateRoleInput>({
    role_name: "",
    max_slots: 10,
    waitlist_enabled: true,
    auto_approve: false,
    daily_rate: 0,
    working_days: 1,
    form_fields: DEFAULT_FORM_FIELDS,
    sort_order: 0,
  });
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token || !open) return;
    listContractTemplates(token)
      .then(setTemplates)
      .catch((err) => {
        // non-fatal — role can be created without template, contract flow just won't work
        console.warn("Failed to load templates:", (err as Error).message);
      });
  }, [token, open]);

  async function handleSubmit(): Promise<void> {
    if (!token) return;
    if (!form.role_name) {
      toast.error("Tên vai trò bắt buộc");
      return;
    }
    setSaving(true);
    try {
      await createTeamRole(token, eventId, form);
      toast.success("Đã tạo vai trò");
      onCreated();
      setForm({
        role_name: "",
        max_slots: 10,
        waitlist_enabled: true,
        daily_rate: 0,
        working_days: 1,
        form_fields: DEFAULT_FORM_FIELDS,
        sort_order: 0,
      });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 size-4" /> Thêm vai trò
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Thêm vai trò</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tên vai trò *</Label>
            <Input
              placeholder="VD: Leader / Crew / TNV"
              value={form.role_name}
              onChange={(e) => setForm({ ...form, role_name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Số slot tối đa</Label>
              <Input
                type="number"
                min={1}
                value={form.max_slots}
                onChange={(e) =>
                  setForm({ ...form, max_slots: Number(e.target.value) || 1 })
                }
              />
            </div>
            <div>
              <Label>Số ngày làm việc</Label>
              <Input
                type="number"
                min={1}
                value={form.working_days}
                onChange={(e) =>
                  setForm({ ...form, working_days: Number(e.target.value) || 1 })
                }
              />
            </div>
          </div>
          <div>
            <Label>Đơn giá VNĐ/ngày (0 = tình nguyện)</Label>
            <Input
              type="number"
              min={0}
              value={form.daily_rate}
              onChange={(e) =>
                setForm({ ...form, daily_rate: Number(e.target.value) || 0 })
              }
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div>
              <Label>Cho phép waitlist khi hết slot</Label>
              <p className="text-xs text-muted-foreground">
                Người đăng ký thừa sẽ vào danh sách chờ và tự động lên khi có slot trống.
              </p>
            </div>
            <Switch
              checked={form.waitlist_enabled}
              onCheckedChange={(v) => setForm({ ...form, waitlist_enabled: v })}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div>
              <Label>Tự duyệt khi đăng ký công khai</Label>
              <p className="text-xs text-muted-foreground">
                TẮT (khuyến nghị): người đăng ký vào trạng thái <b>pending</b>,
                admin duyệt thủ công → mới gửi QR. BẬT: duyệt ngay + chiếm slot
                + gửi QR tự động.
              </p>
            </div>
            <Switch
              checked={form.auto_approve === true}
              onCheckedChange={(v) => setForm({ ...form, auto_approve: v })}
            />
          </div>
          <div>
            <Label>Thứ tự hiển thị</Label>
            <Input
              type="number"
              value={form.sort_order}
              onChange={(e) =>
                setForm({ ...form, sort_order: Number(e.target.value) || 0 })
              }
            />
          </div>
          <div>
            <Label>Mẫu hợp đồng</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.contract_template_id ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  contract_template_id: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
            >
              <option value="">— Không gán (sẽ không gửi HĐ được) —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.template_name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              {templates.length === 0
                ? "Chưa có template nào. Tạo tại trang Mẫu hợp đồng."
                : "Chọn template để dùng khi gửi HĐ hàng loạt cho role này."}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Form đăng ký đang dùng {DEFAULT_FORM_FIELDS.length} field mặc định (CCCD, ngày sinh,
            size áo, ảnh đại diện, ảnh CCCD, kinh nghiệm). Có thể tùy chỉnh ở phase sau.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            disabled={saving}
            onClick={() => {
              void handleSubmit();
            }}
          >
            {saving ? "Đang lưu..." : "Tạo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
