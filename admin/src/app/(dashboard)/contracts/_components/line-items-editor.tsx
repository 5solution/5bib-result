"use client";

/**
 * F-024 Line Items Editor — dynamic table edit + real-time calc subtotal/VAT/total.
 *
 * BR-CM-04: amount = quantity × unitPrice × (1 - discount/100). Round to integer VND.
 *
 * Caller passes current items + setter. Component handles add/remove rows + per-cell
 * edit. Auto-renumbers stt on add/remove.
 */
import { useMemo } from "react";
import {
  calcLineAmount,
  formatVND,
  type LineItemInput,
} from "@/lib/contracts-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Package, ListPlus } from "lucide-react";
import { MoneyInput } from "./money-input";
import { EmptyState } from "./empty-state";

type Props = {
  items: LineItemInput[];
  onChange: (next: LineItemInput[]) => void;
  /** When set, "Chọn từ danh mục" button is shown — calls back per row. */
  onPickFromCatalog?: (rowIndex: number) => void;
  disabled?: boolean;
};

const BLANK_ITEM: LineItemInput = {
  stt: 1,
  description: "",
  unit: "",
  quantity: 1,
  unitPrice: 0,
  cost: 0,
  discount: 0,
  selected: true,
};

export function LineItemsEditor({
  items,
  onChange,
  onPickFromCatalog,
  disabled,
}: Props) {
  const computed = useMemo(
    () =>
      items.map((it) => ({
        ...it,
        amount: calcLineAmount(it.quantity, it.unitPrice, it.discount ?? 0),
        // FEATURE-033 — line-level estimated cost preview = cost × quantity
        lineCost: (Number(it.cost) || 0) * (Number(it.quantity) || 0),
      })),
    [items],
  );

  // FEATURE-033 — preview totals: revenue/cost/profit/margin estimated từ
  // line items HIỆN TẠI trong wizard, KHÔNG đợi backend P&L compute.
  // Mục đích Danny: "tao muốn nhìn P&L ở đầu mục luôn".
  const previewTotals = useMemo(() => {
    const revenue = computed
      .filter((it) => it.selected !== false)
      .reduce((s, it) => s + it.amount, 0);
    const cost = computed
      .filter((it) => it.selected !== false)
      .reduce((s, it) => s + it.lineCost, 0);
    const profit = revenue - cost;
    const margin = revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0;
    return { revenue, cost, profit, margin };
  }, [computed]);

  function setRow(idx: number, patch: Partial<LineItemInput>) {
    const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    onChange(next);
  }

  function addRow() {
    onChange([...items, { ...BLANK_ITEM, stt: items.length + 1 }]);
  }

  function removeRow(idx: number) {
    const next = items
      .filter((_, i) => i !== idx)
      .map((it, i) => ({ ...it, stt: i + 1 }));
    onChange(next);
  }

  return (
    <div className="rounded-lg border border-[var(--border,#E7E2D9)] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="bg-[#F3F0EB] text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--text-muted,#78716C)]">
            <tr>
              <th className="px-2 py-2 text-left w-10">STT</th>
              <th className="px-2 py-2 text-left min-w-[200px]">Mô tả</th>
              <th className="px-2 py-2 text-left w-20">ĐVT</th>
              <th className="px-2 py-2 text-right w-20">SL</th>
              <th className="px-2 py-2 text-right w-32">Đơn giá</th>
              <th
                className="px-2 py-2 text-right w-32"
                title="Giá vốn 1 đơn vị (ước tính). P&L Deal = (Đơn giá - Giá vốn) × SL. Khi có cost_items thực tế nhập sau, P&L sẽ ưu tiên actual."
              >
                Giá vốn
              </th>
              <th className="px-2 py-2 text-right w-20">Giảm %</th>
              <th
                className="px-2 py-2 text-right w-36"
                title="Thành tiền chưa bao gồm VAT — VAT tính ở Financial Summary bên dưới"
              >
                Thành tiền
              </th>
              <th className="px-2 py-2 w-12" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {computed.length === 0 && (
              <tr>
                <td colSpan={9} className="p-0">
                  <EmptyState
                    icon={ListPlus}
                    title="Chưa có hạng mục"
                    description={`Bấm "Thêm dòng" để nhập tự do${
                      onPickFromCatalog
                        ? ' hoặc "Chọn từ danh mục" để pick reference từ catalog'
                        : ""
                    }.`}
                  />
                </td>
              </tr>
            )}
            {computed.map((it, idx) => (
              <tr
                key={idx}
                className="border-t border-[var(--border,#E7E2D9)] hover:bg-[#FAF8F5]"
              >
                <td className="px-2 py-2 text-center font-mono">{it.stt}</td>
                <td className="px-1 py-1">
                  <Input
                    value={it.description}
                    onChange={(e) =>
                      setRow(idx, { description: e.target.value })
                    }
                    placeholder="Mô tả dịch vụ"
                    disabled={disabled}
                    aria-label={`Mô tả dòng ${it.stt}`}
                  />
                </td>
                <td className="px-1 py-1">
                  <Input
                    value={it.unit}
                    onChange={(e) => setRow(idx, { unit: e.target.value })}
                    placeholder="VĐV"
                    disabled={disabled}
                    aria-label={`ĐVT dòng ${it.stt}`}
                  />
                </td>
                <td className="px-1 py-1">
                  <Input
                    type="number"
                    min={0}
                    value={it.quantity}
                    onChange={(e) =>
                      setRow(idx, { quantity: Number(e.target.value) || 0 })
                    }
                    className="text-right"
                    disabled={disabled}
                    aria-label={`Số lượng dòng ${it.stt}`}
                  />
                </td>
                <td className="px-1 py-1">
                  <MoneyInput
                    value={it.unitPrice}
                    onChange={(v) => setRow(idx, { unitPrice: v })}
                    className="text-right font-mono"
                    disabled={disabled}
                    aria-label={`Đơn giá dòng ${it.stt}`}
                    placeholder="0"
                  />
                </td>
                <td className="px-1 py-1">
                  <MoneyInput
                    value={it.cost ?? 0}
                    onChange={(v) => setRow(idx, { cost: v })}
                    className="text-right font-mono text-muted-foreground"
                    disabled={disabled}
                    aria-label={`Giá vốn dòng ${it.stt}`}
                    placeholder="0"
                  />
                </td>
                <td className="px-1 py-1">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={it.discount ?? 0}
                    onChange={(e) =>
                      setRow(idx, { discount: Number(e.target.value) || 0 })
                    }
                    className="text-right"
                    disabled={disabled}
                    aria-label={`Giảm giá dòng ${it.stt}`}
                  />
                </td>
                <td className="px-2 py-2 text-right font-mono font-semibold">
                  {formatVND(it.amount)}
                </td>
                <td className="px-1 py-1 text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRow(idx)}
                    disabled={disabled}
                    aria-label={`Xoá dòng ${it.stt}`}
                  >
                    <Trash2 className="size-4 text-red-600" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* FEATURE-033 — P&L Deal preview real-time (nhìn ngay khi tạo HĐ) */}
      {computed.length > 0 && previewTotals.cost > 0 && (
        <div className="border-t border-[var(--border,#E7E2D9)] bg-emerald-50/40 px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <span className="font-semibold uppercase tracking-wider text-emerald-900">
              💰 P&L Deal (ước tính)
            </span>
            <span className="text-muted-foreground">
              Doanh thu:{" "}
              <span className="font-mono font-semibold text-foreground">
                {formatVND(previewTotals.revenue)}
              </span>
            </span>
            <span className="text-muted-foreground">
              Giá vốn:{" "}
              <span className="font-mono font-semibold text-foreground">
                {formatVND(previewTotals.cost)}
              </span>
            </span>
            <span
              className={`font-mono font-bold ${
                previewTotals.profit >= 0
                  ? "text-emerald-700"
                  : "text-rose-700"
              }`}
            >
              Lãi/Lỗ: {previewTotals.profit >= 0 ? "+" : ""}
              {formatVND(previewTotals.profit)} ({previewTotals.margin}%)
            </span>
            <span
              className="ml-auto text-[10px] italic text-muted-foreground"
              title="P&L tính từ Giá vốn nhập tay ở line items. Khi nhập cost_items thực tế ở trang HĐ chi tiết, P&L sẽ ưu tiên actual."
            >
              Ước tính từ line items — actual override khi nhập cost_items
            </span>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 border-t border-[var(--border,#E7E2D9)] p-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRow}
          disabled={disabled}
        >
          <Plus className="size-4" /> Thêm dòng trống
        </Button>
        {onPickFromCatalog && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPickFromCatalog(items.length)}
            disabled={disabled}
          >
            <Package className="size-4" /> Chọn từ danh mục
          </Button>
        )}
      </div>
    </div>
  );
}
