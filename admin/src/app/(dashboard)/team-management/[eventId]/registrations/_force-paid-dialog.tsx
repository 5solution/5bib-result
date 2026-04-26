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
import { AlertTriangle } from "lucide-react";

/**
 * Escape-hatch dialog for marking a registration as paid WITHOUT a signed
 * biên bản nghiệm thu. The reason is required (≥10 chars), persisted on
 * the row and emitted to the server audit log. Use cases:
 *
 *   - Crew unreachable / lost magic link, needs to be paid anyway
 *   - Legacy row from pre-v2 flow where acceptance doesn't exist yet
 *   - Test/pilot data the admin is cleaning up manually
 *
 * Every force-paid action is audit-logged server-side. Reason must be
 * ≥10 chars so admins explain themselves.
 */
export function ForcePaidDialog({
  open,
  onOpenChange,
  name,
  acceptanceStatus,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  name: string;
  acceptanceStatus: string;
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
  const tooShort = trimmed.length < 10;
  const error = touched && tooShort;

  return (
    <Dialog open={open} onOpenChange={(v) => (!busy ? onOpenChange(v) : null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="size-5" />
            Cưỡng bức thanh toán — {name}
          </DialogTitle>
          <DialogDescription>
            Bỏ qua cổng nghiệm thu (
            <span className="font-mono">{acceptanceStatus}</span>
            ). Thao tác này sẽ được ghi vào nhật ký hệ thống cùng với lý do, và
            hiển thị vĩnh viễn trên trang chi tiết. Chỉ dùng khi crew không
            liên hệ được hoặc là dữ liệu legacy.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="force_reason">Lý do *</Label>
          <Textarea
            id="force_reason"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="VD: TNV không thể liên lạc qua email, đã xác nhận qua điện thoại ngày 2026-04-15 — duyệt thủ công theo quyết định của admin Danny."
            maxLength={2000}
            aria-invalid={error}
          />
          {error ? (
            <p className="text-xs text-red-600">
              Lý do phải có ít nhất 10 ký tự
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              {trimmed.length}/2000 ký tự — tối thiểu 10.
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
            {busy ? "Đang xử lý..." : "Xác nhận cưỡng bức thanh toán"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
