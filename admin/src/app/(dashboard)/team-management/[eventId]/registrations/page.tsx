"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  listRegistrations,
  listTeamRoles,
  bulkUpdateRegistrations,
  adminManualRegister,
  exportPersonnel,
  approveRegistration,
  rejectRegistration,
  cancelRegistration,
  confirmCompletion,
  confirmNghiemThu,
  confirmNghiemThuBatch,
  confirmAllInEvent,
  getEventFeaturesConfig,
  sendContracts,
  sendContractForRegistration,
  sendContractsBatch,
  type RegistrationListRow,
  type TeamRole,
  type ManualRegisterInput,
} from "@/lib/team-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  StatusBadge,
  deriveStatusKey,
  STATUS_FUNNEL,
  STATUS_STYLE,
  type DisplayStatusKey,
} from "@/lib/status-style";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Search,
  UserPlus,
  FileSpreadsheet,
  FileUp,
  Check,
  X,
  ExternalLink,
  AlertTriangle,
  Pencil,
  Send,
  CheckCircle2,
  DollarSign,
  FileText,
  Clock,
  Ban,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { namesMatch } from "@/lib/utils";
import { RegistrationDetailView } from "./_registration-detail";
import { RejectDialog } from "./_reject-dialog";
import { RegistrationImportDialog } from "./_import-dialog";
import { useConfirm } from "@/components/confirm-dialog";
import { usePrompt } from "@/components/prompt-dialog";

// Status badges + row styles come from @/lib/status-style.

type FilterKey = "all" | DisplayStatusKey;

/**
 * Map our 10 operational statuses to tab labels. "Tất cả" is an
 * implicit 11th tab that sends no status filter to the backend.
 */
const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "pending_approval", label: "Chờ duyệt" },
  { key: "approved", label: "Đã duyệt" },
  { key: "contract_sent", label: "Chờ ký HĐ" },
  { key: "contract_signed", label: "Đã ký" },
  { key: "qr_sent", label: "Sẵn sàng" },
  { key: "checked_in", label: "Checked-in" },
  { key: "completed", label: "Hoàn thành" },
  { key: "waitlisted", label: "Waitlist" },
  { key: "rejected", label: "Từ chối" },
  { key: "cancelled", label: "Huỷ" },
];

