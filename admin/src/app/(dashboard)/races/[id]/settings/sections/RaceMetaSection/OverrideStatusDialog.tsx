'use client';

/**
 * F-014 BR-AS-48 — Admin force override dialog (audit logged).
 *
 * Verbatim port of legacy override dialog (lines 877–987).
 * - Reason ≥ 10 chars required.
 * - Reason ≤ 500 chars enforced via maxLength.
 * - Confirm disabled when reason invalid OR same status selected.
 */

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ShieldAlert } from 'lucide-react';
import type { RaceStatus } from '../section-shared.types';

interface OverrideStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: RaceStatus;
  onConfirm: (next: RaceStatus, reason: string) => Promise<void>;
}

export function OverrideStatusDialog(props: OverrideStatusDialogProps) {
  const { open, onOpenChange, current, onConfirm } = props;
  const [next, setNext] = useState<RaceStatus>(current);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setNext(current);
      setReason('');
      setSubmitting(false);
    }
  }, [open, current]);

  const reasonValid = reason.trim().length >= 10;
  const sameStatus = next === current;

  const handleConfirm = async () => {
    if (!reasonValid || sameStatus) return;
    setSubmitting(true);
    try {
      await onConfirm(next, reason.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-orange-600" />
            Override trạng thái giải
          </DialogTitle>
          <DialogDescription>
            Thao tác này bỏ qua luật forward-only và được ghi vào audit log. Chỉ
            dùng khi thật sự cần (sync nhầm, sửa sai, mở lại giải để edit).
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label>Trạng thái mới</Label>
            <Select
              value={next}
              onValueChange={(v) => setNext((v ?? 'pre_race') as RaceStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Nháp (ẩn khỏi public)</SelectItem>
                <SelectItem value="pre_race">Chuẩn bị</SelectItem>
                <SelectItem value="live">Đang diễn ra</SelectItem>
                <SelectItem value="ended">Đã kết thúc</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Hiện tại: <span className="font-semibold">{current}</span>
              {sameStatus && ' (không thay đổi)'}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="override-reason">
              Lý do <span className="text-destructive">*</span>
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                ({reason.trim().length}/10 ký tự tối thiểu)
              </span>
            </Label>
            <Textarea
              id="override-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Giải bị sync nhầm sang ended, cần mở lại để sửa result bib 1234..."
              rows={3}
              maxLength={500}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Hủy
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={submitting || !reasonValid || sameStatus}
            data-testid="override-confirm"
          >
            {submitting ? 'Đang override...' : 'Xác nhận override'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default OverrideStatusDialog;
