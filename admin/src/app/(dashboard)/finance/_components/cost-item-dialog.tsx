"use client";

/**
 * F-028 Screen 4 + 5 — shared create/edit dialog for cost item.
 *
 * Form fields (BR-PNL-03 strict):
 *   - description (required, 1..500)
 *   - category (required, enum 5)
 *   - amount (required, ≥0 VND)
 *   - incurredDate (optional, free-format max 100)
 *   - note (optional, max 1000)
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COST_CATEGORIES,
  COST_CATEGORY_LABELS,
  createCostItem,
  updateCostItem,
  type CostCategory,
  type CostItemView,
} from "@/lib/finance-api";

type Mode = "create" | "edit";

interface Props {
  contractId: string;
  open: boolean;
  mode: Mode;
  initial?: CostItemView;
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  description: string;
  category: CostCategory;
  amount: string; // controlled as string for input
  note: string;
  incurredDate: string;
}

const EMPTY: FormState = {
  description: "",
  category: "OTHER",
  amount: "",
  note: "",
  incurredDate: "",
};

export function CostItemDialog({
  contractId,
  open,
  mode,
  initial,
  onClose,
  onSaved,
}: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (mode === "edit" && initial) {
        setForm({
          description: initial.description,
          category: initial.category,
          amount: String(initial.amount),
          note: initial.note ?? "",
          incurredDate: initial.incurredDate ?? "",
        });
      } else {
        setForm(EMPTY);
      }
      setError(null);
    }
  }, [open, mode, initial]);

  function validate(): string | null {
    if (!form.description.trim()) return "Mô tả không được rỗng";
    if (form.description.length > 500) return "Mô tả tối đa 500 ký tự";
    if (!form.amount) return "Số tiền không được rỗng";
    const amountNum = Number(form.amount);
    if (!Number.isFinite(amountNum) || amountNum < 0) {
      return "Số tiền phải là số ≥ 0";
    }
    if (amountNum > 1e12) return "Số tiền vượt giới hạn (10^12 VND)";
    if (form.note.length > 1000) return "Ghi chú tối đa 1000 ký tự";
    if (form.incurredDate.length > 100) {
      return "Ngày phát sinh tối đa 100 ký tự";
    }
    return null;
  }

  async function submit() {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        description: form.description.trim(),
        category: form.category,
        amount: Number(form.amount),
        note: form.note.trim() || undefined,
        incurredDate: form.incurredDate.trim() || undefined,
      };
      if (mode === "create") {
        await createCostItem(contractId, payload);
        toast.success("Đã thêm chi phí");
      } else if (initial) {
        await updateCostItem(contractId, initial.id, payload);
        toast.success("Đã cập nhật chi phí");
      }
      onSaved();
      onClose();
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      toast.error(`Lỗi: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !submitting && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Thêm chi phí" : "Sửa chi phí"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="ci-description">
              Mô tả <span className="text-rose-600">*</span>
            </Label>
            <Input
              id="ci-description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="VD: Vật tư biển báo race 30/4"
              maxLength={500}
              disabled={submitting}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ci-category">
                Nhóm <span className="text-rose-600">*</span>
              </Label>
              <Select
                value={form.category}
                onValueChange={(v) =>
                  setForm({ ...form, category: v as CostCategory })
                }
                disabled={submitting}
              >
                <SelectTrigger id="ci-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COST_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {COST_CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="ci-amount">
                Số tiền VND <span className="text-rose-600">*</span>
              </Label>
              <Input
                id="ci-amount"
                type="number"
                min={0}
                step={1000}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0"
                disabled={submitting}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="ci-incurred">Ngày phát sinh</Label>
            <Input
              id="ci-incurred"
              value={form.incurredDate}
              onChange={(e) =>
                setForm({ ...form, incurredDate: e.target.value })
              }
              placeholder="VD: 15/05/2026 hoặc Tuần 1 tháng 5"
              maxLength={100}
              disabled={submitting}
            />
          </div>
          <div>
            <Label htmlFor="ci-note">Ghi chú</Label>
            <Textarea
              id="ci-note"
              rows={3}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="VD: Vendor Phú An biển báo"
              maxLength={1000}
              disabled={submitting}
            />
          </div>
          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={submitting} onClick={onClose}>
            Huỷ
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting
              ? "Đang lưu..."
              : mode === "create"
                ? "Thêm chi phí"
                : "Cập nhật"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