export default function RegistrationsListPage(): React.ReactElement {
  const router = useRouter();
  const params = useParams<{ eventId: string }>();
  const eventId = Number(params.eventId);
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();

  const [roles, setRoles] = useState<TeamRole[]>([]);
  const [rows, setRows] = useState<RegistrationListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [byStatus, setByStatus] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<FilterKey>("all");
  const [filterRoleId, setFilterRoleId] = useState<number | undefined>();
  const [page, setPage] = useState(1);
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [rowBusy, setRowBusy] = useState<Set<number>>(new Set());
  // v1.9: feature_mode determines what action shows after contract_signed.
  // Lite mode skips QR/check-in → admin xác nhận hoàn thành trực tiếp.
  const [featureMode, setFeatureMode] = useState<"full" | "lite">("full");
  // Confirm-completion dialog. 3 modes:
  //  - single: 1 row by id
  //  - bulk: N ids (from selection toolbar)
  //  - all-in-tab: ALL registrations in event matching current filterTab
  //    (used for Lite mode "xác nhận hoàn thành tất cả 900 người")
  type ConfirmTarget =
    | { kind: "single"; id: number; fullName: string }
    | { kind: "bulk"; ids: number[] }
    | { kind: "all"; status: "contract_signed" | "checked_in"; count: number };
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  const [confirmNote, setConfirmNote] = useState("");
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Reject dialog — used both for single row and for bulk reject. The
  // `mode` discriminates between "reject this one id" and "reject all
  // currently-selected ids".
  type RejectTarget =
    | { kind: "single"; id: number; fullName: string }
    | { kind: "bulk"; ids: number[] };
  const [rejectTarget, setRejectTarget] = useState<RejectTarget | null>(null);
  const [rejectBusy, setRejectBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [roleList, regs] = await Promise.all([
        listTeamRoles(token, eventId),
        listRegistrations(token, eventId, {
          status: filterTab === "all" ? undefined : filterTab,
          role_id: filterRoleId,
          search: search || undefined,
          page,
          limit: 50,
        }),
      ]);
      setRoles(roleList);
      setRows(regs.data);
      setTotal(regs.total);
      setByStatus(regs.by_status ?? {});
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token, eventId, filterTab, filterRoleId, search, page]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/sign-in");
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  // v1.9 — Fetch event feature mode once. Determines whether the action
  // after `contract_signed` is "Chờ gửi QR" (Full) or "Xác nhận hoàn thành"
  // (Lite, skips check-in entirely).
  useEffect(() => {
    if (!token) return;
    void getEventFeaturesConfig(token, eventId)
      .then((cfg) => setFeatureMode(cfg.feature_mode))
      .catch(() => {
        // Falls back to 'full' (default state). Worst case admin sees the
        // pre-v1.9 UI which is still functional.
      });
  }, [token, eventId]);

  function toggleSelect(id: number, checked: boolean): void {
    const next = new Set(selection);
    if (checked) next.add(id);
    else next.delete(id);
    setSelection(next);
  }

  function startRowBusy(id: number): () => void {
    const next = new Set(rowBusy);
    next.add(id);
    setRowBusy(next);
    return () => {
      const done = new Set(next);
      done.delete(id);
      setRowBusy(done);
    };
  }

  async function handleExport(): Promise<void> {
    if (!token || exporting) return;
    setExporting(true);
    const toastId = toast.loading("Đang tạo file…");
    try {
      const result = await exportPersonnel(token, eventId, {
        status: filterTab === "all" ? undefined : filterTab,
        role_id: filterRoleId,
        search: search || undefined,
      });
      toast.dismiss(toastId);
      toast.success(`Đã xuất ${result.row_count} dòng`);
      window.open(result.url, "_blank", "noopener");
    } catch (err) {
      toast.dismiss(toastId);
      toast.error((err as Error).message);
    } finally {
      setExporting(false);
    }
  }

  async function runAction(
    id: number,
    fn: () => Promise<unknown>,
    successMsg: string,
  ): Promise<void> {
    if (!token || rowBusy.has(id)) return;
    const done = startRowBusy(id);
    try {
      await fn();
      toast.success(successMsg);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      done();
    }
  }

  function handleApprove(row: RegistrationListRow): void {
    if (!token) return;
    void runAction(
      row.id,
      () => approveRegistration(token, row.id),
      "Đã duyệt",
    );
  }

  function handleCancel(row: RegistrationListRow): void {
    if (!token) return;
    void openPrompt({
      title: "Huỷ đăng ký",
      description: `Lý do huỷ của ${row.full_name}? (tuỳ chọn)`,
      placeholder: "Không phù hợp, trùng lịch...",
      confirmText: "Huỷ đăng ký",
    }).then((reason) => {
      // null = user pressed Hủy → abort
      if (reason === null) return;
      void runAction(
        row.id,
        () => cancelRegistration(token, row.id, reason || undefined),
        "Đã huỷ",
      );
    });
  }

  function handleSendContract(row: RegistrationListRow): void {
    if (!token) return;
    void runAction(
      row.id,
      () => sendContractForRegistration(token, row.id),
      "Đã gửi hợp đồng",
    );
  }

  function handleResendContract(row: RegistrationListRow): void {
    if (!token) return;
    // Individual resend — gửi lại magic link cho đúng người này.
    // Backend cho phép resend khi status = 'contract_sent'.
    void runAction(
      row.id,
      () => sendContractForRegistration(token, row.id),
      `Đã gửi lại hợp đồng cho ${row.full_name}`,
    );
  }

  function handleConfirmCompletion(row: RegistrationListRow): void {
    if (!token) return;
    setConfirmNote("");
    setConfirmTarget({ kind: "single", id: row.id, fullName: row.full_name });
  }

  function handleBulkConfirm(): void {
    if (!token || selection.size === 0) return;
    setConfirmNote("");
    setConfirmTarget({ kind: "bulk", ids: Array.from(selection) });
  }

  function handleConfirmAllInTab(): void {
    if (!token) return;
    const status = featureMode === "lite" ? "contract_signed" : "checked_in";
    const count = byStatus[status] ?? 0;
    if (count === 0) {
      toast.info("Không có ai sẵn sàng xác nhận hoàn thành");
      return;
    }
    setConfirmNote("");
    setConfirmTarget({ kind: "all", status, count });
  }

  async function executeConfirm(): Promise<void> {
    if (!token || !confirmTarget) return;
    const note = confirmNote.trim() || undefined;
    setConfirmBusy(true);
    try {
      if (confirmTarget.kind === "all") {
        const result = await confirmAllInEvent(
          token,
          eventId,
          confirmTarget.status,
          note,
        );
        const okCount = result.succeeded.length;
        const failCount = Object.keys(result.failed).length;
        if (failCount === 0) {
          toast.success(`Đã xác nhận hoàn thành ${okCount}/${result.total} người`);
        } else {
          const sample = Object.entries(result.failed).slice(0, 2)
            .map(([id, msg]) => `#${id}: ${msg}`)
            .join("; ");
          toast.warning(
            `Xác nhận ${okCount}/${result.total} thành công, ${failCount} lỗi. ${sample}`,
          );
        }
        setSelection(new Set());
        setConfirmTarget(null);
        setConfirmNote("");
        void load();
        return;
      }
      if (confirmTarget.kind === "single") {
        // Lite mode → nghiệm-thu endpoint (requires contract_signed)
        // Full mode → legacy confirm-completion (requires checked_in)
        const apiCall = featureMode === "lite"
          ? () => confirmNghiemThu(token, confirmTarget.id, note)
          : () => confirmCompletion(token, confirmTarget.id, note);
        await apiCall();
        toast.success(`Đã xác nhận hoàn thành ${confirmTarget.fullName}`);
      } else {
        // Bulk: in Lite mode use the batch endpoint. Full mode falls back to
        // sequential confirmCompletion (legacy — không có batch endpoint).
        if (featureMode === "lite") {
          const result = await confirmNghiemThuBatch(token, confirmTarget.ids, note);
          const okCount = result.succeeded.length;
          const failCount = Object.keys(result.failed).length;
          if (okCount > 0 && failCount === 0) {
            toast.success(`Đã xác nhận hoàn thành ${okCount} người`);
          } else if (okCount > 0 && failCount > 0) {
            const sample = Object.entries(result.failed).slice(0, 2)
              .map(([id, msg]) => `#${id}: ${msg}`)
              .join("; ");
            toast.warning(`Xác nhận ${okCount} thành công, ${failCount} lỗi. ${sample}`);
          } else {
            const sample = Object.entries(result.failed).slice(0, 2)
              .map(([id, msg]) => `#${id}: ${msg}`)
              .join("; ");
            toast.error(`Tất cả ${failCount} đều lỗi: ${sample}`);
          }
        } else {
          let ok = 0;
          let fail = 0;
          for (const id of confirmTarget.ids) {
            try {
              await confirmCompletion(token, id, note);
              ok += 1;
            } catch {
              fail += 1;
            }
          }
          if (fail === 0) {
            toast.success(`Đã xác nhận hoàn thành ${ok} người`);
          } else {
            toast.warning(`Xác nhận ${ok} thành công, ${fail} lỗi`);
          }
        }
        setSelection(new Set());
      }
      setConfirmTarget(null);
      setConfirmNote("");
      void load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setConfirmBusy(false);
    }
  }

  function handleReopenRejected(row: RegistrationListRow): void {
    // Terminal states — spec says "open trở lại → approve". Backend won't
    // let us transition rejected → approved directly, so we inform admin.
    toast.info(
      "Đăng ký đã từ chối là trạng thái cuối. Vui lòng tạo đăng ký mới (Thêm trực tiếp) cho người này.",
    );
  }

  async function handleBulkApprove(): Promise<void> {
    if (!token || selection.size === 0) return;
    const ids = Array.from(selection);
    const ok = await confirm({
      title: 'Duyệt hàng loạt',
      description: `Duyệt ${ids.length} đăng ký đã chọn?`,
      confirmText: 'Duyệt',
      variant: 'default',
    });
    if (!ok) return;
    try {
      const result = await bulkUpdateRegistrations(token, {
        ids,
        action: "approve",
      });
      const failed = result.failed_ids.length;
      const summary = `Cập nhật: ${result.updated} · bỏ qua: ${result.skipped} · lỗi: ${failed}`;
      if (failed > 0) {
        // Common cause: role.filled_slots >= max_slots → "No slots available".
        // Show as warning with hint so admin can investigate the failed ids.
        toast.warning(
          `${summary}. ${failed > 0 ? `IDs lỗi: ${result.failed_ids.slice(0, 5).join(", ")}${failed > 5 ? "..." : ""}. Thường do role đã hết slot — kiểm tra max_slots ở tab Vai trò.` : ""}`,
          { duration: 8000 },
        );
      } else if (result.updated === 0 && result.skipped > 0) {
        toast.info(`${summary} — tất cả đã được duyệt từ trước`);
      } else {
        toast.success(summary);
      }
      setSelection(new Set());
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleRejectConfirm(reason: string): Promise<void> {
    if (!token || !rejectTarget) return;
    setRejectBusy(true);
    try {
      if (rejectTarget.kind === "single") {
        await rejectRegistration(token, rejectTarget.id, reason);
        toast.success("Đã từ chối");
      } else {
        const result = await bulkUpdateRegistrations(token, {
          ids: rejectTarget.ids,
          action: "reject",
          reason,
        });
        const failed = result.failed_ids.length;
        const summary = `Cập nhật: ${result.updated} · bỏ qua: ${result.skipped} · lỗi: ${failed}`;
        if (failed > 0) {
          toast.warning(
            `${summary}. IDs lỗi: ${result.failed_ids.slice(0, 5).join(", ")}${failed > 5 ? "..." : ""}`,
            { duration: 8000 },
          );
        } else {
          toast.success(summary);
        }
        setSelection(new Set());
      }
      setRejectTarget(null);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRejectBusy(false);
    }
  }

  // For the bulk toolbar: compute whether selection is "all pending"
  // (only then can we approve all), and whether all are rejectable
  // (pending_approval OR approved — the state machine allows both).
  const selectedRows = useMemo(
    () => rows.filter((r) => selection.has(r.id)),
    [rows, selection],
  );
  const allSelectedPending = useMemo(
    () =>
      selectedRows.length > 0 &&
      selectedRows.every((r) => deriveStatusKey(r) === "pending_approval"),
    [selectedRows],
  );
  const allSelectedRejectable = useMemo(
    () =>
      selectedRows.length > 0 &&
      selectedRows.every((r) => {
        const k = deriveStatusKey(r);
        return k === "pending_approval" || k === "approved";
      }),
    [selectedRows],
  );
  // Bulk confirm-completion eligible rows: depends on feature_mode.
  // Lite: contract_signed; Full: checked_in. Same logic as RowActions.
  const allSelectedConfirmable = useMemo(() => {
    const required = featureMode === "lite" ? "contract_signed" : "checked_in";
    return (
      selectedRows.length > 0 &&
      selectedRows.every((r) => deriveStatusKey(r) === required)
    );
  }, [selectedRows, featureMode]);
  // Bulk (re)send-contract eligible: rows ở status approved (first send),
  // contract_sent (resend), or contract_signed (re-issue).
  const allSelectedResendable = useMemo(() => {
    return (
      selectedRows.length > 0 &&
      selectedRows.every((r) => {
        const k = deriveStatusKey(r);
        return k === "approved" || k === "contract_sent" || k === "contract_signed";
      })
    );
  }, [selectedRows]);
  const [bulkResendBusy, setBulkResendBusy] = useState(false);
  const confirm = useConfirm();
  const openPrompt = usePrompt();

  async function handleBulkResendContract(): Promise<void> {
    if (!token || selection.size === 0) return;
    const ids = Array.from(selection);
    const ok = await confirm({
      title: 'Gửi lại hợp đồng',
      description: `Gửi lại hợp đồng cho ${ids.length} người?`,
      confirmText: 'Gửi',
      variant: 'default',
    });
    if (!ok) return;
    setBulkResendBusy(true);
    try {
      const r = await sendContractsBatch(token, ids);
      const ok = r.succeeded.length;
      const fail = Object.keys(r.failed).length;
      if (fail === 0) toast.success(`Đã gửi lại HĐ cho ${ok} người`);
      else {
        const sample = Object.entries(r.failed).slice(0, 2)
          .map(([id, msg]) => `#${id}: ${msg}`).join("; ");
        toast.warning(`${ok} thành công, ${fail} lỗi. ${sample}`);
      }
      setSelection(new Set());
      void load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBulkResendBusy(false);
    }
  }

  if (authLoading || !isAuthenticated) return <Skeleton className="h-64" />;

  const pendingCount = byStatus.pending_approval ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-3xl font-bold tracking-tight text-gray-900">
          Danh sách nhân sự
        </h2>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void handleExport();
            }}
            disabled={exporting}
          >
            <FileSpreadsheet className="mr-2 size-4" />
            {exporting ? "Đang xuất..." : "Xuất Excel"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setImportOpen(true)}
            disabled={roles.length === 0}
          >
            <FileUp className="mr-2 size-4" /> Import Excel
          </Button>
          <Button
            size="sm"
            onClick={() => setManualOpen(true)}
            disabled={roles.length === 0}
          >
            <UserPlus className="mr-2 size-4" /> Thêm trực tiếp
          </Button>
        </div>
      </div>

      {/* Filter tabs — one row, horizontally scrollable on mobile. */}
      <div
        className="flex flex-wrap items-center gap-1.5 border-b pb-2"
        role="tablist"
        aria-label="Lọc theo trạng thái"
      >
        {FILTER_TABS.map((tab) => {
          const active = filterTab === tab.key;
          const count =
            tab.key === "all"
              ? Object.values(byStatus).reduce((a, b) => a + b, 0)
              : (byStatus[tab.key] ?? 0);
          const highlight =
            tab.key === "pending_approval" && count > 0;
          const base = tab.key === "all"
            ? undefined
            : STATUS_STYLE[tab.key as DisplayStatusKey];
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setPage(1);
                setFilterTab(tab.key);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
              style={
                active
                  ? {
                      background: base?.bg ?? "#1f2937",
                      color: base?.text ?? "#ffffff",
                      borderColor: base?.border ?? "#1f2937",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
                    }
                  : {
                      background: "#ffffff",
                      color: "#374151",
                      borderColor: "#e5e7eb",
                    }
              }
            >
              <span>{tab.label}</span>
              <span
                className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums"
                style={{
                  background: active ? "rgba(0,0,0,0.08)" : "#f3f4f6",
                  color: "inherit",
                }}
              >
                {count}
              </span>
              {highlight ? (
                <span
                  aria-hidden
                  className="inline-block size-1.5 animate-pulse rounded-full"
                  style={{ background: "#f59e0b" }}
                />
              ) : null}
            </button>
          );
        })}
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
          value={filterRoleId ?? ""}
          onChange={(e) => {
            setPage(1);
            setFilterRoleId(
              e.target.value ? Number(e.target.value) : undefined,
            );
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
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 p-2">
          <span className="text-sm font-medium">
            {selection.size} đã chọn
          </span>
          <div className="flex-1" />
          <Button
            size="sm"
            disabled={!allSelectedPending}
            title={
              allSelectedPending
                ? `Duyệt tất cả ${selection.size}`
                : "Chỉ hoạt động khi tất cả đã chọn đều ở trạng thái Chờ duyệt"
            }
            onClick={() => void handleBulkApprove()}
          >
            <Check className="mr-1 size-4" />
            Duyệt tất cả ({selection.size})
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!allSelectedResendable || bulkResendBusy}
            title={
              allSelectedResendable
                ? `Gửi lại hợp đồng cho ${selection.size} người`
                : "Chỉ gửi được khi tất cả đã chọn ở Đã duyệt / Đã gửi HĐ / Đã ký HĐ"
            }
            onClick={() => void handleBulkResendContract()}
          >
            <Send className="mr-1 size-4" />
            {bulkResendBusy ? "Đang gửi..." : `Gửi lại HĐ (${selection.size})`}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!allSelectedConfirmable}
            title={
              allSelectedConfirmable
                ? `Xác nhận hoàn thành ${selection.size} người`
                : `Tất cả phải ở status "${featureMode === "lite" ? "Đã ký HĐ" : "Đã check-in"}"`
            }
            onClick={handleBulkConfirm}
          >
            <CheckCircle2 className="mr-1 size-4" />
            Xác nhận hoàn thành ({selection.size})
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!allSelectedRejectable}
            title={
              allSelectedRejectable
                ? "Từ chối tất cả — sẽ nhắc nhập lý do"
                : "Chỉ từ chối được khi tất cả đã chọn đang ở Chờ duyệt / Đã duyệt"
            }
            onClick={() =>
              setRejectTarget({ kind: "bulk", ids: Array.from(selection) })
            }
          >
            <X className="mr-1 size-4" />
            Từ chối tất cả
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelection(new Set())}
          >
            Clear
          </Button>
        </div>
      ) : pendingCount > 0 ? (
        <div
          className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm"
          style={{
            background: "#fffbeb",
            borderColor: "#fde68a",
            color: "#92400e",
          }}
        >
          <span className="inline-block size-2 animate-pulse rounded-full bg-amber-500" />
          <span>
            <strong>{pendingCount}</strong> đăng ký đang chờ duyệt — bấm tab &quot;Chờ
            duyệt&quot; để xem
          </span>
        </div>
      ) : null}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 bg-slate-100 border-r">
                <input
                  type="checkbox"
                  className="size-5 cursor-pointer accent-blue-600"
                  checked={selection.size > 0 && selection.size === rows.length}
                  onChange={(e) => {
                    if (e.target.checked) setSelection(new Set(rows.map((r) => r.id)));
                    else setSelection(new Set());
                  }}
                  aria-label="Chọn tất cả"
                />
              </TableHead>
              <TableHead>Tên</TableHead>
              <TableHead>Vai trò</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Hợp đồng</TableHead>
              <TableHead>Hồ sơ</TableHead>
              <TableHead>Check-in</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9}>
                  <Skeleton className="h-8" />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-center text-muted-foreground py-8"
                >
                  Không có dữ liệu
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const statusKey = deriveStatusKey(r);
                const isPending = statusKey === "pending_approval";
                const isSuspicious = r.suspicious_checkin === true;
                // suspicious takes precedence over pending for the row highlight.
                const rowStyle: React.CSSProperties | undefined = isSuspicious
                  ? { background: "#fee2e2", borderLeft: "3px solid #dc2626" }
                  : isPending
                    ? { background: "#fffbeb", borderLeft: "3px solid #f59e0b" }
                    : undefined;
                return (
                  <TableRow
                    key={r.id}
                    className="result-row-hover"
                    style={rowStyle}
                    data-status={r.status}
                  >
                    <TableCell className="bg-slate-100/60 border-r">
                      <input
                        type="checkbox"
                        className="size-5 cursor-pointer accent-blue-600"
                        checked={selection.has(r.id)}
                        onChange={(e) => toggleSelect(r.id, e.target.checked)}
                        aria-label={`Chọn ${r.full_name}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1.5">
                        {isSuspicious ? (
                          <AlertTriangle
                            className="size-4 text-red-600"
                            aria-label="Suspicious check-in"
                          />
                        ) : null}
                        {r.has_pending_changes ? (
                          <Pencil
                            className="size-4 text-amber-600"
                            aria-label="Có yêu cầu sửa thông tin chờ duyệt"
                          />
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setDetailId(r.id)}
                          className="text-left hover:underline focus:underline focus:outline-none"
                        >
                          {r.full_name}
                        </button>
                      </div>
                      <div className="text-xs text-gray-500">{r.email}</div>
                    </TableCell>
                    <TableCell>{r.role_name ?? "—"}</TableCell>
                    <TableCell>{r.shirt_size ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={statusKey} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.contract_status === "signed"
                        ? "✅ Đã ký"
                        : r.contract_status === "sent"
                          ? "⏳ Chờ ký"
                          : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {(() => {
                        // v037+ — Hồ sơ pill: green if all 3 photos + identity present;
                        // amber if missing CCCD; gray if missing avatar only.
                        const hasFront = !!r.cccd_photo_url;
                        const hasBack = !!r.cccd_back_photo_url;
                        const hasAvatar = !!r.avatar_photo_url;
                        if (hasFront && hasBack && hasAvatar) {
                          return (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">
                              Đầy đủ
                            </span>
                          );
                        }
                        if (!hasFront || !hasBack) {
                          return (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                              Thiếu CCCD
                            </span>
                          );
                        }
                        return (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">
                            Thiếu avatar
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.checked_in_at
                        ? new Date(r.checked_in_at).toLocaleString("vi-VN")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <RowActions
                          row={r}
                          busy={rowBusy.has(r.id)}
                          onApprove={() => handleApprove(r)}
                          onReject={() =>
                            setRejectTarget({
                              kind: "single",
                              id: r.id,
                              fullName: r.full_name,
                            })
                          }
                          onCancel={() => handleCancel(r)}
                          onSendContract={() => handleSendContract(r)}
                          onResendContract={() => handleResendContract(r)}
                          onConfirmCompletion={() =>
                            handleConfirmCompletion(r)
                          }
                          onReopen={() => handleReopenRejected(r)}
                          onOpenDetail={() => setDetailId(r.id)}
                          featureMode={featureMode}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {(() => {
        const singlePage = total <= 50 && page === 1;
        return (
          <div className="flex items-center justify-between text-sm">
            <div className="text-muted-foreground">
              {rows.length} / {total}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={singlePage || page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Trang trước
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={singlePage || rows.length < 50}
                onClick={() => setPage((p) => p + 1)}
              >
                Trang sau
              </Button>
            </div>
          </div>
        );
      })()}

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

      <RegistrationImportDialog
        eventId={eventId}
        open={importOpen}
        onOpenChange={setImportOpen}
        onDone={() => {
          setImportOpen(false);
          void load();
        }}
      />

      <RejectDialog
        open={rejectTarget != null}
        onOpenChange={(v) => {
          if (!v) setRejectTarget(null);
        }}
        target={
          rejectTarget?.kind === "single"
            ? { count: 1, label: rejectTarget.fullName }
            : { count: rejectTarget?.ids.length ?? 0, label: "đăng ký đã chọn" }
        }
        busy={rejectBusy}
        onConfirm={handleRejectConfirm}
      />

      {/* v1.9 — Confirm-completion dialog (single + bulk). Replaces native
          window.prompt with shadcn Dialog + Textarea so admin can write
          longer notes and the UI stays on-brand. */}
      <Dialog
        open={confirmTarget != null}
        onOpenChange={(v) => {
          if (!v && !confirmBusy) {
            setConfirmTarget(null);
            setConfirmNote("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmTarget?.kind === "single"
                ? `Xác nhận hoàn thành — ${confirmTarget.fullName}`
                : confirmTarget?.kind === "all"
                  ? `Xác nhận hoàn thành TẤT CẢ — ${confirmTarget.count} người`
                  : `Xác nhận hoàn thành — ${confirmTarget?.ids.length ?? 0} người`}
            </DialogTitle>
            <DialogDescription>
              Chuyển trạng thái sang &quot;Hoàn thành&quot;. Sau bước này admin có thể đánh dấu đã thanh toán.
              Ghi chú là tuỳ chọn — sẽ lưu vào notes.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              rows={4}
              placeholder="Ghi chú (tuỳ chọn) — VD: hoàn thành đầy đủ ca trực, không có sự cố"
              value={confirmNote}
              onChange={(e) => setConfirmNote(e.target.value)}
              maxLength={1000}
              disabled={confirmBusy}
            />
            <div className="mt-1 text-right text-xs text-muted-foreground">
              {confirmNote.length}/1000
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (confirmBusy) return;
                setConfirmTarget(null);
                setConfirmNote("");
              }}
              disabled={confirmBusy}
            >
              Huỷ
            </Button>
            <Button
              onClick={() => void executeConfirm()}
              disabled={confirmBusy}
            >
              {confirmBusy ? "Đang xử lý..." : "Xác nhận hoàn thành"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet
        open={detailId != null}
        onOpenChange={(v) => {
          if (!v) setDetailId(null);
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>Chi tiết đăng ký</SheetTitle>
          </SheetHeader>
          <div className="p-4 pt-0">
            {detailId != null ? (
              <RegistrationDetailView
                regId={detailId}
                onChange={() => {
                  void load();
                }}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/**
 * Context-sensitive action buttons per status. Keeps the row action cell
 * compact — icon-only buttons with aria-labels. Disabled "info chip"
 * buttons surface downstream waiting states without looking clickable.
 */
function RowActions({
  row,
  busy,
  onApprove,
  onReject,
  onCancel,
  onSendContract,
  onResendContract,
  onConfirmCompletion,
  onReopen,
  onOpenDetail,
  featureMode,
}: {
  row: RegistrationListRow;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onCancel: () => void;
  onSendContract: () => void;
  onResendContract: () => void;
  onConfirmCompletion: () => void;
  onReopen: () => void;
  onOpenDetail: () => void;
  featureMode: "full" | "lite";
}): React.ReactElement {
  const status = deriveStatusKey(row);
  const common = (
    <Button
      size="sm"
      variant="ghost"
      className="h-8 px-2"
      onClick={onOpenDetail}
      aria-label="Chi tiết"
    >
      <ExternalLink className="size-4" />
    </Button>
  );

  function InfoChip({
    icon,
    label,
  }: {
    icon: React.ReactNode;
    label: string;
  }): React.ReactElement {
    return (
      <span
        className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] text-muted-foreground"
        style={{ background: "#f9fafb", borderColor: "#e5e7eb" }}
      >
        {icon}
        {label}
      </span>
    );
  }

  switch (status) {
    case "pending_approval":
      return (
        <>
          <Button
            size="sm"
            className="h-8 px-2"
            disabled={busy}
            onClick={onApprove}
            aria-label="Duyệt"
          >
            <Check className="size-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2"
            disabled={busy}
            onClick={onReject}
            aria-label="Từ chối"
          >
            <X className="size-4" />
          </Button>
          {common}
        </>
      );
    case "approved":
      return (
        <>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 px-2 text-xs"
            disabled={busy}
            onClick={onSendContract}
            title="Gửi hợp đồng"
            aria-label="Gửi hợp đồng"
          >
            <Send className="size-3.5" />
            Gửi HĐ
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2"
            disabled={busy}
            onClick={onCancel}
            aria-label="Huỷ"
          >
            <Ban className="size-4" />
          </Button>
          {common}
        </>
      );
    case "contract_sent":
      return (
        <>
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2"
            disabled={busy}
            onClick={onResendContract}
            aria-label="Gửi lại hợp đồng"
            title="Gửi lại hợp đồng"
          >
            <Send className="size-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2"
            disabled={busy}
            onClick={onCancel}
            aria-label="Huỷ"
          >
            <Ban className="size-4" />
          </Button>
          {common}
        </>
      );
    case "contract_signed":
      // v1.9 — Lite mode skips QR + check-in entirely. After ký HĐ, the
      // admin clicks "Xác nhận hoàn thành" to transition contract_signed
      // → completed via the nghiệm-thu endpoint. Full mode still waits
      // for the QR send step (sendQrAndTransition) to flip status.
      if (featureMode === "lite") {
        return (
          <>
            <Button
              size="sm"
              className="h-8 px-2"
              disabled={busy}
              onClick={onConfirmCompletion}
              aria-label="Xác nhận hoàn thành"
              title="Xác nhận hoàn thành (Lite mode — bỏ qua QR/check-in)"
            >
              <CheckCircle2 className="size-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2"
              onClick={onOpenDetail}
              aria-label="Xem hợp đồng"
              title="Xem hợp đồng"
            >
              <FileText className="size-4" />
            </Button>
            {common}
          </>
        );
      }
      return (
        <>
          <InfoChip
            icon={<Clock className="size-3" />}
            label="Chờ gửi QR"
          />
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2"
            onClick={onOpenDetail}
            aria-label="Xem hợp đồng"
            title="Xem hợp đồng"
          >
            <FileText className="size-4" />
          </Button>
          {common}
        </>
      );
    case "qr_sent":
      return (
        <>
          <InfoChip
            icon={<Send className="size-3" />}
            label="Đã có QR"
          />
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2"
            onClick={onOpenDetail}
            aria-label="Xem hợp đồng"
            title="Xem hợp đồng"
          >
            <FileText className="size-4" />
          </Button>
          {common}
        </>
      );
    case "checked_in":
      return (
        <>
          <Button
            size="sm"
            className="h-8 px-2"
            disabled={busy}
            onClick={onConfirmCompletion}
            aria-label="Xác nhận hoàn thành"
            title="Xác nhận hoàn thành"
          >
            <CheckCircle2 className="size-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2"
            onClick={onOpenDetail}
            aria-label="Xem hợp đồng"
            title="Xem hợp đồng"
          >
            <FileText className="size-4" />
          </Button>
          {common}
        </>
      );
    case "completed":
      return (
        <>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2"
            onClick={onOpenDetail}
            aria-label="Đánh dấu đã trả"
            title="Đánh dấu đã trả (mở chi tiết)"
          >
            <DollarSign className="size-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2"
            onClick={onOpenDetail}
            aria-label="Xem hợp đồng"
            title="Xem hợp đồng"
          >
            <FileText className="size-4" />
          </Button>
          {common}
        </>
      );
    case "rejected":
      return (
        <>
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2"
            onClick={onReopen}
            aria-label="Mở lại"
            title="Mở lại (tạo đăng ký mới)"
          >
            <Undo2 className="size-4" />
          </Button>
          {common}
        </>
      );
    case "waitlisted":
    case "cancelled":
      return <>{common}</>;
    default:
      return <>{common}</>;
  }
}

// Legacy filter funnel — kept exported for test/debugging parity.
export { STATUS_FUNNEL };

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
    const acct = (form.form_data?.bank_account_number ?? "") as string;
    if (acct && !/^\d{6,20}$/.test(acct)) {
      toast.error("Số tài khoản phải có 6–20 chữ số.");
      return;
    }
    const holder = (form.form_data?.bank_holder_name ?? "") as string;
    if (holder && !namesMatch(holder, form.full_name)) {
      toast.error(
        "Tên chủ tài khoản phải khớp với họ tên đăng ký (không phân biệt dấu / hoa thường).",
      );
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
              {roles.map((r) => {
                const full = r.filled_slots >= r.max_slots;
                const waitlistNote = full
                  ? r.waitlist_enabled
                    ? " (đầy — vào waitlist)"
                    : " (đầy)"
                  : "";
                return (
                  <option key={r.id} value={r.id}>
                    {r.role_name} ({r.filled_slots}/{r.max_slots})
                    {waitlistNote}
                  </option>
                );
              })}
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
              fullName={form.full_name}
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
  fullName,
  onChange,
}: {
  fields: TeamRole["form_fields"];
  values: Record<string, unknown>;
  fullName: string;
  onChange: (next: Record<string, unknown>) => void;
}): React.ReactElement {
  function set(key: string, val: unknown) {
    const cleaned =
      key === "bank_account_number" && typeof val === "string"
        ? val.replace(/[^\d]/g, "")
        : val;
    onChange({ ...values, [key]: cleaned });
  }
  const holder = (values["bank_holder_name"] ?? "") as string;
  const holderMismatch =
    holder.trim().length > 0 &&
    fullName.trim().length > 0 &&
    !namesMatch(holder, fullName);
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
        if (f.type === "shirt_size" || f.type === "select") {
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
                <option value="">
                  {f.type === "select" ? "-- Chọn --" : "—"}
                </option>
                {(f.options ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              {f.hint ? (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {f.hint}
                </p>
              ) : null}
            </div>
          );
        }
        if (f.type === "textarea") {
          return (
            <div key={f.key}>
              <Label className="text-xs">
                {f.label}
                {f.required ? " *" : ""}
              </Label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={3}
                value={v}
                onChange={(e) => set(f.key, e.target.value)}
              />
            </div>
          );
        }
        const isAccountNumber = f.key === "bank_account_number";
        const isHolderName = f.key === "bank_holder_name";
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
              onBlur={
                isHolderName
                  ? () => {
                      if (v && v !== v.toUpperCase()) set(f.key, v.toUpperCase());
                    }
                  : undefined
              }
              inputMode={isAccountNumber ? "numeric" : undefined}
              pattern={isAccountNumber ? "\\d{6,20}" : undefined}
              autoCapitalize={isHolderName ? "characters" : undefined}
            />
            {f.hint ? (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {f.hint}
              </p>
            ) : null}
            {isHolderName && holderMismatch ? (
              <p className="text-[11px] text-red-600 mt-0.5">
                Tên chủ tài khoản phải khớp với họ tên đăng ký
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
