"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  listTeamRoles,
  updateTeamRole,
  listContractTemplates,
  type TeamRole,
  type ContractTemplate,
} from "@/lib/team-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings } from "lucide-react";
import { toast } from "sonner";

// v1.7 — per-team Config sub-tab. Inline edit (not modal) to match tab UX.
// Subset of fields from the original EditRoleDialog; the form-fields schema
// + role_name stay immutable after first registration so we don't expose them
// here (planner can still edit via the Vai trò list dialog if needed).

type ChatPlatform = "zalo" | "telegram" | "whatsapp" | "other";

type FormState = {
  max_slots: number;
  daily_rate: number;
  working_days: number;
  waitlist_enabled: boolean;
  auto_approve: boolean;
  sort_order: number;
  contract_template_id: number | null;
  chat_platform: ChatPlatform | null;
  chat_group_url: string | null;
  is_leader_role: boolean;
  managed_role_ids: number[];
};

function roleToForm(r: TeamRole): FormState {
  const x = r as TeamRole & {
    chat_platform?: ChatPlatform | null;
    chat_group_url?: string | null;
    is_leader_role?: boolean;
    managed_role_ids?: number[];
  };
  return {
    max_slots: r.max_slots,
    daily_rate: Number(r.daily_rate),
    working_days: r.working_days,
    waitlist_enabled: r.waitlist_enabled,
    auto_approve: false,
    sort_order: r.sort_order,
    contract_template_id: r.contract_template_id,
    chat_platform: x.chat_platform ?? null,
    chat_group_url: x.chat_group_url ?? null,
    is_leader_role: x.is_leader_role ?? false,
    managed_role_ids: x.managed_role_ids ?? [],
  };
}

export default function RoleConfigPage(): React.ReactElement {
  const params = useParams<{ eventId: string; roleId: string }>();
  const eventId = Number(params.eventId);
  const roleId = Number(params.roleId);
  const { token } = useAuth();

  const [allRoles, setAllRoles] = useState<TeamRole[]>([]);
  const [role, setRole] = useState<TeamRole | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token || !Number.isFinite(eventId) || !Number.isFinite(roleId)) return;
    try {
      const [roles, tpls] = await Promise.all([
        listTeamRoles(token, eventId),
        listContractTemplates(token).catch(() => [] as ContractTemplate[]),
      ]);
      setAllRoles(roles);
      const r = roles.find((x) => x.id === roleId) ?? null;
      setRole(r);
      if (r) setForm(roleToForm(r));
      setTemplates(tpls);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [token, eventId, roleId]);

  useEffect(() => {
    void load();
  }, [load]);

  const manageCandidates = useMemo(
    () => allRoles.filter((r) => r.id !== roleId),
    [allRoles, roleId],
  );

  async function handleSave(): Promise<void> {
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
        chat_platform: form.chat_platform,
        chat_group_url: form.chat_group_url,
        is_leader_role: form.is_leader_role,
        manages_role_ids: form.is_leader_role ? form.managed_role_ids : [],
      });
      toast.success("Đã lưu cấu hình");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!form || !role) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="font-display text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Settings className="size-5 text-gray-400" />
          Cấu hình team
        </h2>
        <p className="text-xs text-gray-500">
          Sửa slots, đơn giá, waitlist, leader flag, nhóm chat, mẫu HĐ. Tên vai
          trò và cấu hình form đăng ký không sửa được sau khi có người đăng ký.
        </p>
      </div>

      {/* Slots + daily rate */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Slots & Lương</h3>
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
          <Label>Đơn giá VNĐ/ngày</Label>
          <Input
            type="number"
            min={0}
            value={form.daily_rate}
            onChange={(e) =>
              setForm({ ...form, daily_rate: Number(e.target.value) || 0 })
            }
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
      </div>

      {/* Waitlist + auto-approve */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Tự động hoá</h3>
        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
          <Label>Waitlist khi hết slot</Label>
          <Switch
            checked={form.waitlist_enabled}
            onCheckedChange={(v) => setForm({ ...form, waitlist_enabled: v })}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
          <Label>Tự duyệt khi đăng ký công khai</Label>
          <Switch
            checked={form.auto_approve}
            onCheckedChange={(v) => setForm({ ...form, auto_approve: v })}
          />
        </div>
      </div>

      {/* Leader + managed roles */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Cấp bậc & Quản lý</h3>
        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
          <div>
            <Label>Là role leader</Label>
            <p className="text-xs text-muted-foreground">
              Leader có magic link riêng để quản lý supply + station.
            </p>
          </div>
          <Switch
            checked={form.is_leader_role}
            onCheckedChange={(v) =>
              setForm({
                ...form,
                is_leader_role: v,
                managed_role_ids: v ? form.managed_role_ids : [],
              })
            }
          />
        </div>
        {form.is_leader_role ? (
          <div className="rounded-lg border px-3 py-2 space-y-2">
            <Label>Quản lý các role (có thể chọn nhiều)</Label>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {manageCandidates.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  Chưa có role nào khác trong event.
                </p>
              ) : null}
              {manageCandidates.map((r) => {
                const checked = form.managed_role_ids.includes(r.id);
                const isLeader =
                  (r as TeamRole & { is_leader_role?: boolean })
                    .is_leader_role === true;
                return (
                  <label
                    key={r.id}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const current = new Set(form.managed_role_ids);
                        if (e.target.checked) current.add(r.id);
                        else current.delete(r.id);
                        setForm({
                          ...form,
                          managed_role_ids: Array.from(current),
                        });
                      }}
                    />
                    <span>{r.role_name}</span>
                    {isLeader ? (
                      <span className="text-[11px] text-gray-500">(Leader)</span>
                    ) : null}
                  </label>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Chọn leader khác → tự động include descendants (nested tối đa 5 tầng).
            </p>
          </div>
        ) : null}
      </div>

      {/* Chat */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Nhóm chat</h3>
        <div>
          <Label>Nền tảng</Label>
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
              setForm({ ...form, chat_group_url: e.target.value || null })
            }
            placeholder="https://zalo.me/g/xxxxxx"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Chỉ thành viên đã ký HĐ mới thấy link này.
          </p>
        </div>
      </div>

      {/* Contract template */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Hợp đồng</h3>
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
      </div>

      {/* Save */}
      <div className="sticky bottom-0 flex justify-end gap-2 bg-white border-t py-3">
        <Button variant="ghost" onClick={() => setForm(roleToForm(role))}>
          Reset
        </Button>
        <Button disabled={saving} onClick={() => void handleSave()}>
          {saving ? "Đang lưu..." : "Lưu cấu hình"}
        </Button>
      </div>
    </div>
  );
}
