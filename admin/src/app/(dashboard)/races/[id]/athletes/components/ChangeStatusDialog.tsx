'use client';

/**
 * F-014 BR-AS-03 — Change status dialog with reason validation.
 *
 * For DSQ/DNF/CUT/MED status changes the user MUST enter a reason of
 * ≥10 chars (≤500). For PICKED/REG/LIVE/FIN/DNS reason is optional.
 *
 * Single-target use (called from row "Change status" action). Bulk use
 * deferred to F-014.5.
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
import { ATHLETES_VN } from '../athletes.microcopy';
import {
  ATHLETE_STATUSES,
  REASON_MAX_LENGTH,
  REASON_MIN_LENGTH,
  REASON_REQUIRED_STATUSES,
  STATUS_TONES,
  type AthleteStatus,
} from '../athletes.constant';

interface ChangeStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentStatus: AthleteStatus;
  bibLabel: string;
  onConfirm: (next: AthleteStatus, reason: string) => Promise<void> | void;
}

export function ChangeStatusDialog(props: ChangeStatusDialogProps) {
  const { open, onOpenChange, currentStatus, bibLabel, onConfirm } = props;
  const [next, setNext] = useState<AthleteStatus>(currentStatus);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setNext(currentStatus);
      setReason('');
      setSubmitting(false);
    }
  }, [open, currentStatus]);

  const reasonRequired = REASON_REQUIRED_STATUSES.includes(next);
  const reasonValid =
    !reasonRequired || reason.trim().length >= REASON_MIN_LENGTH;
  const sameStatus = next === currentStatus;

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
          <DialogTitle>{ATHLETES_VN.changeStatusTitle}</DialogTitle>
          <DialogDescription>
            BIB <span className="font-mono font-semibold">{bibLabel}</span> · hiện
            tại{' '}
            <span className="font-semibold">{STATUS_TONES[currentStatus].label}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label>Trạng thái mới</Label>
            <Select
              value={next}
              onValueChange={(v) => setNext((v ?? currentStatus) as AthleteStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ATHLETE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_TONES[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="change-reason">
              {ATHLETES_VN.changeStatusReasonLabel}
              {reasonRequired && <span className="text-destructive"> *</span>}
              {reasonRequired && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  ({ATHLETES_VN.changeStatusReasonHelp(reason.trim().length, REASON_MIN_LENGTH)})
                </span>
              )}
            </Label>
            <Textarea
              id="change-reason"
              rows={3}
              maxLength={REASON_MAX_LENGTH}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={ATHLETES_VN.changeStatusReasonPlaceholder}
            />
            {reasonRequired && !reasonValid && (
              <p className="text-xs text-rose-700">
                {ATHLETES_VN.changeStatusReasonRequired}
              </p>
            )}
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
            onClick={handleConfirm}
            disabled={submitting || !reasonValid || sameStatus}
            data-testid="change-status-confirm"
          >
            {submitting ? 'Đang lưu...' : ATHLETES_VN.changeStatusConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ChangeStatusDialog;
