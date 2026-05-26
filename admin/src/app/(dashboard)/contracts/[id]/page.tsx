"use client";

/**
 * F-024 Contract detail page (PRD Screen 3).
 *
 * Actions:
 *   - Activate (DRAFT → ACTIVE)
 *   - Create acceptance report (only if ACTIVE)
 *   - Create payment request (only if acceptance FINALIZED)
 *   - Export DOCX / PDF
 *   - Cancel contract
 *   - Soft delete
 *
 * F-067 — Stale DOCX auto-regen UX (Groups Y + W):
 *   - Stale badge polling after edit (BR-67-08)
 *   - Version list with "Mới nhất" highlight + manual re-gen button (BR-67-09/17/18)
 *   - "Lịch sử chỉnh sửa" tab consumes /history endpoint (BR-67-19)
 *   - VN dictionary inlined (BR-67-10/20 — Display Convention compliance)
 */
import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ContractDetailSections } from "../_components/contract-detail-sections";
import { DocumentDownloadBtn } from "../_components/document-download-btn";
import {
  acceptQuotation,
  activateContract,
  convertQuotation,
  deleteContract,
  generateDocument,
  getContract,
  getContractHistory,
  rejectQuotation,
  updateContract,
  type AuditEntry,
  type ContractView,
  type GeneratedDocumentEntry,
} from "@/lib/contracts-api";
import {
  CheckCircle2,
  ChevronLeft,
  Clock,
  FileSignature,
  Loader2,
  Pencil,
  ReceiptText,
  Repeat,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { useSetCrumb } from "@/components/admin-shell/breadcrumb-context";
import { useConfirm } from "@/components/confirm-dialog";
import { DetailSkeleton } from "../_components/detail-skeleton";
import { ContractEditDialog } from "../_components/contract-edit-dialog";
// F-028 — embed P&L summary card (admin-only defense-in-depth).
import { useAuth } from "@/lib/auth-context";
import { RestrictedAccess } from "@/components/admin-shell/restricted-access";
import { PnLSummaryCard } from "../../finance/_components/pnl-summary-card";
// F-040 — fee breakdown drill-down panel (mount in Lãi/Lỗ section)
import { FeeBreakdownPanel } from "../_components/fee-breakdown-panel";

// ────────────────────────────────────────────────────────────────────────
// F-067 BR-67-10/20 — centralized VN dictionary (Display Convention).
// Inlined to stay within the 9-file Scope Lock. Extract to
// `admin/src/lib/contract-labels.ts` when more screens need them.
// ────────────────────────────────────────────────────────────────────────
const REGEN_STATUS_LABEL = {
  REGENERATING: "Đang tạo lại tài liệu…",
  SUCCESS: "Tài liệu đã cập nhật",
  FAIL: "Tự động tạo lại thất bại — click \"Tạo lại tài liệu\" để thử lại",
} as const;

const AUDIT_ACTION_LABEL: Record<string, string> = {
  "contract.create": "Tạo hợp đồng",
  "contract.update": "Cập nhật",
  "contract.update.force": "Force-edit (non-DRAFT)",
  "contract.cancel": "Hủy hợp đồng",
  "contract.activate": "Kích hoạt",
  "contract.linkMysql": "Liên kết MySQL",
  "contract.unlinkMysql": "Hủy liên kết MySQL",
  "contract.generateDocument": "Tạo lại tài liệu",
  "contract.docRegenFail": "Tạo lại tài liệu thất bại",
  "contract.acceptanceReportUpsert": "Cập nhật Biên bản nghiệm thu",
  "contract.acceptanceReportFinalize": "Hoàn tất Biên bản nghiệm thu",
  "contract.paymentRequestUpsert": "Cập nhật Đề nghị thanh toán",
  "contract.markPaid": "Đánh dấu đã thanh toán",
  "contract.delete": "Xóa hợp đồng",
  "contract.acceptQuotation": "Đối tác chấp nhận báo giá",
  "contract.rejectQuotation": "Đối tác từ chối báo giá",
};

function formatVnDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const yy = d.getFullYear();
    return `${hh}:${mm} ${dd}/${mo}/${yy}`;
  } catch {
    return iso;
  }
}

