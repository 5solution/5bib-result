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
import { Plus, Trash2, Package } from "lucide-react";

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
      })),
    [items],
  );

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
        <table className="w-full text-sm">
          <thead className="bg-[#F3F0EB] text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--text-muted,#78716C)]">
            <tr>
              <th className="px-2 py-2 text-left w-12">STT</th>
              <th className="px-2 py-2 text-left">Mô tả</th>
              <th className="px-2 py-2 text-left w-24">ĐVT</th>
              <th className="px-2 py-2 text-right w-20">SL</th>
              <th className="px-2 py-2 text-right w-32">Đơn giá</th>
              <th className="px-2 py-2 text-right w-20">Giảm (%)</th>
              <th className="px-2 py-2 text-right w-36">Thành tiền</th>
              <th className="px-2 py-2 w-20" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {computed.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="py-8 text-center text-[var(--text-muted,#78716C)]"
                >
                  Chưa có hạng mục — nhấn "Thêm dòng" hoặc "Chọn từ danh mục"
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
                  <Input
                    type="number"
                    min={0}
                    step={1000}
                    value={it.unitPrice}
                    onChange={(e) =>
                      setRow(idx, { unitPrice: Number(e.target.value) || 0 })
                    }
                    className="text-right font-mono"
                    disabled={disabled}
                    aria-label={`Đơn giá dòng ${it.stt}`}
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
