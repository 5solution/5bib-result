"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  listRegistrations,
  sendAcceptanceBatch,
  sendAcceptanceOne,
  disputeAcceptance,
  type RegistrationListRow,
  type AcceptanceStatus,
} from "@/lib/team-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import { Label } from "@/components/ui/label";
import { DisputeDialog } from "../registrations/_dispute-dialog";
import { AlertTriangle, CheckCircle2, Clock, Send } from "lucide-react";

/**
 * v2.0 — Acceptance (Biên bản nghiệm thu) management page.
 *
 * Three sub-tabs:
 *   - "Sẵn sàng gửi": status=completed + acceptance_status ∈ {not_ready, pending_sign}
 *   - "Đã ký":        acceptance_status = signed
 *   - "Tranh chấp":   acceptance_status = disputed
 *
 * Actions:
 *   - Row-level Send/Re-send opens a small dialog to override acceptance_value
 *   - Bulk send (top-of-page button) fires sendAcceptanceBatch with selected ids
 *   - Row-level Dispute opens the reason dialog (reuses registrations' modal)
 *
 * Fetches all registrations for the event via listRegistrations(limit=500) and
 * filters client-side — simpler than adding a backend filter and the list is
 * small (< 200 rows per event in practice).
 */
export default function AcceptancePage(): React.ReactElement {
  const { eventId: rawId } = useParams<{ eventId: string }>();
  const eventId = Number(rawId);
  const { token } = useAuth();

  const [rows, setRows] = useState<RegistrationListRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [tab, setTab] = useState<"ready" | "signed" | "disputed">("ready");
  const [sendOpen, setSendOpen] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [sendValue, setSendValue] = useState<string>("");
  const [sendTarget, setSendTarget] = useState<RegistrationListRow | null>(
    null,
  );
  const [disputeTarget, setDisputeTarget] = useState<RegistrationListRow | null>(
    null,
  );
  const [disputeBusy, setDisputeBusy] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkValue, setBulkValue] = useState<string>("");
  const [bulkResult, setBulkResult] = useState<{
    queued: number;
    skipped: number[];
    skip_reasons: string[];
  } | null>(null);

  const fetchRows = useCallback(async () => {
    if (!token || !Number.isFinite(eventId)) return;
    setErr(null);
    try {
      const res = await listRegistrations(token, eventId, {
        page: 1,
        limit: 500,
      });
      setRows(res.data);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [token, eventId]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  // Partition rows into the three buckets. "Sẵn sàng gửi" is the union of
  // completed regs that haven't been signed yet AND haven't been disputed.
  // We intentionally include completed+not_ready (never sent) AND
  // completed+pending_sign (sent, awaiting crew) so admin can re-send.
  const { readyRows, signedRows, disputedRows } = useMemo(() => {
    const ready: RegistrationListRow[] = [];
    const signed: RegistrationListRow[] = [];
    const disputed: RegistrationListRow[] = [];
    for (const r of rows ?? []) {
      const acc: AcceptanceStatus | undefined = r.acceptance_status;
      if (acc === "signed") signed.push(r);
      else if (acc === "disputed") disputed.push(r);
      else if (r.status === "completed") ready.push(r);
    }
    return { readyRows: ready, signedRows: signed, disputedRows: disputed };
  }, [rows]);

  const readyIds = useMemo(() => readyRows.map((r) => r.id), [readyRows]);

  function toggleAll(ids: number[]): void {
    const allSelected = ids.every((id) => selected.has(id));
    const next = new Set(selected);
    if (allSelected) ids.forEach((id) => next.delete(id));
    else ids.forEach((id) => next.add(id));
    setSelected(next);
  }

  function toggleOne(id: number): void {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function handleSendOne(): Promise<void> {
    if (!token || !sendTarget) return;
    setSendBusy(true);
    try {
      const v = sendValue.trim();
      await sendAcceptanceOne(token, sendTarget.id, {
        acceptance_value: v ? Number(v) : undefined,
      });
      setSendOpen(false);
      setSendTarget(null);
      setSendValue("");
      await fetchRows();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSendBusy(false);
    }
  }

  async function handleBulkSend(): Promise<void> {
    if (!token) return;
    setBulkBusy(true);
    setBulkResult(null);
    try {
      const v = bulkValue.trim();
      const res = await sendAcceptanceBatch(token, eventId, {
        registration_ids: Array.from(selected),
        acceptance_value: v ? Number(v) : undefined,
      });
      setBulkResult(res);
      setSelected(new Set());
      await fetchRows();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleDispute(reason: string): Promise<void> {
    if (!token || !disputeTarget) return;
    setDisputeBusy(true);
    try {
      await disputeAcceptance(token, disputeTarget.id, reason);
      setDisputeTarget(null);
      await fetchRows();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setDisputeBusy(false);
    }
  }

  if (err) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
        {err}
      </div>
    );
  }

  if (!rows) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const selectedReadyIds = readyIds.filter((id) => selected.has(id));

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Nghiệm thu &amp; Thanh toán</h1>
          <p className="text-sm text-muted-foreground">
            Gửi biên bản nghiệm thu cho TNV đã completed. Payment chỉ mở
            khoá sau khi biên bản được ký (hoặc admin cưỡng bức thanh
            toán).
          </p>
        </div>
        <Button
          onClick={() => {
            setBulkOpen(true);
            setBulkValue("");
            setBulkResult(null);
          }}
          disabled={selectedReadyIds.length === 0}
        >
          <Send className="mr-2 size-4" />
          Gửi nghiệm thu ({selectedReadyIds.length})
        </Button>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="ready">
            Sẵn sàng gửi ({readyRows.length})
          </TabsTrigger>
          <TabsTrigger value="signed">
            Đã ký ({signedRows.length})
          </TabsTrigger>
          <TabsTrigger value="disputed">
            Tranh chấp ({disputedRows.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ready" className="mt-3">
          <RowTable
            rows={readyRows}
            tab="ready"
            eventId={eventId}
            selected={selected}
            onToggleAll={() => toggleAll(readyIds)}
            onToggleOne={toggleOne}
            onSend={(r) => {
              setSendTarget(r);
              setSendValue(
                r.acceptance_value != null ? String(r.acceptance_value) : "",
              );
              setSendOpen(true);
            }}
            onDispute={(r) => setDisputeTarget(r)}
          />
        </TabsContent>

        <TabsContent value="signed" className="mt-3">
          <RowTable
            rows={signedRows}
            tab="signed"
            eventId={eventId}
            selected={selected}
            onToggleAll={() => {}}
            onToggleOne={() => {}}
            onSend={() => {}}
            onDispute={(r) => setDisputeTarget(r)}
          />
        </TabsContent>

        <TabsContent value="disputed" className="mt-3">
          <RowTable
            rows={disputedRows}
            tab="disputed"
            eventId={eventId}
            selected={selected}
            onToggleAll={() => {}}
            onToggleOne={() => {}}
            onSend={(r) => {
              setSendTarget(r);
              setSendValue(
                r.acceptance_value != null ? String(r.acceptance_value) : "",
              );
              setSendOpen(true);
            }}
            onDispute={() => {}}
          />
        </TabsContent>
      </Tabs>

      {/* Per-row send dialog */}
      <Dialog
        open={sendOpen}
        onOpenChange={(v) => (!sendBusy ? setSendOpen(v) : null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Gửi nghiệm thu — {sendTarget?.full_name}
            </DialogTitle>
            <DialogDescription>
              Để trống để dùng giá trị mặc định (daily_rate × số ngày công).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="acc_value">Giá trị nghiệm thu (VND)</Label>
            <Input
              id="acc_value"
              type="number"
              min={0}
              value={sendValue}
              onChange={(e) => setSendValue(e.target.value)}
              placeholder="VD: 2000000"
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              disabled={sendBusy}
              onClick={() => setSendOpen(false)}
            >
              Huỷ
            </Button>
            <Button disabled={sendBusy} onClick={handleSendOne}>
              {sendBusy ? "Đang gửi..." : "Gửi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk send dialog */}
      <Dialog
        open={bulkOpen}
        onOpenChange={(v) => (!bulkBusy ? setBulkOpen(v) : null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Gửi nghiệm thu hàng loạt ({selectedReadyIds.length} TNV)
            </DialogTitle>
            <DialogDescription>
              Giá trị dùng chung cho cả batch. Để trống nếu muốn tính theo
              daily_rate của từng role.
            </DialogDescription>
          </DialogHeader>
          {bulkResult == null ? (
            <div className="space-y-2">
              <Label htmlFor="bulk_value">Giá trị nghiệm thu (VND)</Label>
              <Input
                id="bulk_value"
                type="number"
                min={0}
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
                placeholder="VD: 2000000 — bỏ trống = tự tính"
              />
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <p>
                ✅ Đã gửi{" "}
                <span className="font-semibold">{bulkResult.queued}</span>{" "}
                biên bản.
              </p>
              {bulkResult.skipped.length > 0 ? (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                  <p className="font-semibold">
                    Bỏ qua {bulkResult.skipped.length}:
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {bulkResult.skip_reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
          <DialogFooter>
            {bulkResult == null ? (
              <>
                <Button
                  variant="ghost"
                  disabled={bulkBusy}
                  onClick={() => setBulkOpen(false)}
                >
                  Huỷ
                </Button>
                <Button disabled={bulkBusy} onClick={handleBulkSend}>
                  {bulkBusy ? "Đang gửi..." : "Gửi"}
                </Button>
              </>
            ) : (
              <Button onClick={() => setBulkOpen(false)}>Đóng</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispute dialog — shared with registrations detail */}
      <DisputeDialog
        open={disputeTarget != null}
        onOpenChange={(v) => (!v ? setDisputeTarget(null) : null)}
        name={disputeTarget?.full_name ?? ""}
        busy={disputeBusy}
        onConfirm={handleDispute}
      />
    </div>
  );
}

function AcceptanceBadge({
  status,
}: {
  status: AcceptanceStatus | undefined;
}): React.ReactElement {
  switch (status) {
    case "signed":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
          <CheckCircle2 className="size-3" />
          Đã ký
        </span>
      );
    case "pending_sign":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
          <Clock className="size-3" />
          Chờ ký
        </span>
      );
    case "disputed":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
          <AlertTriangle className="size-3" />
          Tranh chấp
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          Chưa gửi
        </span>
      );
  }
}

function RowTable({
  rows,
  tab,
  eventId,
  selected,
  onToggleAll,
  onToggleOne,
  onSend,
  onDispute,
}: {
  rows: RegistrationListRow[];
  tab: "ready" | "signed" | "disputed";
  eventId: number;
  selected: Set<number>;
  onToggleAll: () => void;
  onToggleOne: (id: number) => void;
  onSend: (r: RegistrationListRow) => void;
  onDispute: (r: RegistrationListRow) => void;
}): React.ReactElement {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Chưa có nhân sự nào.
      </div>
    );
  }

  const allSelected =
    tab === "ready" && rows.every((r) => selected.has(r.id));
  const someSelected =
    tab === "ready" && rows.some((r) => selected.has(r.id)) && !allSelected;
  void someSelected; // intermediate state purely informational; header box toggles all

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {tab === "ready" ? (
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={onToggleAll}
                  aria-label="Chọn tất cả"
                />
              </TableHead>
            ) : null}
            <TableHead>Họ tên</TableHead>
            <TableHead>Vai trò</TableHead>
            <TableHead>Số HĐ</TableHead>
            <TableHead>Giá trị</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead>Thời điểm</TableHead>
            <TableHead className="text-right">Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              {tab === "ready" ? (
                <TableCell>
                  <Checkbox
                    checked={selected.has(r.id)}
                    onCheckedChange={() => onToggleOne(r.id)}
                    aria-label={`Chọn ${r.full_name}`}
                  />
                </TableCell>
              ) : null}
              <TableCell>
                <Link
                  href={`/team-management/${eventId}/registrations/${r.id}`}
                  className="font-medium hover:underline"
                >
                  {r.full_name}
                </Link>
                <div className="text-xs text-muted-foreground">{r.email}</div>
              </TableCell>
              <TableCell>{r.role_name ?? "—"}</TableCell>
              <TableCell className="font-mono text-xs">
                {r.contract_number ?? "—"}
              </TableCell>
              <TableCell>
                {r.acceptance_value != null
                  ? `${r.acceptance_value.toLocaleString("vi-VN")} ₫`
                  : "—"}
              </TableCell>
              <TableCell>
                <AcceptanceBadge status={r.acceptance_status} />
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {tab === "signed"
                  ? formatTs(r.acceptance_signed_at)
                  : formatTs(r.acceptance_sent_at)}
              </TableCell>
              <TableCell className="text-right">
                <div className="inline-flex items-center gap-1">
                  {tab === "ready" ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSend(r)}
                      >
                        {r.acceptance_status === "pending_sign"
                          ? "Gửi lại"
                          : "Gửi"}
                      </Button>
                      {r.acceptance_status === "pending_sign" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onDispute(r)}
                        >
                          Tranh chấp
                        </Button>
                      ) : null}
                    </>
                  ) : null}
                  {tab === "signed" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDispute(r)}
                    >
                      Mở tranh chấp
                    </Button>
                  ) : null}
                  {tab === "disputed" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSend(r)}
                    >
                      Gửi lại
                    </Button>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function formatTs(s: string | null | undefined): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString("vi-VN");
  } catch {
    return s;
  }
}