function relativeVn(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return iso;
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "vừa xong";
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} ngày trước`;
  return formatVnDateTime(iso);
}

/** F-067 BR-67-17/18 — find the highest-version CONTRACT/DOCX entry. Returns
 *  `null` for contracts that have never been rendered (DRAFT pre-activate). */
function pickLatestContractDocx(
  entries: ReadonlyArray<GeneratedDocumentEntry>,
): GeneratedDocumentEntry | null {
  let latest: GeneratedDocumentEntry | null = null;
  for (const e of entries) {
    if (e.docType !== "CONTRACT" || e.format !== "DOCX") continue;
    if (!latest || (e.version ?? 0) > (latest.version ?? 0)) latest = e;
  }
  return latest;
}

/** F-067 BR-67-08 — sticky amber banner shown while auto-regen is pending. */
function StaleBadge({
  status,
}: {
  status: "idle" | "pending" | "success" | "fail";
}) {
  if (status !== "pending") return null;
  return (
    <div
      role="status"
      data-testid="f067-stale-badge"
      className="sticky top-0 z-10 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
    >
      <Loader2 className="size-4 animate-spin" aria-hidden />
      <span>{REGEN_STATUS_LABEL.REGENERATING}</span>
    </div>
  );
}

/** F-067 BR-67-17/18 — render `generatedDocuments[]` grouped, latest first. */
function VersionList({
  contract,
  onManualRegen,
  regenBusy,
}: {
  contract: ContractView;
  onManualRegen: () => void;
  regenBusy: boolean;
}) {
  const contractDocx = (contract.generatedDocuments ?? [])
    .filter((g) => g.docType === "CONTRACT" && g.format === "DOCX")
    .sort((a, b) => (b.version ?? 0) - (a.version ?? 0));
  const latest = contractDocx[0] ?? null;
  const isDraft = contract.status === "DRAFT";

  return (
    <section
      className="space-y-3 rounded-lg border border-stone-200 bg-white p-4"
      aria-label="Tài liệu hợp đồng đã tạo"
      data-testid="f067-version-list"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-stone-900">
            📄 Tài liệu hợp đồng
          </h3>
          {latest && (
            <p className="text-xs text-stone-500">
              Lần tạo gần nhất: {formatVnDateTime(latest.generatedAt)}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onManualRegen}
          disabled={regenBusy || isDraft}
          title={
            isDraft
              ? "HĐ DRAFT chưa thể xuất bản tài liệu chính thức"
              : "Tạo lại tài liệu với data hiện tại"
          }
          data-testid="f067-btn-regen"
        >
          <RefreshCw className={`size-4 ${regenBusy ? "animate-spin" : ""}`} />
          Tạo lại tài liệu
        </Button>
      </div>
      {contractDocx.length === 0 ? (
        <p className="text-sm text-stone-500">
          Chưa có phiên bản tài liệu nào — kích hoạt HĐ để tạo phiên bản đầu
          tiên.
        </p>
      ) : (
        <ul className="space-y-2">
          {contractDocx.map((g, idx) => {
            const isLatest = idx === 0;
            return (
              <li
                key={`${g.s3Key}-${g.version}`}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm ${
                  isLatest
                    ? "border-blue-300 bg-blue-50"
                    : "border-stone-200 bg-stone-50"
                }`}
                data-testid={`f067-version-${g.version}`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-stone-600">
                    v{g.version}
                  </span>
                  {isLatest ? (
                    <Badge className="bg-blue-600 text-white">Mới nhất</Badge>
                  ) : (
                    <Badge variant="outline">Phiên bản cũ</Badge>
                  )}
                  <span className="text-stone-700">{g.format}</span>
                  <span className="text-xs text-stone-500">
                    {formatVnDateTime(g.generatedAt)}
                  </span>
                </div>
                {/* Download is handled by the existing DocumentDownloadBtn
                    which always picks the latest version — older versions
                    are intentionally NOT directly downloadable per BR-67-18. */}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** F-067 BR-67-19 — audit timeline tab with expandable JSON diff. */
function HistoryTab({
  entries,
  loading,
  error,
  expanded,
  onToggle,
  onRetry,
}: {
  entries: AuditEntry[] | null;
  loading: boolean;
  error: string | null;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-md bg-stone-100"
          />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        <span>Không tải được lịch sử — {error}</span>
        <Button size="sm" variant="outline" onClick={onRetry}>
          Thử lại
        </Button>
      </div>
    );
  }
  if (!entries || entries.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
        <Clock className="size-4" />
        <span>Chưa có thay đổi nào được ghi nhận</span>
      </div>
    );
  }
  return (
    <ul className="space-y-2" data-testid="f067-history-list">
      {entries.map((e) => {
        const label = AUDIT_ACTION_LABEL[e.action] ?? e.action;
        const isOpen = expanded.has(e.id);
        const hasDetail = e.metadata && Object.keys(e.metadata).length > 0;
        return (
          <li
            key={e.id}
            className="rounded-md border border-stone-200 bg-white p-3 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700">
                  {e.actor.displayName ?? e.actor.userId}
                </span>
                <span className="font-medium text-stone-900">{label}</span>
                <span className="text-xs text-stone-500">
                  · {relativeVn(e.createdAt)}
                </span>
              </div>
              {hasDetail && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onToggle(e.id)}
                >
                  {isOpen ? "Ẩn chi tiết" : "Xem chi tiết"}
                </Button>
              )}
            </div>
            {hasDetail && isOpen && (
              <pre className="mt-2 overflow-x-auto rounded bg-stone-50 p-2 text-xs text-stone-700">
                {JSON.stringify(e.metadata, null, 2)}
              </pre>
            )}
            {!hasDetail && (
              <p className="mt-1 text-xs text-stone-400">
                Không có chi tiết delta
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const { id } = use(params);
  // F-029 BR-HD-30 — page-level RBAC gate.
  const { isAdmin, isStaff, isLoading: authLoading } = useAuth();

  const [contract, setContract] = useState<ContractView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  // F-024 Fix 2 — edit dialog open state
  const [editOpen, setEditOpen] = useState(false);

  // F-067 BR-67-08 — stale badge polling state machine
  // idle → pending (after mutation) → success | fail
  const [regenStatus, setRegenStatus] = useState<
    "idle" | "pending" | "success" | "fail"
  >("idle");
  // Snapshot of the latest `generatedDocuments[]` timestamp BEFORE mutation
  // — polling compares fresh fetches against this baseline.
  const lastKnownRegenAtRef = useRef<string | null>(null);
  // F-067 BR-67-19 — lazy-loaded history (loaded only on tab activate)
  const [history, setHistory] = useState<AuditEntry[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"info" | "history">("info");

  // UX-01/UX-04: dynamic breadcrumb + browser tab title từ contractNumber
  const crumbLabel = contract?.contractNumber ?? (loading ? null : "Hợp đồng nháp");
  useSetCrumb(id, crumbLabel);
  useEffect(() => {
    if (!contract) return;
    const cn = contract.contractNumber ?? "Hợp đồng nháp";
    document.title = `${cn} · Hợp đồng · 5BIB Admin`;
  }, [contract]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const c = await getContract(id);
      setContract(c);
    } catch (err) {
      toast.error(`Lỗi: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // ─────────────────────────────────────────────────────────────────
  // F-067 BR-67-08 — stale badge polling.
  // Fires when `regenStatus === 'pending'`. Polls /contracts/:id every 2s
  // (max 7 attempts → 14s ceiling) comparing the latest CONTRACT/DOCX
  // generatedAt against the pre-mutation baseline. On match: SUCCESS toast.
  // On timeout: FAIL toast suggesting manual re-gen.
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (regenStatus !== "pending") return;
    let attempts = 0;
    const MAX = 7;
    const INTERVAL = 2000;
    const baseline = lastKnownRegenAtRef.current;
    const timer = setInterval(async () => {
      attempts += 1;
      try {
        const fresh = await getContract(id);
        const latest = pickLatestContractDocx(fresh.generatedDocuments ?? []);
        const latestAt = latest?.generatedAt ?? null;
        if (latestAt && (!baseline || latestAt > baseline)) {
          clearInterval(timer);
          setContract(fresh);
          setRegenStatus("success");
          toast.success(REGEN_STATUS_LABEL.SUCCESS);
          return;
        }
      } catch {
        // Transient fetch error — keep polling, count attempt.
      }
      if (attempts >= MAX) {
        clearInterval(timer);
        setRegenStatus("fail");
        toast.warning(REGEN_STATUS_LABEL.FAIL);
      }
    }, INTERVAL);
    return () => clearInterval(timer);
  }, [regenStatus, id]);

  /** Trigger polling after a successful mutation. Captures pre-mutation
   *  latest timestamp so the polling loop can detect a strict bump. */
  const startStaleWatch = useCallback((c: ContractView) => {
    const latest = pickLatestContractDocx(c.generatedDocuments ?? []);
    lastKnownRegenAtRef.current = latest?.generatedAt ?? null;
    setRegenStatus("pending");
  }, []);

  // F-067 BR-67-19 — lazy load history on tab activate.
  const loadHistory = useCallback(async () => {
    if (history !== null || historyLoading) return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await getContractHistory(id, 50);
      setHistory(res.entries);
    } catch (err) {
      setHistoryError((err as Error).message);
    } finally {
      setHistoryLoading(false);
    }
  }, [history, historyLoading, id]);

  useEffect(() => {
    if (activeTab === "history") loadHistory();
  }, [activeTab, loadHistory]);

  const toggleHistoryDetail = useCallback((entryId: string) => {
    setExpandedHistory((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  }, []);

  // F-067 BR-67-09 — manual re-generate handler.
  const handleManualRegen = useCallback(async () => {
    if (!contract) return;
    if (contract.status === "DRAFT") {
      toast.error("HĐ DRAFT chưa thể xuất bản tài liệu chính thức");
      return;
    }
    const ok = await confirm({
      title: "Tạo lại tài liệu hợp đồng?",
      description:
        "Tạo lại tài liệu sẽ thêm phiên bản mới (v+1) với data hiện tại. Phiên bản cũ vẫn được giữ trong lịch sử. Tiếp tục?",
      confirmText: "Tạo lại",
    });
    if (!ok) return;
    setBusy(true);
    startStaleWatch(contract);
    try {
      await generateDocument(contract._id, "CONTRACT");
      // Polling effect picks up the new version + clears badge.
    } catch (err) {
      setRegenStatus("fail");
      toast.error(`Lỗi: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [confirm, contract, startStaleWatch]);

  async function activate() {
    if (!contract) return;
    setBusy(true);
    try {
      const next = await activateContract(contract._id);
      toast.success(`Đã kích hoạt: ${next.contractNumber}`);
      setContract(next);
    } catch (err) {
      toast.error(`Lỗi: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function cancelContract() {
    if (!contract) return;
    const ok = await confirm({
      title: "Huỷ hợp đồng?",
      description: `Huỷ HĐ ${contract.contractNumber ?? "này"}? Hành động này không thể hoàn tác.`,
      confirmText: "Huỷ HĐ",
      variant: "destructive",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const next = await updateContract(contract._id, { status: "CANCELLED" });
      toast.success("Đã huỷ");
      setContract(next);
    } catch (err) {
      toast.error(`Lỗi: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function softDelete() {
    if (!contract) return;
    const ok = await confirm({
      title: "Xoá hợp đồng?",
      description: `Xoá HĐ ${contract.contractNumber ?? "này"}? Có thể khôi phục từ trang admin.`,
      confirmText: "Xoá",
      variant: "destructive",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteContract(contract._id);
      toast.success("Đã xoá");
      router.push("/contracts");
    } catch (err) {
      toast.error(`Lỗi: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function convert() {
    if (!contract) return;
    setBusy(true);
    try {
      const next = await convertQuotation(contract._id);
      toast.success(`Đã chuyển sang HĐ: ${next.contractNumber}`);
      router.push(`/contracts/${next._id}`);
    } catch (err) {
      toast.error(`Lỗi: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  // F-024 BUG-001 — đối tác chấp nhận báo giá (Quotation DRAFT → ACCEPTED)
  async function handleAcceptQuotation() {
    if (!contract) return;
    const ok = await confirm({
      title: "Đối tác chấp nhận báo giá?",
      description:
        "Xác nhận đối tác đã chấp nhận báo giá. Sau khi chấp nhận có thể chuyển thành Hợp đồng.",
      confirmText: "Chấp nhận",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const next = await acceptQuotation(contract._id);
      toast.success("Đã ghi nhận đối tác chấp nhận báo giá");
      setContract(next);
    } catch (err) {
      toast.error(`Lỗi: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleRejectQuotation() {
    if (!contract) return;
    const ok = await confirm({
      title: "Đối tác từ chối báo giá?",
      description:
        "Xác nhận đối tác đã từ chối. Báo giá sẽ chuyển sang REJECTED và KHÔNG thể chuyển thành hợp đồng.",
      confirmText: "Từ chối",
      variant: "destructive",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const next = await rejectQuotation(contract._id);
      toast.success("Đã ghi nhận đối tác từ chối báo giá");
      setContract(next);
    } catch (err) {
      toast.error(`Lỗi: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  if (authLoading) return null;
  if (!isStaff) return <RestrictedAccess />;
  if (loading) return <DetailSkeleton sections={4} />;
  if (!contract) return <div className="p-6">Không tìm thấy hợp đồng</div>;

  const isDraft = contract.status === "DRAFT";
  const isActive = contract.status === "ACTIVE";
  const acceptanceFinalized =
    contract.acceptanceReport?.status === "FINALIZED";
  const isQuotationDoc = contract.documentType === "QUOTATION";
  const isQuotationDraft = isQuotationDoc && contract.status === "DRAFT";
  const isQuotation = isQuotationDoc && contract.status === "ACCEPTED";
  const docType = contract.documentType === "QUOTATION" ? "QUOTATION" : "CONTRACT";
  const supportsAcceptance = contract.contractType !== "TICKET_SALES";

  return (
    <div className="space-y-6 p-6">
      {/* F-067 BR-67-08 — sticky stale badge while auto-regen is pending */}
      <StaleBadge status={regenStatus} />

      {/* UX-11 back button */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/contracts")}
        >
          <ChevronLeft className="size-4" /> Danh sách hợp đồng
        </Button>
      </div>

      {/* UX-32 actions group */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {isDraft && (
            <>
              <Button
                variant="outline"
                onClick={() => setEditOpen(true)}
                disabled={busy}
                data-testid="btn-edit"
              >
                <Pencil className="size-4" /> Chỉnh sửa
              </Button>
              {!isQuotationDoc && (
                <Button onClick={activate} disabled={busy} data-testid="btn-activate">
                  <CheckCircle2 className="size-4" /> Kích hoạt
                </Button>
              )}
              {isQuotationDraft && (
                <>
                  <Button
                    onClick={handleAcceptQuotation}
                    disabled={busy}
                    data-testid="btn-accept-quotation"
                  >
                    <ThumbsUp className="size-4" /> Đối tác chấp nhận báo giá
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleRejectQuotation}
                    disabled={busy}
                    data-testid="btn-reject-quotation"
                  >
                    <ThumbsDown className="size-4" /> Đối tác từ chối
                  </Button>
                </>
              )}
            </>
          )}
          {!isDraft && (
            <Button
              variant="outline"
              onClick={async () => {
                const ok = await confirm({
                  title: `Sửa HĐ đang ${contract.status}?`,
                  description:
                    contract.status === "ACTIVE"
                      ? "HĐ đã ký + có số HĐ chính thức. Sửa = mismatch với DOCX physical đã sign. F-067 sẽ tự động tạo lại tài liệu — bạn re-send đối tác sau khi sửa. Tiếp tục?"
                      : contract.status === "COMPLETED"
                        ? "HĐ đã COMPLETED + có biên bản nghiệm thu + yêu cầu thanh toán. Sửa line items KHÔNG auto-recompute acceptance/payment numbers — bạn cần check + fix manual nếu cần. F-067 sẽ tự động tạo lại DOCX. Tiếp tục?"
                      : contract.status === "CANCELLED" || contract.status === "REJECTED"
                        ? `HĐ đã ${contract.status}. Sửa = thay đổi data lịch sử. Audit log sẽ track. Tiếp tục?`
                        : `HĐ đang ${contract.status}. Sửa sẽ override line items / payment terms. Audit log track ai sửa + status snapshot. Tiếp tục?`,
                  confirmText: "Vẫn sửa",
                  variant: "destructive",
                });
                if (ok) setEditOpen(true);
              }}
              disabled={busy}
              title={`Sửa HĐ (audit force_edit từ status ${contract.status})`}
              aria-label={`Chỉnh sửa HĐ ${contract.status}`}
              data-testid="btn-edit-force"
            >
              <Pencil className="size-4" /> Chỉnh sửa
            </Button>
          )}
          {isQuotation && (
            <Button onClick={convert} disabled={busy}>
              <Repeat className="size-4" /> Chuyển thành hợp đồng
            </Button>
          )}
          {isActive && supportsAcceptance && (
            <Button
              variant="outline"
              onClick={() => router.push(`/contracts/${contract._id}/acceptance`)}
              data-testid="btn-create-acceptance"
            >
              <FileSignature className="size-4" /> Tạo biên bản nghiệm thu
            </Button>
          )}
          {acceptanceFinalized && supportsAcceptance && (
            <Button
              variant="outline"
              onClick={() => router.push(`/contracts/${contract._id}/payment`)}
              data-testid="btn-create-payment"
            >
              <ReceiptText className="size-4" /> Tạo đề nghị thanh toán
            </Button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={cancelContract}
              disabled={busy || !isActive}
            >
              Huỷ HĐ
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={softDelete}
              disabled={busy}
              aria-label="Xoá"
            >
              <Trash2 className="size-4 text-red-600" />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <DocumentDownloadBtn contractId={contract._id} docType={docType} />
          {acceptanceFinalized && supportsAcceptance && (
            <DocumentDownloadBtn
              contractId={contract._id}
              docType="ACCEPTANCE_REPORT"
            />
          )}
          {contract.paymentRequest && (
            <DocumentDownloadBtn
              contractId={contract._id}
              docType="PAYMENT_REQUEST"
            />
          )}
        </div>
      </div>

      {/* F-067 BR-67-19 — Tabs for "Thông tin" + "Lịch sử chỉnh sửa". The
          existing F-024 sections render under "Thông tin"; history renders
          under the new tab. */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "info" | "history")}
      >
        <TabsList>
          <TabsTrigger value="info">Thông tin hợp đồng</TabsTrigger>
          <TabsTrigger value="history" data-testid="f067-tab-history">
            Lịch sử chỉnh sửa
          </TabsTrigger>
        </TabsList>
        <TabsContent value="info" className="space-y-6">
          <ContractDetailSections contract={contract} />

          {/* F-067 BR-67-17 — version list with latest highlight + manual re-gen */}
          <VersionList
            contract={contract}
            onManualRegen={handleManualRegen}
            regenBusy={busy || regenStatus === "pending"}
          />

          {/* F-028 — Lãi/Lỗ Deal section, admin-only defense-in-depth. */}
          {isAdmin && (
            <section
              data-testid="pnl-deal-section"
              className="space-y-3"
              aria-label="Lãi lỗ Deal"
            >
              <h2 className="text-base font-semibold text-stone-900">
                💰 Lãi/Lỗ Deal
              </h2>
              <PnLSummaryCard contractId={contract._id} compact />
              {/* F-040 — drill-down fee breakdown panel (collapsed by default) */}
              <FeeBreakdownPanel contractId={contract._id} />
            </section>
          )}
        </TabsContent>
        <TabsContent value="history">
          <HistoryTab
            entries={history}
            loading={historyLoading}
            error={historyError}
            expanded={expandedHistory}
            onToggle={toggleHistoryDetail}
            onRetry={() => {
              setHistory(null);
              loadHistory();
            }}
          />
        </TabsContent>
      </Tabs>

      {/* F-024 Fix 2 — edit dialog. F-067 wires `onSaved` to start polling. */}
      {editOpen && contract && (
        <ContractEditDialog
          contract={contract}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={(next) => {
            setContract(next);
            // F-067 — only trigger polling if not DRAFT (regen would skip
            // anyway per BR-67-03) and contract is not freshly created.
            if (next.status !== "DRAFT") startStaleWatch(next);
          }}
        />
      )}
    </div>
  );
}
