"use client";

/**
 * F-024 UX-39 v3 Task 3 — Default line items editor (Phụ lục).
 *
 * Admin edit default line items config per template (cột STT / Mô tả / ĐVT /
 * SL / Đơn giá / Giảm / Thành tiền). Khi tạo HĐ mới sẽ pre-populate từ
 * default này — user sửa per HĐ.
 *
 * Pattern clone từ line-items-editor.tsx nhưng standalone CRUD (không pass
 * onChange ra ngoài) + save qua PATCH endpoint.
 */
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, ListPlus, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MoneyInput } from "./money-input";
import { EmptyState } from "./empty-state";
import {
  getContractTemplateLineItems,
  updateContractTemplateLineItems,
  formatVND,
  type ContractType,
  type DefaultLineItem,
} from "@/lib/contracts-api";

interface Props {
  type: ContractType;
}

function calcAmount(item: DefaultLineItem): number {
  const factor = 1 - (item.discount ?? 0) / 100;
  return Math.round((item.quantity ?? 0) * (item.unitPrice ?? 0) * factor);
}

const BLANK: DefaultLineItem = {
  description: "",
  unit: "",
  quantity: 1,
  unitPrice: 0,
  discount: 0,
  note: "",
};

export function TemplateLineItemsEditor({
  type,
}: Props): React.ReactElement {
  const [items, setItems] = useState<DefaultLineItem[]>([]);
  const [original, setOriginal] = useState<DefaultLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    getContractTemplateLineItems(type)
      .then((r) => {
        setItems(r.defaultLineItems ?? []);
        setOriginal(r.defaultLineItems ?? []);
      })
      .catch((err: Error) => toast.error(`Lỗi tải: ${err.message}`))
      .finally(() => setLoading(false));
  }, [type]);

  const dirty = useMemo(
    () => JSON.stringify(items) !== JSON.stringify(original),
    [items, original],
  );

  const subtotal = useMemo(
    () => items.reduce((sum, it) => sum + calcAmount(it), 0),
    [items],
  );

  function setRow(idx: number, patch: Partial<DefaultLineItem>): void {
    setItems((arr) =>
      arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    );
  }

  function addRow(): void {
    setItems((arr) => [...arr, { ...BLANK }]);
  }

  function removeRow(idx: number): void {
    setItems((arr) => arr.filter((_, i) => i !== idx));
  }

  async function save(): Promise<void> {
    setSaving(true);
    try {
      const res = await updateContractTemplateLineItems(type, items);
      setItems(res.defaultLineItems);
      setOriginal(res.defaultLineItems);
      toast.success(
        `Đã lưu — ${res.defaultLineItems.length} hạng mục mặc định`,
      );
    } catch (err) {
      toast.error(`Lỗi lưu: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border,#E7E2D9)] bg-white px-4 py-2">
        <div>
          <h3 className="text-sm font-semibold">
            Phụ lục — Hạng mục mặc định
          </h3>
          <p className="text-xs text-[var(--text-muted,#78716C)]">
            Pre-populate khi tạo HĐ mới cho loại{" "}
            <code className="rounded bg-[#F3F0EB] px-1">{type}</code>. Admin
            vẫn có thể sửa per HĐ.{" "}
            {dirty ? (
              <span className="font-semibold text-amber-700">
                Có thay đổi chưa lưu
              </span>
            ) : null}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => void save()}
          disabled={!dirty || saving}
        >
          {saving ? (
            <>
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              Đang lưu...
            </>
          ) : (
            <>
              <Save className="mr-1.5 size-3.5" />
              Lưu danh sách
            </>
          )}
        </Button>
      </div>

      <div className="rounded-lg border border-[var(--border,#E7E2D9)] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F3F0EB] text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--text-muted,#78716C)]">
              <tr>
                <th className="w-12 px-2 py-2 text-left">STT</th>
                <th className="px-2 py-2 text-left">Mô tả</th>
                <th className="w-24 px-2 py-2 text-left">ĐVT</th>
                <th className="w-20 px-2 py-2 text-right">SL</th>
                <th className="w-32 px-2 py-2 text-right">Đơn giá</th>
                <th className="w-20 px-2 py-2 text-right">Giảm (%)</th>
                <th
                  className="w-36 px-2 py-2 text-right"
                  title="Thành tiền chưa bao gồm VAT"
                >
                  Thành tiền
                </th>
                <th className="w-12 px-2 py-2" aria-label="actions" />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-0">
                    <EmptyState
                      icon={ListPlus}
                      title="Chưa có hạng mục mặc định"
                      description={`Bấm "Thêm dòng" để định nghĩa hạng mục pre-populate cho HĐ ${type} mới.`}
                    />
                  </td>
                </tr>
              ) : (
                items.map((it, idx) => (
                  <tr
                    key={idx}
                    className="border-t border-[var(--border,#E7E2D9)] hover:bg-[#FAF8F5]"
                  >
                    <td className="px-2 py-2 text-center font-mono">
                      {idx + 1}
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        value={it.description}
                        onChange={(e) =>
                          setRow(idx, { description: e.target.value })
                        }
                        placeholder="VD: Chip RFID..."
                      />
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        value={it.unit}
                        onChange={(e) =>
                          setRow(idx, { unit: e.target.value })
                        }
                        placeholder="cái/người/cổng"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        className="text-right"
                        value={it.quantity}
                        onChange={(e) =>
                          setRow(idx, {
                            quantity: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </td>
                    <td className="px-1 py-1">
                      <MoneyInput
                        value={it.unitPrice}
                        onChange={(v) => setRow(idx, { unitPrice: v })}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        className="text-right"
                        value={it.discount ?? 0}
                        onChange={(e) =>
                          setRow(idx, {
                            discount: Math.max(
                              0,
                              Math.min(100, Number(e.target.value) || 0),
                            ),
                          })
                        }
                      />
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-[12px] tabular-nums">
                      {formatVND(calcAmount(it))}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        className="text-[var(--text-muted,#78716C)] hover:text-red-600"
                        aria-label="Xóa hạng mục"
                        title="Xóa"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {items.length > 0 ? (
              <tfoot>
                <tr className="border-t-2 border-[var(--border,#E7E2D9)] bg-[#F9F6F0]">
                  <td colSpan={6} className="px-2 py-2 text-right font-semibold">
                    Tạm tính (chưa VAT)
                  </td>
                  <td className="px-2 py-2 text-right font-mono font-bold tabular-nums">
                    {formatVND(subtotal)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
        <div className="border-t border-[var(--border,#E7E2D9)] p-2">
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="mr-1.5 size-3.5" /> Thêm dòng
          </Button>
        </div>
      </div>
    </div>
  );
}

export default TemplateLineItemsEditor;
