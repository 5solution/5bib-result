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
 * Admin marks acceptance as disputed with a reason (≥5 chars). The reason
 * surfaces on the "Tranh chấp" tab and on the crew status page, so the
 * admin should write clearly. Admin can re-send (→ pending_sign) after
 * resolving.
 */
export function DisputeDialog({
  open,
  onOpenChange,
  name,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  name: string;
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
          <DialogTitle>Đánh dấu tranh chấp — {name}</DialogTitle>
          <DialogDescription>
            Lý do sẽ hiển thị cho crew ở trang status. Admin có thể re-send
            nghiệm thu sau khi giải quyết.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="dispute_reason">Lý do *</Label>
          <Textarea
            id="dispute_reason"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="VD: Sai số ngày công — cần xác nhận lại với leader trước khi ký."
            maxLength={2000}
            aria-invalid={error}
          />
          {error ? (
            <p className="text-xs text-red-600">
              Lý do phải có ít nhất 5 ký tự
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              {trimmed.length}/2000 ký tự
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
            {busy ? "Đang xử lý..." : "Đánh dấu tranh chấp"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
