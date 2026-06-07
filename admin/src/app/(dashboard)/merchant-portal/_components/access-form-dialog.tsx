"use client";

/**
 * F-069 M3 — Dialog tạo/sửa quyền BTC xem báo cáo (1 dialog 2 mode).
 *
 * Business rules encode (BR-MP-33):
 *  - `ticket_report` LUÔN bật + disabled (mọi merchant tối thiểu xem báo cáo vé).
 *  - `revenue_report` optional → cấp quyền tài chính.
 *  - Phải chọn ≥1 BTC (tenantIds). v1 KHÔNG có raceOverrides (defer M3b — Manager plan #3).
 *  - userId immutable khi edit (key định danh).
 *  - Logto lookup 503/not-found → cho nhập tay, KHÔNG block.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth-context";
import { authHeaders } from "@/lib/api";
import {
  merchantPortalAdminControllerCreate,
  merchantPortalAdminControllerUpdate,
} from "@/lib/api-generated/sdk.gen";
import type {
  AccessConfigListItemDto,
  CreateAccessConfigDto,
  UpdateAccessConfigDto,
} from "@/lib/api-generated/types.gen";
import { MP_PERMISSION_DESC } from "@/lib/merchant-portal-labels";
import { TenantMultiPicker } from "./tenant-multi-picker";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null/undefined = create mode; có item = edit mode. */
  editingItem?: AccessConfigListItemDto | null;
  onSaved: () => void;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Trích message lỗi tiếng Việt từ response backend.
 * Backend trả nhiều shape: `{message: string}` | `{message: string[]}` |
 * `{message: {vi, en}}` (bilingual BR-MP-27) — ưu tiên `.vi`.
 */
function extractError(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string") return m;
    if (Array.isArray(m)) return m.join(", ");
    if (m && typeof m === "object") {
      const obj = m as { vi?: unknown; en?: unknown };
      if (typeof obj.vi === "string") return obj.vi;
      if (typeof obj.en === "string") return obj.en;
    }
  }
  return "Có lỗi xảy ra, thử lại sau.";
}

