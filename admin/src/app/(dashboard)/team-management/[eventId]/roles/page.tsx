"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  listTeamRoles,
  createTeamRole,
  deleteTeamRole,
  updateTeamRole,
  sendContracts,
  listContractTemplates,
  downloadRoleTemplate,
  DEFAULT_FORM_FIELDS,
  type TeamRole,
  type CreateRoleInput,
  type ContractTemplate,
} from "@/lib/team-api";
import { RoleImportDialog } from "./role-import-dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Trash2, Send, Pencil, Download, Upload } from "lucide-react";
import { toast } from "sonner";

type ChatPlatform = "zalo" | "telegram" | "whatsapp" | "other";

interface RoleEditFields {
  max_slots: number;
  daily_rate: number;
  working_days: number;
  waitlist_enabled: boolean;
  auto_approve: boolean;
  sort_order: number;
  contract_template_id: number | null;
  chat_platform: ChatPlatform | null;
  chat_group_url: string | null;
}

export default function RolesPage(): React.ReactElement {
  const router = useRouter();
  const params = useParams<{ eventId: string }>();
  const eventId = Number(params.eventId);
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();

  const [roles, setRoles] = useState<TeamRole[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TeamRole | null>(null);

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
    if (!confirm("Xóa vai trò này? (chỉ được xóa nếu chưa có người đăng ký)"))
      return;
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
        <h1 className="font-display text-3xl font-bold tracking-tight text-gradient">
          Vai trò — Sự kiện #{eventId}
        </h1>
        <div className="flex-1" />
        <Link href="/team-management/contract-templates">
          <Button variant="outline" size="sm">
            Mẫu hợp đồng
          </Button>
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (!token) return;
            void downloadRoleTemplate(token).catch((err) =>
              toast.error((err as Error).message),
            );
          }}
        >
          <Download className="mr-2 size-4" /> Tải template
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setImportOpen(true)}
        >
          <Upload className="mr-2 size-4" /> Import từ file
        </Button>
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

      <RoleImportDialog
        eventId={eventId}
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => {
          void load();
        }}
      />

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
                <TableRow key={r.id} className="result-row-hover">
                  <TableCell className="font-medium">{r.role_name}</TableCell>
                  <TableCell>
                    {r.filled_slots} / {r.max_slots}
                  </TableCell>
                  <TableCell>
                    {Number(r.daily_rate).toLocaleString("vi-VN")} ₫/ngày ×{" "}
                    {r.working_days}
                  </TableCell>
                  <TableCell>{r.waitlist_enabled ? "Có" : "—"}</TableCell>
                  <TableCell>{r.sort_order}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Sửa vai trò"
                      onClick={() => setEditTarget(r)}
                    >
                      <Pencil className="size-4" />
                    </Button>
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
                      title="Xóa vai trò"
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

      <EditRoleDialog
        role={editTarget}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        onSaved={() => {
          setEditTarget(null);
          void load();
        }}
      />
    </div>
  );
}

