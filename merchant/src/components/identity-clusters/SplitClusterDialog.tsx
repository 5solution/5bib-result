/**
 * F-049 — Split dialog cho cluster detail page.
 *
 * BR-49-10 Section 4 — "Phân tách hồ sơ" with checkbox selection.
 * Validation: phải để lại ≥1 bản ghi gốc (BR-49 form spec).
 */

"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { LinkedRecord } from "@/components/identity-clusters/LinkedRecordsTable";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  records: LinkedRecord[];
  onConfirm: (params: {
    extractAthleteIds: number[];
    reason: string;
  }) => Promise<void> | void;
  isPending: boolean;
}

/**
 * Wrapper that uses `key` to remount inner form on close — avoids
 * set-state-in-effect lint rule for reset logic.
 */
export function SplitClusterDialog({ open, ...rest }: Props) {
  return (
    <Dialog open={open} onOpenChange={rest.onOpenChange}>
      {/* key based on `open` forces fresh state every dialog open */}
      <SplitDialogInner key={String(open)} {...rest} />
    </Dialog>
  );
}

function SplitDialogInner({
  onOpenChange,
  records,
  onConfirm,
  isPending,
}: Omit<Props, "open">) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
    setError(null);
  };

  const handleConfirm = async () => {
    setError(null);
    if (selectedIds.size === 0) {
      setError("Chọn ít nhất 1 bản ghi để phân tách");
      return;
    }
    if (selectedIds.size >= records.length) {
      setError(
        "Không thể phân tách tất cả — phải giữ ≥1 bản ghi gốc",
      );
      return;
    }
    if (reason.trim().length < 5) {
      setError("Lý do tối thiểu 5 ký tự");
      return;
    }
    await onConfirm({
      extractAthleteIds: Array.from(selectedIds),
      reason: reason.trim(),
    });
  };

  const allSelected = selectedIds.size >= records.length && records.length > 0;
  const canConfirm =
    selectedIds.size > 0 && !allSelected && reason.length >= 5 && !isPending;

  return (
    <>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{ACTION_LABEL.split}</DialogTitle>
          <DialogDescription>
            Chọn các bản ghi cần tách ra hồ sơ identity mới. Các bản ghi đã
            chọn sẽ được tách thành một hồ sơ riêng, hồ sơ hiện tại sẽ giữ các
            bản ghi còn lại.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-72 overflow-auto rounded-md border border-stone-200">
          <ul className="divide-y divide-stone-100">
            {records.map((r) => {
              const checked = selectedIds.has(r.athletes_id);
              const displayName =
                r.bibNumber ?? r.bib_number ?? `#${r.athletes_id}`;
              const athleteName = r.fullName ?? "Không có tên";
              const raceName = r.raceName ?? "(không tìm thấy giải)";
              return (
                <li
                  key={r.athletes_id}
                  className="flex items-start gap-3 p-3 hover:bg-stone-50"
                >
                  <Checkbox
                    id={`split-${r.athletes_id}`}
                    checked={checked}
                    onCheckedChange={(c) => toggle(r.athletes_id, c === true)}
                    disabled={isPending}
                  />
                  <Label
                    htmlFor={`split-${r.athletes_id}`}
                    className="flex-1 cursor-pointer space-y-0.5"
                  >
                    <div className="text-sm font-medium text-stone-900">
                      BIB <span className="font-mono">{displayName}</span> —{" "}
                      {athleteName}
                    </div>
                    <div
                      className="truncate text-xs text-stone-500"
                      title={raceName}
                    >
                      {raceName}
                    </div>
                  </Label>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <Label htmlFor="split-reason">Lý do phân tách</Label>
          <Textarea
            id="split-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="vd: Khác người, trùng tên qua các giải"
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

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {ACTION_LABEL.cancel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {isPending && <Loader2 className="size-3.5 animate-spin" />}
            <span>
              {isPending ? "Đang phân tách…" : ACTION_LABEL.confirmSplit}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </>
  );
}
