"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

/**
 * Shared reject-reason dialog used by the single-row inline action AND the
 * bulk "Từ chối tất cả" toolbar. The reason is required and is emailed to
 * the applicant — enforce minimum length client-side so admin doesn't
 * accidentally send a blank email.
 */
export function RejectDialog({
  open,
  onOpenChange,
  target,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: { count: number; label: string };
  busy: boolean;
  onConfirm: (reason: string) => void | Promise<void>;
}): React.ReactElement {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setReason("");
      setTouched(false);
    }
  }, [open]);

  const trimmed = reason.trim();
  const tooShort = trimmed.length < 5;
  const error = touched && tooShort;

  return (
    <Dialog open={open} onOpenChange={(v) => (!busy ? onOpenChange(v) : null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Từ chối {target.label}</DialogTitle>
          <DialogDescription>
            Lý do sẽ được gửi qua email cho {target.count > 1 ? "người" : "người dùng"}.
            Vui lòng ghi rõ để họ hiểu (ít nhất 5 ký tự).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="rejection_reason">Lý do từ chối *</Label>
          <Textarea
            id="rejection_reason"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="VD: Sự kiện đã đủ nhân sự cho vai trò này, hẹn gặp ở sự kiện sau..."
            maxLength={1000}
            aria-invalid={error}
          />
          {error ? (
            <p className="text-xs text-red-600">
              Lý do phải có ít nhất 5 ký tự
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              {trimmed.length}/1000 ký tự
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Huỷ
          </Button>
          <Button
            variant="destructive"
            disabled={busy || tooShort}
            onClick={() => {
              setTouched(true);
              if (!tooShort) void onConfirm(trimmed);
            }}
          >
            {busy ? "Đang xử lý..." : `Từ chối ${target.count > 1 ? target.count : ""}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
