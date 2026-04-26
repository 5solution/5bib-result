"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getRegistrationDetail,
  getSignedContractUrl,
  getSignedAcceptanceUrl,
  getSignatureUrl,
  patchRegistration,
  approveRegistration,
  cancelRegistration,
  confirmCompletion,
  clearSuspicious,
  approveProfileChanges,
  rejectProfileChanges,
  markPaid,
  forcePaid,
  revertPaid,
  sendAcceptanceOne,
  disputeAcceptance,
  backfillBenB,
  type BackfillBenBInput,
  type RegistrationDetail,
} from "@/lib/team-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge, deriveStatusKey } from "@/lib/status-style";
import { formatDateVN, isoToVNField, parseDateVN } from "@/lib/utils";
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  KeyRound,
  Pencil,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { RejectDialog } from "./_reject-dialog";
import { ForcePaidDialog } from "./_force-paid-dialog";
import { BackfillBenBDialog } from "./_backfill-ben-b-dialog";
import { DisputeDialog } from "./_dispute-dialog";

const FIELD_LABELS: Record<string, string> = {
  cccd: "Số CCCD",
  dob: "Ngày sinh",
  shirt_size: "Size áo",
  experience: "Kinh nghiệm",
  cccd_photo: "Ảnh CCCD",
  avatar_photo: "Ảnh đại diện",
  address: "Địa chỉ",
  bank_account_number: "Số tài khoản",
  bank_holder_name: "Chủ tài khoản",
  bank_name: "Ngân hàng",
  bank_branch: "Chi nhánh",
};

const BANK_KEYS = new Set<string>([
  "bank_account_number",
  "bank_holder_name",
  "bank_name",
  "bank_branch",
]);

// Non-terminal states — Cancel button is available for these.
const NON_TERMINAL = new Set<string>([
  "pending_approval",
  "approved",
  "contract_sent",
  "contract_signed",
  "qr_sent",
  "checked_in",
  "waitlisted",
]);