export function AccessFormDialog({
  open,
  onOpenChange,
  editingItem,
  onSaved,
}: Props) {
  const { token } = useAuth();
  const isEdit = !!editingItem;

  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [tenantIds, setTenantIds] = useState<number[]>([]);
  const [revenueEnabled, setRevenueEnabled] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  // Chỉ hiện lỗi field SAU khi bấm Lưu (tránh đỏ ngay khi mở form trống).
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // Prefill khi mở dialog (reset mỗi lần open đổi item).
  useEffect(() => {
    if (!open) return;
    setSubmitAttempted(false);
    if (editingItem) {
      setUserId(editingItem.userId);
      setUserName(editingItem.userName);
      setEmail(editingItem.email);
      setTenantIds(editingItem.tenantIds ?? []);
      setRevenueEnabled(editingItem.permissions.includes("revenue_report"));
      setIsActive(editingItem.isActive);
    } else {
      setUserId("");
      setUserName("");
      setEmail("");
      setTenantIds([]);
      setRevenueEnabled(false);
      setIsActive(true);
    }
  }, [open, editingItem]);

  // Name cache cho chip khi edit (zip tenantIds ↔ tenantNames đã denormalized).
  const initialTenantNames = useMemo(() => {
    const map: Record<number, string> = {};
    if (editingItem) {
      editingItem.tenantIds.forEach((id, i) => {
        const name = editingItem.tenantNames[i];
        if (name) map[id] = name;
      });
    }
    return map;
  }, [editingItem]);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    // Email-first: định danh BTC qua email. Backend tự khớp/tạo userId (M3b).
    if (!userName.trim()) e.userName = "Vui lòng nhập tên người dùng";
    if (!EMAIL_RE.test(email.trim())) e.email = "Email không hợp lệ";
    if (tenantIds.length < 1) e.tenantIds = "Chọn ít nhất 1 BTC";
    return e;
  }, [userName, email, tenantIds]);

  const isValid = Object.keys(errors).length === 0;

  async function handleSubmit() {
    if (!token || submitting) return;
    if (!isValid) {
      setSubmitAttempted(true); // hiện lỗi field
      return;
    }
    setSubmitting(true);

    const permissions: CreateAccessConfigDto["permissions"] = revenueEnabled
      ? ["ticket_report", "revenue_report"]
      : ["ticket_report"];

    try {
      if (isEdit && editingItem) {
        const body: UpdateAccessConfigDto = {
          userName: userName.trim(),
          email: email.trim(),
          tenantIds,
          permissions,
          isActive,
        };
        const { error } = await merchantPortalAdminControllerUpdate({
          path: { id: editingItem.id },
          body,
          ...authHeaders(token),
        });
        if (error) throw error;
        toast.success("Đã cập nhật quyền BTC.");
      } else {
        const body: CreateAccessConfigDto = {
          // userId optional — bỏ trống → backend auto-provision theo email (M3b)
          userId: userId.trim() || undefined,
          userName: userName.trim(),
          email: email.trim(),
          tenantIds,
          permissions,
          isActive,
        };
        const { data, error } = await merchantPortalAdminControllerCreate({
          body,
          ...authHeaders(token),
        });
        if (error) throw error;
        if (data?.provisioned) {
          toast.success(
            data.inviteEmailSent
              ? "Đã tạo tài khoản + gửi email mời cho BTC."
              : "Đã tạo tài khoản BTC. Email mời CHƯA gửi được — báo BTC đăng nhập thủ công.",
          );
        } else {
          toast.success("Đã gán quyền cho BTC.");
        }
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      // 409 dup / 400 validation / 503 — giữ form, hiện message VN từ backend.
      toast.error(extractError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] !w-[min(92vw,30rem)] !max-w-[30rem] sm:!max-w-[30rem] !flex !flex-col [&>*]:min-w-0 overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Sửa quyền BTC" : "Gán quyền BTC xem báo cáo"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Cập nhật phạm vi BTC và mức quyền. User ID không đổi được."
              : "Nhập email BTC + chọn giải. Nếu BTC chưa có tài khoản, hệ thống tự tạo và gửi email mời đăng nhập."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isEdit && (
            <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
              <span className="whitespace-nowrap font-medium">
                Khớp theo email:
              </span>
              <span>
                Chỉ cần email — hệ thống tự tìm tài khoản BTC. Nếu chưa có sẽ tạo
                tài khoản và gửi email mời đăng nhập (không cần mật khẩu) khi lưu.
              </span>
            </div>
          )}

          <div className="space-y-1.5">
              <Label htmlFor="mp-userName">
                Tên người dùng <span className="text-red-600">*</span>
              </Label>
              <Input
                id="mp-userName"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Nguyễn Văn A"
                aria-invalid={submitAttempted && !!errors.userName}
              />
              {submitAttempted && errors.userName && (
                <p className="text-xs text-red-600">{errors.userName}</p>
              )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mp-email">
              Email <span className="text-red-600">*</span>
            </Label>
            <Input
              id="mp-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="a@btc.vn"
              aria-invalid={submitAttempted && !!errors.email}
            />
            {submitAttempted && errors.email && (
              <p className="text-xs text-red-600">{errors.email}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>
              BTC được xem báo cáo <span className="text-red-600">*</span>
            </Label>
            <TenantMultiPicker
              value={tenantIds}
              onChange={setTenantIds}
              initialNames={initialTenantNames}
            />
            {submitAttempted && errors.tenantIds && (
              <p className="text-xs text-red-600">{errors.tenantIds}</p>
            )}
          </div>

          <div className="space-y-2 rounded-md border border-[var(--border,#E7E2D9)] p-3">
            <Label>Mức quyền</Label>
            <div className="flex items-start gap-2 opacity-90">
              <Checkbox checked disabled aria-label="Báo cáo vé (bắt buộc)" />
              <div className="text-sm">
                <span className="font-medium">Báo cáo vé</span>
                <span className="ml-1 text-xs text-[var(--text-muted,#78716C)]">
                  (luôn bật)
                </span>
                <p className="text-xs text-[var(--text-muted,#78716C)]">
                  {MP_PERMISSION_DESC.ticket_report}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                checked={revenueEnabled}
                onCheckedChange={(c) => setRevenueEnabled(c === true)}
                aria-label="Báo cáo doanh thu"
                id="mp-revenue"
              />
              <div className="text-sm">
                <Label htmlFor="mp-revenue" className="font-medium">
                  Báo cáo doanh thu
                </Label>
                <p className="text-xs text-[var(--text-muted,#78716C)]">
                  {MP_PERMISSION_DESC.revenue_report}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-[var(--border,#E7E2D9)] p-3">
            <div>
              <Label htmlFor="mp-active" className="font-medium">
                Kích hoạt
              </Label>
              <p className="text-xs text-[var(--text-muted,#78716C)]">
                Tắt để tạm khóa quyền truy cập của BTC.
              </p>
            </div>
            <Switch
              id="mp-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Hủy
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Gán quyền"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
