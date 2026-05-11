"use client";

/**
 * F-024 Acceptance Report Form — BR-CM-09 actualValues + auto diff.
 *
 * Phase 2B simplification: dùng lại LineItemsEditor cho phần "Hạng mục thực tế"
 * + DiffTable hiển thị so sánh. Caller submits via `upsertAcceptanceReport`.
 *
 * Logic:
 *   - actualValues init = clone lineItems từ HĐ (admin chỉnh, thêm, bớt tự do)
 *   - Real-time recompute actualSubtotal/VAT/total + diff
 *   - Verdict + notes + advancePaid editable
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { LineItemsEditor } from "./line-items-editor";
import { DiffTable } from "./diff-table";
import { FinancialSummary } from "./financial-summary";
import { MoneyInput } from "./money-input";
import {
  calcLineAmount,
  calcTotals,
  upsertAcceptanceReport,
  finalizeAcceptanceReport,
  type AcceptanceReportInput,
  type ContractView,
  type LineItemInput,
} from "@/lib/contracts-api";
import { useConfirm } from "@/components/confirm-dialog";

type Props = {
  contract: ContractView;
  /** Called with the updated contract after save / finalize. */
  onUpdated: (next: ContractView) => void;
};

export function AcceptanceReportForm({ contract, onUpdated }: Props) {
  const confirm = useConfirm();
  const existing = contract.acceptanceReport;
  const isFinalized = existing?.status === "FINALIZED";

  const [items, setItems] = useState<LineItemInput[]>(
    existing?.actualValues?.length
      ? existing.actualValues.map((a) => ({
          stt: a.stt,
          description: a.description,
          unit: a.unit,
          quantity: a.quantity,
          unitPrice: a.unitPrice,
          discount: 0,
          selected: true,
        }))
      : contract.lineItems.map((l) => ({
          stt: l.stt,
          description: l.description,
          unit: l.unit,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discount: l.discount ?? 0,
          selected: true,
        })),
  );
  const [advancePaid, setAdvancePaid] = useState<number>(
    existing?.advancePaid ?? contract.paymentTerms.advanceAmount ?? 0,
  );
  const [verdict, setVerdict] = useState<
    "ACCEPTED" | "ACCEPTED_WITH_NOTES" | "REJECTED"
  >(existing?.verdict ?? "ACCEPTED");
  const [notes, setNotes] = useState<string>(existing?.notes ?? "");
  const [reportDate, setReportDate] = useState<string>(
    existing?.reportDate?.slice(0, 10) ??
      new Date().toISOString().slice(0, 10),
  );
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const totals = useMemo(
    () => calcTotals(items, contract.vatRate),
    [items, contract.vatRate],
  );
  const remainingBalance = totals.totalAmount - (advancePaid || 0);

  async function save() {
    setSaving(true);
    try {
      const input: AcceptanceReportInput = {
        reportDate,
        actualValues: items.map((it) => ({
          stt: it.stt,
          description: it.description,
          unit: it.unit,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          amount: calcLineAmount(it.quantity, it.unitPrice, it.discount ?? 0),
        })),
        advancePaid,
        verdict,
        notes,
      };
      const next = await upsertAcceptanceReport(contract._id, input);
      toast.success("Đã lưu nháp");
      onUpdated(next);
    } catch (err) {
      toast.error(`Lỗi: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function finalize() {
    const ok = await confirm({
      title: "Hoàn thành biên bản nghiệm thu?",
      description:
        "Sau khi hoàn thành, biên bản sẽ KHÔNG thể chỉnh sửa. Tiếp tục?",
      confirmText: "Hoàn thành",
    });
    if (!ok) return;
    setFinalizing(true);
    try {
      await save();
      const next = await finalizeAcceptanceReport(contract._id);
      toast.success("Đã hoàn thành");
      onUpdated(next);
    } catch (err) {
      toast.error(`Lỗi: ${(err as Error).message}`);
    } finally {
      setFinalizing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="report-date">Ngày nghiệm thu</Label>
          <Input
            id="report-date"
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            disabled={isFinalized}
            className="w-48"
          />
        </div>
        <div className="ml-auto text-sm text-[var(--text-muted,#78716C)]">
          {isFinalized && (
            <span className="font-semibold text-green-700">
              ĐÃ HOÀN THÀNH — không thể chỉnh sửa
            </span>
          )}
        </div>
      </div>

      <section>
        <h3 className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--text-muted,#78716C)]">
          Hạng mục thực tế
        </h3>
        <LineItemsEditor
          items={items}
          onChange={setItems}
          disabled={isFinalized}
        />
      </section>

      <section>
        <h3 className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--text-muted,#78716C)]">
          So sánh HĐ vs thực tế
        </h3>
        <DiffTable
          contractItems={contract.lineItems}
          actualItems={items.map((it) => ({
            stt: it.stt,
            description: it.description,
            unit: it.unit,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            amount: calcLineAmount(it.quantity, it.unitPrice, it.discount ?? 0),
          }))}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <FinancialSummary
          subtotal={totals.subtotal}
          vatRate={contract.vatRate}
          vatAmount={totals.vatAmount}
          totalAmount={totals.totalAmount}
          advanceAmount={advancePaid}
          remainderAmount={remainingBalance}
        />
        <div className="rounded-lg border border-[var(--border,#E7E2D9)] bg-white p-4">
          <div className="space-y-3">
            <div>
              <Label htmlFor="advance-paid">Đã tạm ứng (VND)</Label>
              <MoneyInput
                id="advance-paid"
                value={advancePaid}
                onChange={(v) => setAdvancePaid(v)}
                disabled={isFinalized}
              />
              {remainingBalance < 0 && (
                <p className="mt-1 text-xs text-red-700">
                  Cảnh báo: tạm ứng nhiều hơn tổng — đơn vị cung cấp nợ KH{" "}
                  {Math.abs(remainingBalance).toLocaleString("vi-VN")} VND
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="verdict">Kết quả nghiệm thu</Label>
              <Select
                value={verdict}
                onValueChange={(v) => setVerdict(v as typeof verdict)}
                disabled={isFinalized}
              >
                <SelectTrigger id="verdict">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACCEPTED">Chấp nhận</SelectItem>
                  <SelectItem value="ACCEPTED_WITH_NOTES">
                    Chấp nhận có ghi chú
                  </SelectItem>
                  <SelectItem value="REJECTED">Từ chối</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="notes">Ghi chú</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                disabled={isFinalized}
              />
            </div>
          </div>
        </div>
      </div>

      {!isFinalized && (
        <div className="sticky bottom-0 -mx-6 flex justify-end gap-2 border-t border-[var(--border,#E7E2D9)] bg-white/95 px-6 py-3 backdrop-blur">
          <Button variant="outline" onClick={save} disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu nháp"}
          </Button>
          <Button onClick={finalize} disabled={finalizing}>
            {finalizing ? "Đang hoàn thành..." : "Hoàn thành"}
          </Button>
        </div>
      )}
    </div>
  );
}
