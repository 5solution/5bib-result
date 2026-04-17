"use client";

/**
 * Dialog nhập lý do từ chối (dùng chung cho user reject + supply order reject).
 * Thay thế `window.prompt()` — consistent UX với shadcn dialogs còn lại.
 *
 * Controlled component: parent giữ `open` + handle `onConfirm(reason)`.
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  open: boolean;
  title?: string;
  description?: string;
  placeholder?: string;
  confirmLabel?: string;
  loading?: boolean;
  /** min length enforcement (backend validates >= 2 anyway) */
  minLength?: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void | Promise<void>;
}

export function RejectReasonDialog({
  open,
  title = "Lý do từ chối",
  description = "Nhập lý do rõ ràng để người bị từ chối biết nguyên nhân.",
  placeholder = "VD: Thông tin liên lạc không hợp lệ",
  confirmLabel = "Từ chối",
  loading = false,
  minLength = 2,
  onOpenChange,
  onConfirm,
}: Props) {
  const [reason, setReason] = useState("");

  // Reset khi mở
  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const canSubmit = reason.trim().length >= minLength && !loading;

  async function handleSubmit() {
    if (!canSubmit) return;
    await onConfirm(reason.trim());
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <p className="text-xs text-muted-foreground">{description}</p>
          <div className="grid gap-2">
            <Label htmlFor="reject-reason">Lý do</Label>
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={placeholder}
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {reason.trim().length}/500 ký tự (tối thiểu {minLength})
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Hủy
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {loading ? "..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