function EditRoleDialog({
  role,
  onOpenChange,
  onSaved,
}: {
  role: TeamRole | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}): React.ReactElement {
  const { token } = useAuth();
  const [form, setForm] = useState<RoleEditFields | null>(null);
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!role) {
      setForm(null);
      return;
    }
    const r = role as TeamRole & {
      chat_platform?: ChatPlatform | null;
      chat_group_url?: string | null;
    };
    setForm({
      max_slots: role.max_slots,
      daily_rate: Number(role.daily_rate),
      working_days: role.working_days,
      waitlist_enabled: role.waitlist_enabled,
      auto_approve: false,
      sort_order: role.sort_order,
      contract_template_id: role.contract_template_id,
      chat_platform: r.chat_platform ?? null,
      chat_group_url: r.chat_group_url ?? null,
    });
  }, [role]);

  useEffect(() => {
    if (!token || !role) return;
    listContractTemplates(token)
      .then(setTemplates)
      .catch(() => {
        /* non-fatal */
      });
  }, [token, role]);

  async function handleSubmit(): Promise<void> {
    if (!token || !role || !form) return;
    setSaving(true);
    try {
      await updateTeamRole(token, role.id, {
        max_slots: form.max_slots,
        daily_rate: form.daily_rate,
        working_days: form.working_days,
        waitlist_enabled: form.waitlist_enabled,
        auto_approve: form.auto_approve,
        sort_order: form.sort_order,
        contract_template_id: form.contract_template_id ?? undefined,
        // v1.5: chat fields. Cast — SDK type may not yet include these
        // until the backend agent lands them in team-api.ts.
        ...({
          chat_platform: form.chat_platform,
          chat_group_url: form.chat_group_url,
        } as Partial<CreateRoleInput>),
      });
      toast.success("Đã cập nhật vai trò");
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const open = role != null && form != null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Sửa vai trò — {role?.role_name}</DialogTitle>
        </DialogHeader>
        {form ? (
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="basic">Cơ bản</TabsTrigger>
              <TabsTrigger value="chat">Nhóm chat</TabsTrigger>
              <TabsTrigger value="contract">Hợp đồng</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-3 pt-3">
              <p className="text-xs text-muted-foreground">
                Không được sửa <b>Tên vai trò</b> và <b>Cấu hình form</b> sau khi
                đã có người đăng ký (tránh break dữ liệu cũ).
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Số slot tối đa</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.max_slots}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        max_slots: Number(e.target.value) || 1,
                      })
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
                      setForm({
                        ...form,
                        working_days: Number(e.target.value) || 1,
                      })
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Đơn giá VNĐ/ngày</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.daily_rate}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      daily_rate: Number(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div>
                  <Label>Waitlist khi hết slot</Label>
                </div>
                <Switch
                  checked={form.waitlist_enabled}
                  onCheckedChange={(v) =>
                    setForm({ ...form, waitlist_enabled: v })
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div>
                  <Label>Tự duyệt khi đăng ký công khai</Label>
                </div>
                <Switch
                  checked={form.auto_approve}
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
            </TabsContent>

            <TabsContent value="chat" className="space-y-3 pt-3">
              <div>
                <Label>Nền tảng nhóm chat</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.chat_platform ?? ""}
                  onChange={(e) => {
                    const v = e.target.value as ChatPlatform | "";
                    setForm({
                      ...form,
                      chat_platform: v === "" ? null : v,
                    });
                  }}
                >
                  <option value="">-- Không có --</option>
                  <option value="zalo">Zalo</option>
                  <option value="telegram">Telegram</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="other">Khác</option>
                </select>
              </div>
              <div>
                <Label>Link nhóm</Label>
                <Input
                  value={form.chat_group_url ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      chat_group_url: e.target.value || null,
                    })
                  }
                  placeholder="https://zalo.me/g/xxxxxx"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Chỉ thành viên đã ký HĐ mới thấy link này. Để trống nếu chưa có
                  nhóm.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="contract" className="space-y-3 pt-3">
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
                        : null,
                    })
                  }
                >
                  <option value="">— Không gán —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.template_name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  {templates.length === 0
                    ? "Chưa có template. Tạo tại trang Mẫu hợp đồng."
                    : "Template dùng khi gửi HĐ hàng loạt cho role này."}
                </p>
              </div>
            </TabsContent>
          </Tabs>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            disabled={saving || !form}
            onClick={() => {
              void handleSubmit();
            }}
          >
            {saving ? "Đang lưu..." : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const [form, setForm] = useState<
    CreateRoleInput & {
      chat_platform: ChatPlatform | null;
      chat_group_url: string | null;
    }
  >({
    role_name: "",
    max_slots: 10,
    waitlist_enabled: true,
    auto_approve: false,
    daily_rate: 0,
    working_days: 1,
    form_fields: DEFAULT_FORM_FIELDS,
    sort_order: 0,
    chat_platform: null,
    chat_group_url: null,
  });
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token || !open) return;
    listContractTemplates(token)
      .then(setTemplates)
      .catch((err) => {
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
      // Cast — SDK type doesn't yet include chat_* fields until backend
      // agent lands them. Backend tolerates extra props.
      await createTeamRole(token, eventId, form as CreateRoleInput);
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
        chat_platform: null,
        chat_group_url: null,
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
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="basic">Cơ bản</TabsTrigger>
            <TabsTrigger value="form">Biểu mẫu</TabsTrigger>
            <TabsTrigger value="chat">Nhóm chat</TabsTrigger>
            <TabsTrigger value="contract">Hợp đồng</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-3 pt-3">
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
                    setForm({
                      ...form,
                      working_days: Number(e.target.value) || 1,
                    })
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
                  Người đăng ký thừa sẽ vào danh sách chờ và tự động lên khi có
                  slot trống.
                </p>
              </div>
              <Switch
                checked={form.waitlist_enabled}
                onCheckedChange={(v) =>
                  setForm({ ...form, waitlist_enabled: v })
                }
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
          </TabsContent>

          <TabsContent value="form" className="space-y-3 pt-3">
            <p className="text-xs text-muted-foreground">
              Form đăng ký đang dùng {DEFAULT_FORM_FIELDS.length} field mặc định
              (CCCD, ngày sinh, size áo, ảnh đại diện, ảnh CCCD, kinh nghiệm).
              Có thể tùy chỉnh ở phase sau.
            </p>
            <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
              {DEFAULT_FORM_FIELDS.map((f) => (
                <div key={f.key} className="flex items-center justify-between">
                  <span className="font-medium">{f.label}</span>
                  <span className="text-muted-foreground">
                    {f.type}
                    {f.required ? " · bắt buộc" : ""}
                  </span>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="chat" className="space-y-3 pt-3">
            <div>
              <Label>Nền tảng nhóm chat</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.chat_platform ?? ""}
                onChange={(e) => {
                  const v = e.target.value as ChatPlatform | "";
                  setForm({ ...form, chat_platform: v === "" ? null : v });
                }}
              >
                <option value="">-- Không có --</option>
                <option value="zalo">Zalo</option>
                <option value="telegram">Telegram</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="other">Khác</option>
              </select>
            </div>
            <div>
              <Label>Link nhóm</Label>
              <Input
                value={form.chat_group_url ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    chat_group_url: e.target.value || null,
                  })
                }
                placeholder="https://zalo.me/g/xxxxxx"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Chỉ thành viên đã ký HĐ mới thấy link này. Để trống nếu chưa có
                nhóm.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="contract" className="space-y-3 pt-3">
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
          </TabsContent>
        </Tabs>
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
