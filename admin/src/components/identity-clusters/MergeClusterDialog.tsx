/**
 * F-049 — Merge dialog cho cluster detail page.
 *
 * BR-49-05 / BR-49-10 Section 3 — "Hợp nhất với hồ sơ khác".
 * UX: text input cluster IDs cách nhau dấu phẩy (giữ pattern F-048 baseline
 * for MVP, future iteration add search autocomplete).
 */

"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ACTION_LABEL } from "@/lib/identity-cluster-labels";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current cluster ID — passed for validation "không thể hợp nhất với chính nó". */
  currentClusterId: string;
  onConfirm: (params: {
    additionalClusterIds: string[];
    reason: string;
  }) => Promise<void> | void;
  isPending: boolean;
}

export function MergeClusterDialog({
  open,
  onOpenChange,
  currentClusterId,
  onConfirm,
  isPending,
}: Props) {
  const [idsText, setIdsText] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setIdsText("");
    setReason("");
    setError(null);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleConfirm = async () => {
    setError(null);
    const ids = idsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (ids.length === 0) {
      setError("Cần nhập ít nhất 1 ID hồ sơ để hợp nhất");
      return;
    }
    if (ids.includes(currentClusterId)) {
      setError("Không thể hợp nhất với chính nó");
      return;
    }
    if (reason.trim().length < 5) {
      setError("Lý do tối thiểu 5 ký tự");
      return;
    }

    await onConfirm({ additionalClusterIds: ids, reason: reason.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{ACTION_LABEL.merge}</DialogTitle>
          <DialogDescription>
            Nhập ID các hồ sơ identity khác (cách nhau dấu phẩy) để hợp nhất
            vào hồ sơ hiện tại. Các hồ sơ nguồn sẽ bị xoá, bản ghi sẽ được dồn
            vào hồ sơ này.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="merge-ids">ID hồ sơ cần hợp nhất</Label>
            <Textarea
              id="merge-ids"
              value={idsText}
              onChange={(e) => setIdsText(e.target.value)}
              placeholder="vd: abc-123-..., def-456-..."
              rows={2}
              className="mt-1 font-mono text-xs"
              maxLength={2000}
              disabled={isPending}
            />
          </div>
          <div>
            <Label htmlFor="merge-reason">Lý do hợp nhất</Label>
            <Textarea
              id="merge-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="vd: Cùng vận động viên, các BIB khác nhau qua các giải"
              rows={3}
              className="mt-1"
              maxLength={500}
              disabled={isPending}
            />
            <p className="mt-1 text-xs text-stone-500">
              {reason.length}/500 ký tự (tối thiểu 5)
            </p>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={isPending}
          >
            {ACTION_LABEL.cancel}
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={handleConfirm}
            disabled={isPending || idsText.trim() === "" || reason.length < 5}
          >
            {isPending && <Loader2 className="size-3.5 animate-spin" />}
            <span>
              {isPending ? "Đang hợp nhất…" : ACTION_LABEL.confirmMerge}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