function labelFor(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

export function RegistrationDetailView({
  regId,
  onChange,
}: {
  regId: number;
  onChange?: () => void;
}): React.ReactElement {
  const { token } = useAuth();

  const [detail, setDetail] = useState<RegistrationDetail | null>(null);
  const [editingNotes, setEditingNotes] = useState("");
  const [editingDays, setEditingDays] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectBusy, setRejectBusy] = useState(false);
  const [clearSusOpen, setClearSusOpen] = useState(false);
  const [clearSusNote, setClearSusNote] = useState("");
  const [clearSusBusy, setClearSusBusy] = useState(false);
  // v1.4.1 — pending profile-edit approval state
  const [rejectChangesOpen, setRejectChangesOpen] = useState(false);
  const [rejectChangesReason, setRejectChangesReason] = useState("");
  const [changesBusy, setChangesBusy] = useState(false);
  // v2.0 — force-paid / backfill / dispute dialogs
  const [forcePaidOpen, setForcePaidOpen] = useState(false);
  const [forcePaidBusy, setForcePaidBusy] = useState(false);
  const [backfillOpen, setBackfillOpen] = useState(false);
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeBusy, setDisputeBusy] = useState(false);
  const [acceptanceBusy, setAcceptanceBusy] = useState(false);
  const [loadingAcceptancePdf, setLoadingAcceptancePdf] = useState(false);
  // v2.1 — edit profile + Bên B inline form
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editProfileBusy, setEditProfileBusy] = useState(false);
  const [editProfile, setEditProfile] = useState({
    full_name: "",
    phone: "",
    email: "",
    shirt_size: "",
    birth_date: "",
    cccd: "",
    cccd_issue_date: "",
    cccd_issue_place: "",
    bank_account_number: "",
    bank_holder_name: "",
    bank_name: "",
    bank_branch: "",
    address: "",
  });

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const d = await getRegistrationDetail(token, regId);
      setDetail(d);
      setEditingNotes(d.notes ?? "");
      if (d.actual_working_days != null) setEditingDays(d.actual_working_days);
      else if (d.role_working_days != null) setEditingDays(d.role_working_days);
      else setEditingDays("");
      // Hydrate edit-profile form from current values. form_data fields
      // may be missing for old registrations — fall back to "".
      const fd = (d.form_data ?? {}) as Record<string, unknown>;
      const pickStr = (v: unknown): string =>
        typeof v === "string" ? v : v == null ? "" : String(v);
      // Read from public-register keys: cccd / dob (legacy) — fall back
      // to entity columns / new keys if old data ever wrote those.
      // birth_date entity column wins over form_data.dob if both set.
      setEditProfile({
        full_name: d.full_name ?? "",
        phone: d.phone ?? "",
        email: d.email ?? "",
        shirt_size: d.shirt_size ?? pickStr(fd.shirt_size),
        // Store dates as dd/mm/yyyy in edit-form state; convert to ISO on save.
        birth_date: isoToVNField(d.birth_date ?? pickStr(fd.dob)),
        cccd: pickStr(fd.cccd) || pickStr(fd.cccd_number),
        cccd_issue_date: isoToVNField(d.cccd_issue_date),
        cccd_issue_place: d.cccd_issue_place ?? "",
        bank_account_number: pickStr(fd.bank_account_number),
        bank_holder_name: pickStr(fd.bank_holder_name),
        bank_name: pickStr(fd.bank_name),
        bank_branch: pickStr(fd.bank_branch),
        address: pickStr(fd.address),
      });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [token, regId]);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  useEffect(() => {
    if (!token || !detail) {
      setSignatureUrl(null);
      return;
    }
    if (detail.contract_status !== "signed" || !detail.has_signature) {
      setSignatureUrl(null);
      return;
    }
    let cancelled = false;
    getSignatureUrl(token, detail.id)
      .then((res) => {
        if (!cancelled) setSignatureUrl(res.url);
      })
      .catch(() => {
        if (!cancelled) setSignatureUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token, detail]);

  const statusKey = useMemo(
    () => (detail ? deriveStatusKey(detail) : "pending_approval"),
    [detail],
  );
  const isPending = statusKey === "pending_approval";
  const isCheckedIn = statusKey === "checked_in";
  const canCancel = detail ? NON_TERMINAL.has(detail.status) : false;
  const suspicious = detail?.suspicious_checkin === true;

  async function handleApprove(): Promise<void> {
    if (!token || !detail) return;
    if (!confirm(`Duyệt đăng ký của ${detail.full_name}?`)) return;
    setSaving(true);
    try {
      await approveRegistration(token, regId);
      toast.success("Đã duyệt");
      await load();
      onChange?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleReject(reason: string): Promise<void> {
    if (!token || !detail) return;
    setRejectBusy(true);
    try {
      // Reject comes from the shared lib via the registrations index page —
      // but this Sheet is self-contained, call it directly.
      const { rejectRegistration } = await import("@/lib/team-api");
      await rejectRegistration(token, regId, reason);
      toast.success("Đã từ chối");
      setRejectOpen(false);
      await load();
      onChange?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRejectBusy(false);
    }
  }

  async function handleCancel(): Promise<void> {
    if (!token || !detail) return;
    const reason = window.prompt(
      `Lý do huỷ đăng ký của ${detail.full_name}? (tuỳ chọn)`,
    );
    if (reason === null) return;
    setSaving(true);
    try {
      await cancelRegistration(token, regId, reason || undefined);
      toast.success("Đã huỷ");
      await load();
      onChange?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmCompletion(): Promise<void> {
    if (!token || !detail) return;
    const note = window.prompt(
      `Ghi chú cho xác nhận hoàn thành của ${detail.full_name}? (tuỳ chọn)`,
    );
    if (note === null) return;
    setSaving(true);
    try {
      await confirmCompletion(token, regId, note || undefined);
      toast.success("Đã xác nhận hoàn thành");
      await load();
      onChange?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleClearSuspicious(): Promise<void> {
    if (!token || !detail) return;
    const trimmed = clearSusNote.trim();
    if (trimmed.length < 5) {
      toast.error("Ghi chú phải ≥ 5 ký tự");
      return;
    }
    setClearSusBusy(true);
    try {
      await clearSuspicious(token, regId, trimmed);
      toast.success("Đã xác nhận OK");
      setClearSusOpen(false);
      setClearSusNote("");
      await load();
      onChange?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setClearSusBusy(false);
    }
  }

  async function handleApproveChanges(): Promise<void> {
    if (!token || !detail) return;
    if (!confirm(`Duyệt các thay đổi của ${detail.full_name}?`)) return;
    setChangesBusy(true);
    try {
      await approveProfileChanges(token, regId);
      toast.success("Đã duyệt thay đổi");
      await load();
      onChange?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setChangesBusy(false);
    }
  }

  async function handleRejectChanges(): Promise<void> {
    if (!token || !detail) return;
    const trimmed = rejectChangesReason.trim();
    if (trimmed.length < 3) {
      toast.error("Lý do phải ≥ 3 ký tự");
      return;
    }
    setChangesBusy(true);
    try {
      await rejectProfileChanges(token, regId, trimmed);
      toast.success("Đã từ chối thay đổi");
      setRejectChangesOpen(false);
      setRejectChangesReason("");
      await load();
      onChange?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setChangesBusy(false);
    }
  }

  async function saveNotes(): Promise<void> {
    if (!token || !detail) return;
    setSaving(true);
    try {
      await patchRegistration(token, regId, { notes: editingNotes });
      toast.success("Đã lưu ghi chú");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function saveEditProfile(): Promise<void> {
    if (!token || !detail) return;
    // Warn before overwriting a signed contract — backend will reset
    // contract_status='not_sent' + roll back state to 'approved' so admin
    // must re-send. Old PDF stays in S3 for audit (logged server-side).
    const fd = (detail.form_data ?? {}) as Record<string, unknown>;
    const fdStr = (k: string): string =>
      typeof fd[k] === "string" ? (fd[k] as string) : "";
    // birth_date / cccd_issue_date in editProfile are VN format (dd/mm/yyyy);
    // convert the stored ISO values to VN format for comparison.
    const contractAffectingChanged =
      editProfile.full_name !== (detail.full_name ?? "") ||
      editProfile.phone !== (detail.phone ?? "") ||
      editProfile.email !== (detail.email ?? "") ||
      editProfile.birth_date !== isoToVNField(detail.birth_date ?? fdStr("dob")) ||
      editProfile.cccd_issue_date !== isoToVNField(detail.cccd_issue_date) ||
      editProfile.cccd_issue_place !== (detail.cccd_issue_place ?? "") ||
      editProfile.cccd !== (fdStr("cccd") || fdStr("cccd_number")) ||
      editProfile.bank_account_number !== fdStr("bank_account_number") ||
      editProfile.bank_holder_name !== fdStr("bank_holder_name") ||
      editProfile.bank_name !== fdStr("bank_name") ||
      editProfile.bank_branch !== fdStr("bank_branch") ||
      editProfile.address !== fdStr("address");
    if (
      detail.contract_status === "signed" &&
      contractAffectingChanged &&
      !window.confirm(
        "Hợp đồng đã ký sẽ bị huỷ và phải gửi lại để CTV ký mới. " +
          "PDF cũ vẫn lưu trên S3 cho audit. Tiếp tục?",
      )
    ) {
      return;
    }
    // Parse VN-format dates back to ISO before sending to API.
    const birthDateIso = editProfile.birth_date
      ? parseDateVN(editProfile.birth_date)
      : null;
    const issueDateIso = editProfile.cccd_issue_date
      ? parseDateVN(editProfile.cccd_issue_date)
      : null;
    if (editProfile.birth_date && birthDateIso === null) {
      toast.error("Ngày sinh không hợp lệ — nhập theo định dạng dd/mm/yyyy");
      return;
    }
    if (editProfile.cccd_issue_date && issueDateIso === null) {
      toast.error("Ngày cấp CCCD không hợp lệ — nhập theo định dạng dd/mm/yyyy");
      return;
    }
    setEditProfileBusy(true);
    try {
      await patchRegistration(token, regId, {
        full_name: editProfile.full_name,
        phone: editProfile.phone,
        email: editProfile.email,
        shirt_size: editProfile.shirt_size || null,
        birth_date: birthDateIso,
        cccd: editProfile.cccd || null,
        cccd_issue_date: issueDateIso,
        cccd_issue_place: editProfile.cccd_issue_place || null,
        bank_account_number: editProfile.bank_account_number || null,
        bank_holder_name: editProfile.bank_holder_name || null,
        bank_name: editProfile.bank_name || null,
        bank_branch: editProfile.bank_branch || null,
        address: editProfile.address || null,
      });
      toast.success(
        contractAffectingChanged && detail.contract_status === "signed"
          ? "Đã lưu — HĐ cũ bị huỷ, vào tab Hợp đồng để gửi lại"
          : "Đã lưu thông tin",
      );
      setEditProfileOpen(false);
      await load();
      onChange?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setEditProfileBusy(false);
    }
  }

  async function saveWorkingDays(): Promise<void> {
    if (!token || !detail) return;
    if (typeof editingDays !== "number") return;
    setSaving(true);
    try {
      await patchRegistration(token, regId, {
        actual_working_days: editingDays,
      });
      toast.success("Đã lưu số ngày công");
      await load();
      onChange?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkPaid(): Promise<void> {
    if (!token || !detail) return;
    setSaving(true);
    try {
      if (typeof editingDays === "number") {
        await patchRegistration(token, regId, {
          actual_working_days: editingDays,
        });
      }
      await markPaid(token, regId);
      toast.success("Đã đánh dấu thanh toán");
      await load();
      onChange?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleForcePaid(reason: string): Promise<void> {
    if (!token || !detail) return;
    setForcePaidBusy(true);
    try {
      if (typeof editingDays === "number") {
        await patchRegistration(token, regId, {
          actual_working_days: editingDays,
        });
      }
      await forcePaid(token, regId, reason);
      toast.success("Đã cưỡng bức thanh toán (ghi log)");
      setForcePaidOpen(false);
      await load();
      onChange?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setForcePaidBusy(false);
    }
  }

  async function handleRevertPaid(): Promise<void> {
    if (!token || !detail) return;
    setSaving(true);
    try {
      await revertPaid(token, regId);
      toast.success("Đã hoàn tác về chờ thanh toán");
      await load();
      onChange?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSendAcceptance(): Promise<void> {
    if (!token || !detail) return;
    setAcceptanceBusy(true);
    try {
      await sendAcceptanceOne(token, regId);
      toast.success("Đã gửi biên bản nghiệm thu — crew nhận email trong vài phút");
      await load();
      onChange?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setAcceptanceBusy(false);
    }
  }

  async function handleDispute(reason: string): Promise<void> {
    if (!token || !detail) return;
    setDisputeBusy(true);
    try {
      await disputeAcceptance(token, regId, reason);
      toast.success("Đã đánh dấu tranh chấp");
      setDisputeOpen(false);
      await load();
      onChange?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDisputeBusy(false);
    }
  }

  async function handleBackfill(body: BackfillBenBInput): Promise<void> {
    if (!token || !detail) return;
    setBackfillBusy(true);
    try {
      await backfillBenB(token, regId, body);
      toast.success("Đã cập nhật thông tin Bên B");
      setBackfillOpen(false);
      await load();
      onChange?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBackfillBusy(false);
    }
  }

  async function openAcceptancePdf(): Promise<void> {
    if (!token || !detail) return;
    setLoadingAcceptancePdf(true);
    try {
      const { url } = await getSignedAcceptanceUrl(token, detail.magic_token);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoadingAcceptancePdf(false);
    }
  }

  async function openSignedPdf(): Promise<void> {
    if (!token || !detail) return;
    setLoadingPdf(true);
    try {
      const { url } = await getSignedContractUrl(token, detail.id);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoadingPdf(false);
    }
  }

  if (!detail) return <Skeleton className="h-96" />;

  const dailyRate =
    detail.role_daily_rate != null ? Number(detail.role_daily_rate) : null;
  const workingDays =
    typeof editingDays === "number" ? editingDays : null;
  const computedPay =
    dailyRate != null && workingDays != null ? dailyRate * workingDays : null;
  const paid = detail.payment_status === "paid";

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-start gap-4 rounded-lg border p-4 sm:flex-row sm:items-center">
        {detail.avatar_photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={detail.avatar_photo_url}
            alt=""
            className="size-24 rounded-lg object-cover"
          />
        ) : (
          <div className="size-24 rounded-lg bg-muted" />
        )}
        <div className="flex-1">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight text-gradient">
                {detail.full_name}
              </h2>
              <p className="text-sm text-muted-foreground">
                {detail.role_name} · {detail.event_name}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={statusKey} />
              {isPending ? (
                <>
                  <Button
                    size="sm"
                    disabled={saving}
                    onClick={() => {
                      void handleApprove();
                    }}
                  >
                    <Check className="mr-1 size-4" /> Duyệt
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    onClick={() => setRejectOpen(true)}
                  >
                    <X className="mr-1 size-4" /> Từ chối
                  </Button>
                </>
              ) : null}
              {isCheckedIn ? (
                <Button
                  size="sm"
                  disabled={saving}
                  onClick={() => {
                    void handleConfirmCompletion();
                  }}
                >
                  <CheckCircle2 className="mr-1 size-4" /> Xác nhận hoàn thành
                </Button>
              ) : null}
              {canCancel ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={() => {
                    void handleCancel();
                  }}
                >
                  <Ban className="mr-1 size-4" /> Huỷ
                </Button>
              ) : null}
            </div>
          </div>
          <p className="text-sm mt-1">
            SĐT: {detail.phone} · Email: {detail.email}
          </p>
          <p className="text-sm">
            Size áo: {detail.shirt_size ?? "—"} · Check-in:{" "}
            {detail.checked_in_at
              ? `✅ ${new Date(detail.checked_in_at).toLocaleString("vi-VN")}`
              : "⏳ Chưa"}
          </p>
        </div>
      </div>

      {suspicious ? (
        <div
          className="rounded-lg border p-3"
          style={{
            background: "#fee2e2",
            borderColor: "#fca5a5",
            color: "#991b1b",
          }}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="size-5 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-semibold">Check-in đáng ngờ</p>
              <p className="mt-0.5">
                Thời gian giữa check-in và xác nhận hoàn thành quá ngắn — cần
                xem xét trước khi thanh toán.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setClearSusOpen(true)}
            >
              Xác nhận OK
            </Button>
          </div>
        </div>
      ) : null}

      {detail.rejection_reason ? (
        <div
          className="rounded-lg border p-3 text-sm"
          style={{
            background: "#fef2f2",
            borderColor: "#fecaca",
            color: "#7f1d1d",
          }}
        >
          <p className="font-semibold">Lý do từ chối</p>
          <p className="mt-0.5 whitespace-pre-wrap">{detail.rejection_reason}</p>
        </div>
      ) : null}

      {detail.has_pending_changes ? (
        <div
          className="rounded-lg border p-3"
          style={{
            background: "#fef3c7",
            borderColor: "#fcd34d",
            color: "#92400e",
          }}
          data-testid="pending-changes-admin-banner"
        >
          <div className="flex items-start gap-2">
            <Pencil className="size-5 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-semibold">TNV đã gửi yêu cầu chỉnh sửa</p>
              <p className="mt-0.5">
                {detail.pending_changes_submitted_at
                  ? `Gửi lúc ${new Date(detail.pending_changes_submitted_at).toLocaleString("vi-VN")}`
                  : "Đang chờ duyệt"}
                . Xem chi tiết ở tab &quot;Thông tin&quot; để so sánh.
              </p>
            </div>
            <Button
              size="sm"
              disabled={changesBusy}
              onClick={() => {
                void handleApproveChanges();
              }}
            >
              <Check className="mr-1 size-4" /> Duyệt thay đổi
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={changesBusy}
              onClick={() => setRejectChangesOpen(true)}
            >
              <X className="mr-1 size-4" /> Từ chối
            </Button>
          </div>
        </div>
      ) : null}

      {detail.completion_confirmed_at ? (
        <div
          className="rounded-lg border p-3 text-sm"
          style={{
            background: "#ede9fe",
            borderColor: "#c4b5fd",
            color: "#4c1d95",
          }}
        >
          <p className="font-semibold">Đã xác nhận hoàn thành</p>
          <p className="mt-0.5">
            {new Date(detail.completion_confirmed_at).toLocaleString("vi-VN")} ·
            bởi{" "}
            {detail.completion_confirmed_by === "leader"
              ? "Leader"
              : "Admin"}
          </p>
        </div>
      ) : null}

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Thông tin</TabsTrigger>
          <TabsTrigger value="contract">Hợp đồng</TabsTrigger>
          <TabsTrigger value="acceptance">Nghiệm thu</TabsTrigger>
          <TabsTrigger value="payment">Thanh toán</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-3">
          {detail.has_pending_changes && detail.pending_changes ? (
            <div className="rounded-lg border p-4">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Pencil className="size-4" /> Đề xuất thay đổi — chờ duyệt
              </h3>
              <DiffTable
                current={{
                  full_name: detail.full_name,
                  phone: detail.phone,
                  form_data: detail.form_data,
                }}
                proposed={detail.pending_changes}
              />
            </div>
          ) : null}

          {/* v2.1 — admin edit profile + Bên B */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Thông tin Bên B</h3>
              {!editProfileOpen ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditProfileOpen(true)}
                >
                  <Pencil className="size-3.5 mr-1" /> Sửa
                </Button>
              ) : null}
            </div>
            {editProfileOpen ? (
              <>
                {detail.contract_status === "signed" ? (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 flex gap-2">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                    <div>
                      Hợp đồng đã ký. Sửa các trường tên / SĐT / email / CCCD /
                      ngân hàng / địa chỉ → hệ thống sẽ huỷ HĐ cũ, bạn phải gửi
                      lại để CTV ký mới. PDF cũ giữ trên S3 cho audit.
                    </div>
                  </div>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2 text-sm">
                  <div>
                    <Label>Họ tên</Label>
                    <Input
                      value={editProfile.full_name}
                      onChange={(e) =>
                        setEditProfile((p) => ({
                          ...p,
                          full_name: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label>SĐT</Label>
                    <Input
                      value={editProfile.phone}
                      onChange={(e) =>
                        setEditProfile((p) => ({ ...p, phone: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={editProfile.email}
                      onChange={(e) =>
                        setEditProfile((p) => ({ ...p, email: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Size áo</Label>
                    <select
                      className="w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                      value={editProfile.shirt_size}
                      onChange={(e) =>
                        setEditProfile((p) => ({
                          ...p,
                          shirt_size: e.target.value,
                        }))
                      }
                    >
                      <option value="">— chưa chọn —</option>
                      {(
                        ["XS", "S", "M", "L", "XL", "XXL", "XXXL"] as const
                      ).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Ngày sinh</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="dd/mm/yyyy"
                      value={editProfile.birth_date}
                      onChange={(e) =>
                        setEditProfile((p) => ({
                          ...p,
                          birth_date: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Số CCCD</Label>
                    <Input
                      value={editProfile.cccd}
                      onChange={(e) =>
                        setEditProfile((p) => ({
                          ...p,
                          cccd: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Ngày cấp CCCD</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="dd/mm/yyyy"
                      value={editProfile.cccd_issue_date}
                      onChange={(e) =>
                        setEditProfile((p) => ({
                          ...p,
                          cccd_issue_date: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Nơi cấp CCCD</Label>
                    <Input
                      value={editProfile.cccd_issue_place}
                      onChange={(e) =>
                        setEditProfile((p) => ({
                          ...p,
                          cccd_issue_place: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Địa chỉ</Label>
                    <Input
                      value={editProfile.address}
                      onChange={(e) =>
                        setEditProfile((p) => ({
                          ...p,
                          address: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Số tài khoản</Label>
                    <Input
                      value={editProfile.bank_account_number}
                      onChange={(e) =>
                        setEditProfile((p) => ({
                          ...p,
                          bank_account_number: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Chủ tài khoản</Label>
                    <Input
                      value={editProfile.bank_holder_name}
                      onChange={(e) =>
                        setEditProfile((p) => ({
                          ...p,
                          bank_holder_name: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Ngân hàng</Label>
                    <Input
                      value={editProfile.bank_name}
                      onChange={(e) =>
                        setEditProfile((p) => ({
                          ...p,
                          bank_name: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Chi nhánh</Label>
                    <Input
                      value={editProfile.bank_branch}
                      onChange={(e) =>
                        setEditProfile((p) => ({
                          ...p,
                          bank_branch: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      void saveEditProfile();
                    }}
                    disabled={editProfileBusy}
                  >
                    {editProfileBusy ? "Đang lưu..." : "Lưu"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditProfileOpen(false);
                      void load();
                    }}
                    disabled={editProfileBusy}
                  >
                    Huỷ
                  </Button>
                </div>
              </>
            ) : (
              <dl className="grid gap-3 sm:grid-cols-2 text-sm">
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">
                    Họ tên
                  </dt>
                  <dd>{detail.full_name}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">
                    SĐT
                  </dt>
                  <dd>{detail.phone}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">
                    Email
                  </dt>
                  <dd className="break-all">{detail.email}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">
                    Size áo
                  </dt>
                  <dd>{detail.shirt_size ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">
                    Ngày sinh
                  </dt>
                  <dd>{formatDateVN(detail.birth_date ?? (detail.form_data?.dob as string | undefined))}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">
                    Ngày cấp CCCD
                  </dt>
                  <dd>{formatDateVN(detail.cccd_issue_date)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">
                    Nơi cấp CCCD
                  </dt>
                  <dd>{detail.cccd_issue_place ?? "—"}</dd>
                </div>
              </dl>
            )}
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <div>
              <h3 className="font-semibold mb-2">Dữ liệu form</h3>
              {(() => {
                const entries = Object.entries(detail.form_data);
                const nonBank = entries.filter(([k]) => !BANK_KEYS.has(k));
                const bank = entries.filter(([k]) => BANK_KEYS.has(k));
                // Keys whose values are date strings (YYYY-MM-DD) — display as dd/mm/yyyy.
                const DATE_KEYS = new Set(["dob", "birth_date"]);
                const renderEntry = ([key, value]: [string, unknown]) => {
                  const isPhoto =
                    key === "cccd_photo" || key === "avatar_photo";
                  const photoUrl =
                    key === "cccd_photo"
                      ? detail.cccd_photo_url
                      : key === "avatar_photo"
                        ? detail.avatar_photo_url
                        : null;
                  return (
                    <div key={key}>
                      <dt className="text-xs font-medium text-muted-foreground">
                        {labelFor(key)}
                      </dt>
                      <dd className="break-all">
                        {isPhoto ? (
                          photoUrl ? (
                            <a
                              href={photoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-block"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={photoUrl}
                                alt={labelFor(key)}
                                className="mt-1 h-24 rounded border object-cover"
                              />
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              (chưa có ảnh)
                            </span>
                          )
                        ) : DATE_KEYS.has(key) && typeof value === "string" ? (
                          formatDateVN(value)
                        ) : typeof value === "string" ||
                          typeof value === "number" ? (
                          String(value)
                        ) : (
                          <code className="text-xs">
                            {JSON.stringify(value)}
                          </code>
                        )}
                      </dd>
                    </div>
                  );
                };
                return (
                  <>
                    <dl className="grid gap-3 sm:grid-cols-2 text-sm">
                      {nonBank.map(renderEntry)}
                    </dl>
                    {bank.length > 0 ? (
                      <div className="mt-4 border-t pt-3">
                        <h4 className="text-sm font-semibold mb-2">
                          Thông tin thanh toán
                        </h4>
                        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
                          {bank.map(renderEntry)}
                        </dl>
                      </div>
                    ) : null}
                  </>
                );
              })()}
            </div>

            {detail.cccd_photo_url ? (
              <p className="text-xs text-muted-foreground">
                Link ảnh CCCD hết hạn sau 1 giờ — refresh trang để lấy link mới.
              </p>
            ) : null}

            <MagicLinkSection
              magicLink={detail.magic_link}
              expiresAt={detail.magic_token_expires}
            />

            <div>
              <Label>Ghi chú admin</Label>
              <Textarea
                rows={3}
                value={editingNotes}
                onChange={(e) => setEditingNotes(e.target.value)}
                placeholder="Ghi chú nội bộ..."
              />
              <Button
                size="sm"
                className="mt-2"
                onClick={() => {
                  void saveNotes();
                }}
                disabled={saving}
              >
                Lưu ghi chú
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="contract" className="space-y-3">
          <div className="rounded-lg border p-4 space-y-3">
            <div>
              <strong>Trạng thái:</strong>{" "}
              {detail.contract_status === "signed"
                ? "✅ Đã ký"
                : detail.contract_status === "sent"
                  ? "⏳ Đã gửi, chờ ký"
                  : "Chưa gửi"}
            </div>
            {detail.contract_signed_at ? (
              <div className="text-sm">
                Ký vào:{" "}
                {new Date(detail.contract_signed_at).toLocaleString("vi-VN")}
              </div>
            ) : null}
            {detail.contract_status === "signed" && detail.has_signature ? (
              <div>
                <Label className="text-xs">Chữ ký</Label>
                {signatureUrl ? (
                  <div className="mt-1 inline-block rounded border bg-white p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={signatureUrl}
                      alt="Chữ ký của người ký"
                      className="h-24 object-contain"
                    />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Đang tải link chữ ký...
                  </p>
                )}
              </div>
            ) : null}
            {detail.contract_status === "signed" ? (
              <div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loadingPdf}
                  onClick={() => {
                    void openSignedPdf();
                  }}
                >
                  <ExternalLink className="mr-2 size-4" />
                  {loadingPdf ? "Đang tạo link..." : "Xem hợp đồng đã ký"}
                </Button>
                <p className="text-xs text-muted-foreground mt-1">
                  Link presigned 10 phút — mở tab mới.
                </p>
              </div>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="acceptance" className="space-y-3">
          <AcceptancePanel
            detail={detail}
            busy={acceptanceBusy}
            loadingPdf={loadingAcceptancePdf}
            onSend={handleSendAcceptance}
            onDispute={() => setDisputeOpen(true)}
            onOpenPdf={openAcceptancePdf}
            onBackfill={() => setBackfillOpen(true)}
          />
        </TabsContent>

        <TabsContent value="payment" className="space-y-3">
          <div className="rounded-lg border p-4 space-y-3">
            <div>
              <Label>Số ngày công thực tế</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={0}
                  value={editingDays === "" ? "" : editingDays}
                  onChange={(e) => {
                    const v = e.target.value;
                    setEditingDays(v === "" ? "" : Number(v));
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void saveWorkingDays();
                  }}
                  disabled={saving || typeof editingDays !== "number"}
                >
                  Lưu
                </Button>
              </div>
              {detail.actual_working_days == null &&
              detail.role_working_days != null ? (
                <p className="text-xs text-muted-foreground mt-1">
                  Mặc định theo vai trò: {detail.role_working_days} ngày.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <span className="text-xs text-muted-foreground">Hiện tại</span>
                <div className="font-medium">
                  {paid ? "✅ Đã thanh toán" : "⏳ Chờ"}
                </div>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Nghiệm thu</span>
                <div className="font-medium">
                  {acceptanceStatusLabel(detail.acceptance_status)}
                </div>
              </div>
              {dailyRate != null ? (
                <div>
                  <span className="text-xs text-muted-foreground">
                    Đơn giá
                  </span>
                  <div className="font-medium">
                    {dailyRate.toLocaleString("vi-VN")} ₫/ngày
                  </div>
                </div>
              ) : null}
              {computedPay != null ? (
                <div>
                  <span className="text-xs text-muted-foreground">
                    Thành tiền (dự kiến)
                  </span>
                  <div className="font-medium">
                    {computedPay.toLocaleString("vi-VN")} ₫
                  </div>
                </div>
              ) : null}
              {detail.actual_compensation ? (
                <div>
                  <span className="text-xs text-muted-foreground">Đã lưu</span>
                  <div className="font-medium">
                    {Number(detail.actual_compensation).toLocaleString(
                      "vi-VN",
                    )}{" "}
                    ₫
                  </div>
                </div>
              ) : null}
            </div>

            {/* Force-paid audit banner when this row was forced */}
            {detail.payment_forced_reason ? (
              <div
                className="rounded-md border p-3 text-xs"
                style={{
                  background: "#fffbeb",
                  borderColor: "#fde68a",
                  color: "#78350f",
                }}
              >
                <div className="font-semibold">
                  ⚠️ Đã cưỡng bức thanh toán (bỏ qua nghiệm thu)
                </div>
                <div className="mt-0.5">
                  {detail.payment_forced_at
                    ? new Date(detail.payment_forced_at).toLocaleString("vi-VN")
                    : null}
                  {detail.payment_forced_by
                    ? ` · bởi ${detail.payment_forced_by}`
                    : null}
                </div>
                <div className="mt-1 whitespace-pre-wrap">
                  {detail.payment_forced_reason}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {!paid ? (
                <>
                  <Button
                    size="sm"
                    disabled={
                      saving ||
                      suspicious ||
                      detail.acceptance_status !== "signed"
                    }
                    title={
                      suspicious
                        ? "Cần xem xét suspicious flag trước — bấm Xác nhận OK ở banner đỏ bên trên"
                        : detail.acceptance_status !== "signed"
                          ? "Crew chưa ký biên bản nghiệm thu. Dùng nút Cưỡng bức nếu cần bypass."
                          : undefined
                    }
                    onClick={() => {
                      void handleMarkPaid();
                    }}
                  >
                    Đánh dấu đã thanh toán
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving || suspicious}
                    onClick={() => setForcePaidOpen(true)}
                  >
                    Cưỡng bức thanh toán
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={() => {
                    void handleRevertPaid();
                  }}
                >
                  Hoàn tác về chờ
                </Button>
              )}
            </div>
            {!paid && detail.acceptance_status !== "signed" ? (
              <p className="text-xs text-muted-foreground">
                Cổng thanh toán: chỉ cho phép khi biên bản nghiệm thu đã ký.
                Dùng <em>Cưỡng bức</em> với lý do bắt buộc nếu cần bypass.
              </p>
            ) : null}
            {suspicious ? (
              <p className="text-xs text-red-600">
                Không thể đánh dấu đã thanh toán khi đăng ký đang được flag là
                đáng ngờ.
              </p>
            ) : null}
          </div>
        </TabsContent>
      </Tabs>

      <RejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        target={{ count: 1, label: detail.full_name }}
        busy={rejectBusy}
        onConfirm={handleReject}
      />

      <ClearSuspiciousDialog
        open={clearSusOpen}
        onOpenChange={(v) => {
          if (!clearSusBusy) setClearSusOpen(v);
        }}
        note={clearSusNote}
        onNoteChange={setClearSusNote}
        busy={clearSusBusy}
        onConfirm={handleClearSuspicious}
      />

      <RejectChangesDialog
        open={rejectChangesOpen}
        onOpenChange={(v) => {
          if (!changesBusy) setRejectChangesOpen(v);
        }}
        reason={rejectChangesReason}
        onReasonChange={setRejectChangesReason}
        busy={changesBusy}
        onConfirm={handleRejectChanges}
      />

      <ForcePaidDialog
        open={forcePaidOpen}
        onOpenChange={setForcePaidOpen}
        name={detail.full_name}
        acceptanceStatus={detail.acceptance_status}
        busy={forcePaidBusy}
        onConfirm={handleForcePaid}
      />

      <BackfillBenBDialog
        open={backfillOpen}
        onOpenChange={setBackfillOpen}
        name={detail.full_name}
        initial={{
          birth_date: detail.birth_date,
          cccd_issue_date: detail.cccd_issue_date,
          cccd_issue_place: detail.cccd_issue_place,
          bank_account_number:
            (detail.form_data?.bank_account_number as string | undefined) ??
            null,
          bank_name:
            (detail.form_data?.bank_name as string | undefined) ?? null,
          address:
            (detail.form_data?.address as string | undefined) ?? null,
        }}
        busy={backfillBusy}
        onConfirm={handleBackfill}
      />

      <DisputeDialog
        open={disputeOpen}
        onOpenChange={setDisputeOpen}
        name={detail.full_name}
        busy={disputeBusy}
        onConfirm={handleDispute}
      />
    </div>
  );
}

// ─── Acceptance tab panel + helpers ────────────────────────────────────
function acceptanceStatusLabel(status: RegistrationDetail["acceptance_status"]): string {
  switch (status) {
    case "not_ready":
      return "⏸ Chưa gửi";
    case "pending_sign":
      return "⏳ Chờ crew ký";
    case "signed":
      return "✅ Đã ký";
    case "disputed":
      return "⚠️ Tranh chấp";
    default:
      return status;
  }
}

function AcceptancePanel({
  detail,
  busy,
  loadingPdf,
  onSend,
  onDispute,
  onOpenPdf,
  onBackfill,
}: {
  detail: RegistrationDetail;
  busy: boolean;
  loadingPdf: boolean;
  onSend: () => void | Promise<void>;
  onDispute: () => void;
  onOpenPdf: () => void | Promise<void>;
  onBackfill: () => void;
}): React.ReactElement {
  const st = detail.acceptance_status;
  // Minimum Bên B fields required by server to actually generate PDF.
  const form = detail.form_data ?? {};
  const missing: string[] = [];
  if (!detail.birth_date) missing.push("Ngày sinh");
  if (!detail.cccd_issue_date) missing.push("Ngày cấp CCCD");
  if (!detail.cccd_issue_place) missing.push("Nơi cấp CCCD");
  if (!form.bank_account_number) missing.push("Số tài khoản");
  if (!form.bank_name) missing.push("Ngân hàng");
  if (!form.address) missing.push("Địa chỉ");

  const cannotSend =
    detail.status !== "completed" || missing.length > 0 || busy;

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <span className="text-xs text-muted-foreground">Trạng thái</span>
          <div className="font-medium">{acceptanceStatusLabel(st)}</div>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Số HĐ</span>
          <div className="font-medium font-mono text-sm">
            {detail.contract_number ?? "—"}
          </div>
        </div>
        {detail.acceptance_value != null ? (
          <div>
            <span className="text-xs text-muted-foreground">Giá trị</span>
            <div className="font-medium">
              {detail.acceptance_value.toLocaleString("vi-VN")} ₫
            </div>
          </div>
        ) : null}
        {detail.acceptance_sent_at ? (
          <div>
            <span className="text-xs text-muted-foreground">Đã gửi</span>
            <div className="font-medium">
              {new Date(detail.acceptance_sent_at).toLocaleString("vi-VN")}
            </div>
          </div>
        ) : null}
        {detail.acceptance_signed_at ? (
          <div>
            <span className="text-xs text-muted-foreground">Đã ký</span>
            <div className="font-medium">
              {new Date(detail.acceptance_signed_at).toLocaleString("vi-VN")}
            </div>
          </div>
        ) : null}
      </div>

      {st === "disputed" && detail.acceptance_notes ? (
        <div
          className="rounded-md border p-3 text-xs"
          style={{
            background: "#fef2f2",
            borderColor: "#fecaca",
            color: "#7f1d1d",
          }}
        >
          <div className="font-semibold">⚠️ Tranh chấp</div>
          <div className="mt-1 whitespace-pre-wrap">{detail.acceptance_notes}</div>
        </div>
      ) : null}

      {missing.length > 0 ? (
        <div
          className="rounded-md border p-3 text-xs"
          style={{
            background: "#fffbeb",
            borderColor: "#fde68a",
            color: "#78350f",
          }}
        >
          <div className="font-semibold">
            Thiếu thông tin Bên B — cần bổ sung trước khi gửi
          </div>
          <ul className="mt-1 list-disc list-inside">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={onBackfill}
          >
            <Pencil className="mr-1 size-3.5" /> Bổ sung thông tin Bên B
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={onBackfill}>
          <Pencil className="mr-1 size-3.5" /> Sửa thông tin Bên B
        </Button>
      )}

      <div className="flex flex-wrap gap-2">
        {st === "not_ready" || st === "pending_sign" || st === "disputed" ? (
          <Button
            size="sm"
            disabled={cannotSend}
            onClick={() => {
              void onSend();
            }}
            title={
              detail.status !== "completed"
                ? "Chỉ gửi nghiệm thu sau khi hoàn thành sự kiện (status=completed)"
                : missing.length
                  ? "Bổ sung thông tin Bên B trước"
                  : undefined
            }
          >
            {busy
              ? "Đang gửi..."
              : st === "not_ready"
                ? "Gửi biên bản nghiệm thu"
                : "Gửi lại"}
          </Button>
        ) : null}

        {(st === "pending_sign" || st === "signed") ? (
          <Button
            size="sm"
            variant="outline"
            onClick={onDispute}
            disabled={busy}
          >
            Đánh dấu tranh chấp
          </Button>
        ) : null}

        {st === "signed" ? (
          <Button
            size="sm"
            variant="outline"
            disabled={loadingPdf}
            onClick={() => {
              void onOpenPdf();
            }}
          >
            <ExternalLink className="mr-2 size-4" />
            {loadingPdf ? "Đang tạo link..." : "Xem biên bản đã ký"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function DiffTable({
  current,
  proposed,
}: {
  current: { full_name: string; phone: string; form_data: Record<string, unknown> };
  proposed: Record<string, unknown>;
}): React.ReactElement {
  const rows: Array<{ key: string; label: string; cur: unknown; next: unknown }> = [];
  const labelFor = (k: string): string => FIELD_LABELS[k] ?? k;
  const eq = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

  if (typeof proposed.full_name === "string" && !eq(proposed.full_name, current.full_name)) {
    rows.push({ key: "full_name", label: "Họ tên", cur: current.full_name, next: proposed.full_name });
  }
  if (typeof proposed.phone === "string" && !eq(proposed.phone, current.phone)) {
    rows.push({ key: "phone", label: "SĐT", cur: current.phone, next: proposed.phone });
  }
  if (proposed.form_data && typeof proposed.form_data === "object") {
    const nextForm = proposed.form_data as Record<string, unknown>;
    for (const [k, v] of Object.entries(nextForm)) {
      const cur = current.form_data[k];
      if (!eq(cur, v)) {
        rows.push({ key: k, label: labelFor(k), cur, next: v });
      }
    }
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">(không có thay đổi)</p>;
  }

  const fmt = (v: unknown): string => {
    if (v == null || v === "") return "—";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-testid="diff-table">
        <thead>
          <tr className="border-b bg-muted/50 text-xs uppercase tracking-wide">
            <th className="px-2 py-1.5 text-left">Trường</th>
            <th className="px-2 py-1.5 text-left">Hiện tại</th>
            <th className="px-2 py-1.5 text-left">Đề xuất</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.key}
              className="border-b last:border-b-0"
              style={{ background: "#fffbeb" }}
            >
              <td className="px-2 py-1.5 font-medium">{r.label}</td>
              <td className="px-2 py-1.5 text-muted-foreground break-all">{fmt(r.cur)}</td>
              <td className="px-2 py-1.5 font-semibold break-all">{fmt(r.next)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RejectChangesDialog({
  open,
  onOpenChange,
  reason,
  onReasonChange,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  reason: string;
  onReasonChange: (s: string) => void;
  busy: boolean;
  onConfirm: () => Promise<void>;
}): React.ReactElement | null {
  if (!open) return null;
  const tooShort = reason.trim().length < 3;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => {
        if (!busy) onOpenChange(false);
      }}
    >
      <div
        className="w-full max-w-md rounded-lg border bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-lg mb-1">Từ chối thay đổi</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Lý do sẽ được gửi email tới TNV và lưu vào audit log.
        </p>
        <Textarea
          rows={3}
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder="VD: Ảnh CCCD mờ, vui lòng chụp lại..."
          maxLength={1000}
        />
        <div className="flex justify-end gap-2 mt-3">
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Huỷ
          </Button>
          <Button
            disabled={busy || tooShort}
            onClick={() => {
              void onConfirm();
            }}
          >
            {busy ? "Đang xử lý..." : "Từ chối thay đổi"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Displays the full crew-portal magic link so an admin can resend it to a
 * TNV who lost their email / cleared their inbox. Copy-to-clipboard falls
 * back to document.execCommand on non-HTTPS origins where navigator.clipboard
 * is unavailable.
 *
 * Security note: this link grants full crew access (view contract, check-in,
 * edit profile). Backend already audit-logs every detail view that emits
 * this token — so sharing the token outside the approved recipient is
 * traceable to the admin who pulled it.
 */
function MagicLinkSection({
  magicLink,
  expiresAt,
}: {
  magicLink: string;
  expiresAt: string;
}): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const expiry = new Date(expiresAt);
  const isExpired = expiry.getTime() < Date.now();
  const msLeft = expiry.getTime() - Date.now();
  const daysLeft = Math.floor(msLeft / (1000 * 60 * 60 * 24));

  async function handleCopy(): Promise<void> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(magicLink);
      } else {
        // HTTP fallback — dev env / pre-HTTPS local networks
        const ta = document.createElement("textarea");
        ta.value = magicLink;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      toast.success("Đã copy link vào clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy thất bại — chọn link và copy thủ công");
    }
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
      <div className="flex items-start gap-2">
        <KeyRound className="size-4 shrink-0 text-amber-700 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Label className="text-amber-900 font-semibold">
              Link truy cập Portal (Magic link)
            </Label>
            <span
              className={`text-xs font-medium ${
                isExpired
                  ? "text-red-700"
                  : daysLeft < 1
                    ? "text-amber-700"
                    : "text-muted-foreground"
              }`}
            >
              {isExpired
                ? "❌ Đã hết hạn"
                : daysLeft < 1
                  ? `⚠️ Hết hạn hôm nay (${expiry.toLocaleString("vi-VN")})`
                  : `Hết hạn sau ${daysLeft} ngày (${expiry.toLocaleDateString(
                      "vi-VN",
                    )})`}
            </span>
          </div>
          <div className="mt-1.5 flex items-stretch gap-2">
            <Input
              readOnly
              value={magicLink}
              className="font-mono text-xs bg-white"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={() => {
                void handleCopy();
              }}
              className="shrink-0"
            >
              <Copy className="mr-1 size-3.5" />
              {copied ? "Đã copy" : "Copy"}
            </Button>
            <a
              href={magicLink}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 inline-flex items-center justify-center rounded-md border bg-white px-3 text-xs font-medium hover:bg-gray-50 transition-colors"
            >
              <ExternalLink className="mr-1 size-3.5" />
              Mở
            </a>
          </div>
          <p className="text-[11px] text-amber-800/80 mt-1.5 leading-relaxed">
            Gửi link này cho TNV khi họ mất email xác nhận. Link mở thẳng vào
            portal tổng hợp (xem trạng thái · ký HĐ · check-in). Mọi lần xem
            link đều được ghi audit log theo admin.
          </p>
        </div>
      </div>
    </div>
  );
}

function ClearSuspiciousDialog({
  open,
  onOpenChange,
  note,
  onNoteChange,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  note: string;
  onNoteChange: (s: string) => void;
  busy: boolean;
  onConfirm: () => Promise<void>;
}): React.ReactElement | null {
  if (!open) return null;
  const tooShort = note.trim().length < 5;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => {
        if (!busy) onOpenChange(false);
      }}
    >
      <div
        className="w-full max-w-md rounded-lg border bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-lg mb-1">Xác nhận OK (clear flag)</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Ghi chú sẽ được lưu vào audit log. Bắt buộc.
        </p>
        <Textarea
          rows={3}
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="VD: Đã trao đổi với leader, check-in sớm vì..."
          maxLength={500}
        />
        <div className="flex justify-end gap-2 mt-3">
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Huỷ
          </Button>
          <Button
            disabled={busy || tooShort}
            onClick={() => {
              void onConfirm();
            }}
          >
            {busy ? "Đang xử lý..." : "Xác nhận OK"}
          </Button>
        </div>
      </div>
    </div>
  );
}
