"use client";

/**
 * F-028 Phase 3 — Cost Suggestions Dialog.
 *
 * Workflow:
 *   1. Click "Gợi ý từ HĐ" trên P&L page → fetch GET /cost-suggestions
 *   2. Render checkbox list: mỗi row có ☑ + description + category VN + qty × cost
 *   3. Admin tick các dòng muốn tạo (mặc định tick ALL)
 *   4. Có thể edit inline amount per row trước submit
 *   5. Click "Tạo N chi phí" → POST /cost-items/bulk → toast + onCreated()
 *
 * Idempotency: nút submit disable ngay sau click (state `submitting`) để
 * tránh double-submit nhầm (server KHÔNG dedupe).
 *
 * Edge cases UI:
 *   - Empty list (HĐ chưa có line items với catalogItemId) → empty state
 *     hướng dẫn admin pick từ catalog ở wizard
 *   - referenceCost=0 → row hiển thị badge "Chưa có giá vốn — cần nhập tay"
 *     nhưng vẫn cho tick (admin nhập amount sau).
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  bulkCreateCostItems,
  COST_CATEGORY_LABELS,
  formatVnd,
  getCostSuggestions,
  type CostSuggestion,
} from "@/lib/finance-api";

interface Props {
  contractId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

interface SuggestionRow extends CostSuggestion {
  /** UI state — admin có tick row này không (mặc định true) */
  selected: boolean;
  /** UI state — amount admin edit (initialized = suggestedAmount) */
  editedAmount: string;
}

export function CostSuggestionsDialog({
  contractId,
  open,
  onOpenChange,
  onCreated,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<SuggestionRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    getCostSuggestions(contractId)
      .then((data) => {
        setRows(
          data.map((s) => ({
            ...s,
            selected: true,
            editedAmount: String(s.suggestedAmount),
          })),
        );
      })
      .catch((e: Error) => {
        setError(e.message);
        toast.error(`Không tải được gợi ý: ${e.message}`);
      })
      .finally(() => setLoading(false));
  }, [open, contractId]);

  function toggleRow(idx: number, selected: boolean) {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, selected } : r)),
    );
  }

  function setRowAmount(idx: number, amount: string) {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, editedAmount: amount } : r)),
    );
  }

  function toggleAll(checked: boolean) {
    setRows((prev) => prev.map((r) => ({ ...r, selected: checked })));
  }

  const tickedRows = rows.filter((r) => r.selected);
  const allChecked = rows.length > 0 && tickedRows.length === rows.length;
  const someChecked = tickedRows.length > 0 && tickedRows.length < rows.length;
  const totalAmount = tickedRows.reduce(
    (sum, r) => sum + (Number(r.editedAmount) || 0),
    0,
  );

  async function submit() {
    if (tickedRows.length === 0) {
      setError("Chọn ít nhất 1 chi phí để tạo");
      return;
    }
    // Validate amount per row
    for (const r of tickedRows) {
      const n = Number(r.editedAmount);
      if (!Number.isFinite(n) || n < 0) {
        setError(`Số tiền dòng "${r.description}" không hợp lệ`);
        return;
      }
      if (n > 1e12) {
        setError(`Số tiền dòng "${r.description}" vượt 10^12`);
        return;
      }
    }
    setError(null);
    setSubmitting(true);
    try {
      const items = tickedRows.map((r) => ({
        description: r.description,
        category: r.category,
        amount: Number(r.editedAmount),
        note: `Tạo từ gợi ý HĐ (STT ${r.contractLineItemStt}, ${r.quantity} × ${formatVnd(r.costPerUnit)})`,
      }));
      const created = await bulkCreateCostItems(contractId, items);
      toast.success(`Đã tạo ${created.length} chi phí từ gợi ý`);
      onCreated();
      onOpenChange(false);
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      toast.error(`Lỗi: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && !submitting && onOpenChange(false)}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Gợi ý chi phí từ Hợp đồng</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-md border border-[var(--border,#E7E2D9)] bg-[#F3F0EB] p-6 text-center text-sm text-[var(--text-muted,#78716C)]">
              <p className="font-medium text-stone-700">
                Chưa có gợi ý chi phí từ HĐ
              </p>
              <p className="mt-1">
                Để có gợi ý, line items trong HĐ phải được pick từ
                <span className="font-medium"> Danh mục dịch vụ </span>
                (Service Catalog) khi tạo HĐ. Quay lại wizard và dùng nút "Chọn
                từ danh mục" để pick dịch vụ.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border border-[var(--border,#E7E2D9)] bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-[#F3F0EB] text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--text-muted,#78716C)]">
                    <tr>
                      <th className="w-10 px-2 py-2 text-left">
                        <Checkbox
                          checked={allChecked}
                          indeterminate={someChecked}
                          onCheckedChange={(v) => toggleAll(!!v)}
                          aria-label="Tick tất cả"
                          disabled={submitting}
                        />
                      </th>
                      <th className="px-2 py-2 text-left">Mô tả</th>
                      <th className="px-2 py-2 text-left w-28">Nhóm</th>
                      <th className="px-2 py-2 text-right w-44">
                        Số tiền (VND)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => {
                      const noCost = r.costPerUnit === 0;
                      return (
                        <tr
                          key={`${r.catalogItemId}-${r.contractLineItemStt}`}
                          className={`border-t border-[var(--border,#E7E2D9)] ${
                            r.selected ? "bg-amber-50/50" : ""
                          }`}
                        >
                          <td className="px-2 py-2 align-top">
                            <Checkbox
                              checked={r.selected}
                              onCheckedChange={(v) => toggleRow(idx, !!v)}
                              disabled={submitting}
                              aria-label={`Tick ${r.description}`}
                            />
                          </td>
                          <td className="px-2 py-2 align-top">
                            <div className="font-medium">{r.description}</div>
                            <div className="text-xs text-[var(--text-muted,#78716C)]">
                              STT {r.contractLineItemStt} · {r.quantity}{" "}
                              {r.unit ?? "đv"} × {formatVnd(r.costPerUnit)}
                            </div>
                            {noCost && (
                              <div className="mt-1 inline-flex rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800">
                                Chưa có giá vốn — cần nhập tay
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-2 align-top text-sm">
                            {COST_CATEGORY_LABELS[r.category]}
                          </td>
                          <td className="px-2 py-2 align-top">
                            <Input
                              type="number"
                              min={0}
                              step={1000}
                              value={r.editedAmount}
                              onChange={(e) =>
                                setRowAmount(idx, e.target.value)
                              }
                              disabled={!r.selected || submitting}
                              className="text-right font-mono"
                              aria-label={`Số tiền ${r.description}`}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between rounded-md border border-[var(--border,#E7E2D9)] bg-[#F3F0EB] px-3 py-2 text-sm">
                <span className="text-[var(--text-muted,#78716C)]">
                  Đã chọn {tickedRows.length}/{rows.length} dòng
                </span>
                <span className="font-mono font-semibold">
                  Tổng: {formatVnd(totalAmount)}
                </span>
              </div>
            </>
          )}
          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            Đóng
          </Button>
          <Button
            onClick={submit}
            disabled={
              submitting || rows.length === 0 || tickedRows.length === 0
            }
          >
            {submitting
              ? "Đang tạo..."
              : `Tạo ${tickedRows.length} chi phí`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
