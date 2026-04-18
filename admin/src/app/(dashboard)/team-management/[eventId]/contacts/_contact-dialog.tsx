"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  ContactType,
  EventContact,
  UpsertContactInput,
} from "./_types";
import { CONTACT_TYPE_OPTIONS } from "./_types";

const PHONE_REGEX = /^[0-9\s+\-()]{8,20}$/;

interface ContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editTarget: EventContact | null;
  onSubmit: (input: UpsertContactInput) => Promise<void>;
}

interface FormState {
  contact_type: ContactType;
  contact_name: string;
  phone: string;
  phone2: string;
  note: string;
  sort_order: number;
}

const INITIAL_FORM: FormState = {
  contact_type: "medical",
  contact_name: "",
  phone: "",
  phone2: "",
  note: "",
  sort_order: 0,
};

export default function ContactDialog({
  open,
  onOpenChange,
  editTarget,
  onSubmit,
}: ContactDialogProps): React.ReactElement {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>(
    {},
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setErrors({});
      return;
    }
    if (editTarget) {
      setForm({
        contact_type: editTarget.contact_type,
        contact_name: editTarget.contact_name,
        phone: editTarget.phone,
        phone2: editTarget.phone2 ?? "",
        note: editTarget.note ?? "",
        sort_order: editTarget.sort_order,
      });
    } else {
      setForm(INITIAL_FORM);
    }
    setErrors({});
  }, [open, editTarget]);

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.contact_name.trim()) next.contact_name = "Tên bắt buộc";
    if (!form.phone.trim()) next.phone = "SĐT chính bắt buộc";
    else if (!PHONE_REGEX.test(form.phone.trim()))
      next.phone = "SĐT không hợp lệ (8–20 ký tự số)";
    if (form.phone2.trim() && !PHONE_REGEX.test(form.phone2.trim()))
      next.phone2 = "SĐT phụ không hợp lệ";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(): Promise<void> {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: UpsertContactInput = {
        contact_type: form.contact_type,
        contact_name: form.contact_name.trim(),
        phone: form.phone.trim(),
        phone2: form.phone2.trim() ? form.phone2.trim() : null,
        note: form.note.trim() ? form.note.trim() : null,
        sort_order: Number.isFinite(form.sort_order) ? form.sort_order : 0,
      };
      await onSubmit(payload);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editTarget ? "Sửa liên lạc" : "Thêm liên lạc khẩn cấp"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Loại</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.contact_type}
              onChange={(e) =>
                setForm({
                  ...form,
                  contact_type: e.target.value as ContactType,
                })
              }
            >
              {CONTACT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.icon} {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Tên *</Label>
            <Input
              placeholder="VD: BS. Nguyễn Văn A"
              value={form.contact_name}
              onChange={(e) =>
                setForm({ ...form, contact_name: e.target.value })
              }
            />
            {errors.contact_name ? (
              <p className="text-xs text-red-600 mt-1">{errors.contact_name}</p>
            ) : null}
          </div>
          <div>
            <Label>SĐT chính *</Label>
            <Input
              type="tel"
              placeholder="0912 345 678"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            {errors.phone ? (
              <p className="text-xs text-red-600 mt-1">{errors.phone}</p>
            ) : null}
          </div>
          <div>
            <Label>SĐT phụ</Label>
            <Input
              type="tel"
              placeholder="Tuỳ chọn"
              value={form.phone2}
              onChange={(e) => setForm({ ...form, phone2: e.target.value })}
            />
            {errors.phone2 ? (
              <p className="text-xs text-red-600 mt-1">{errors.phone2}</p>
            ) : null}
          </div>
          <div>
            <Label>Ghi chú</Label>
            <Textarea
              placeholder="VD: Gọi khi có người ngất/chấn thương nặng"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              rows={3}
            />
          </div>
          <div>
            <Label>Thứ tự hiển thị</Label>
            <Input
              type="number"
              value={form.sort_order}
              onChange={(e) =>
                setForm({
                  ...form,
                  sort_order: Number(e.target.value) || 0,
                })
              }
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Số nhỏ hiển thị trước. Contact cùng type có thứ tự giống nhau sắp
              xếp theo thời gian tạo.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            disabled={saving}
            onClick={() => {
              void handleSubmit();
            }}
          >
            {saving ? "Đang lưu..." : "Lưu liên lạc"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
