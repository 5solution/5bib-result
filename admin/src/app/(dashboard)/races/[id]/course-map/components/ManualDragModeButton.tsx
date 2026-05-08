'use client';

/**
 * F-009 ManualDragModeButton — page-level toggle (replaces CourseMapTab dialog-internal toggle).
 *
 * Race Ops Expert decision (BR-CM2-06, PAUSE-CM2-04): drag = reversible edit,
 * NOT destructive → lightweight toast 3s, NOT 2-step typing modal. Explicit
 * divergence from F-008 v2 ResetConfirmModal pattern (which is destructive).
 *
 * Auto-snap (separate AutoSnapButton) IS destructive — it overrides manual
 * drag work — so it uses a MEDIUM confirm modal.
 */

import * as React from 'react';
import { toast } from 'sonner';
import { Hand, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface ManualDragModeButtonProps {
  enabled: boolean;
  onToggle: (next: boolean) => void;
  /** Disabled when no GPX uploaded (no markers to drag). */
  disabled?: boolean;
}

export function ManualDragModeButton({
  enabled,
  onToggle,
  disabled,
}: ManualDragModeButtonProps): React.ReactElement {
  const handleClick = React.useCallback(() => {
    const next = !enabled;
    onToggle(next);
    toast(next ? 'Drag mode bật' : 'Drag mode tắt', {
      duration: 3000,
      icon: next ? '✋' : '🛑',
      description: next
        ? 'Kéo marker checkpoint trên bản đồ. Tự động lưu khi thả.'
        : 'Markers trở về chế độ chỉ xem.',
    });
  }, [enabled, onToggle]);

  return (
    <Button
      type="button"
      variant={enabled ? 'default' : 'outline'}
      size="sm"
      onClick={handleClick}
      disabled={disabled}
      style={enabled ? { background: '#FF0E65', borderColor: '#FF0E65' } : undefined}
      title={
        disabled
          ? 'Cần upload GPX trước khi bật drag mode'
          : enabled
            ? 'Tắt drag mode (marker trở về chỉ xem)'
            : 'Bật drag mode (kéo marker để định vị thủ công)'
      }
      data-testid="manual-drag-mode-button"
    >
      <Hand className="mr-1.5 size-4" aria-hidden="true" />
      {enabled ? 'Tắt drag mode' : 'Bật drag mode'}
    </Button>
  );
}

/**
 * F-009 AutoSnapButton — re-snaps ALL checkpoints to nearest polyline vertex.
 *
 * MEDIUM-weight confirm modal (PAUSE-CM2-04 divergence rationale):
 * destructive in the sense that it OVERRIDES manual drag work, but reversible
 * (admin can drag back). NOT 2-step typing (F-008 v2 Reset is true data wipe).
 *
 * NOTE — server-side auto-snap endpoint is NOT yet shipped (would be F-XXX
 * extension). For F-009 scope this button shows the MODAL pattern + warning;
 * the actual mutation is delegated to the parent via `onConfirm` callback so
 * it can wire to any future endpoint without re-touching this component.
 */
export interface AutoSnapButtonProps {
  onConfirm: () => void | Promise<void>;
  /** Disabled when no GPX OR no checkpoints. */
  disabled?: boolean;
  /** Pending state from parent's mutation. */
  pending?: boolean;
}

export function AutoSnapButton({
  onConfirm,
  disabled,
  pending,
}: AutoSnapButtonProps): React.ReactElement {
  const [open, setOpen] = React.useState(false);

  const handleConfirm = React.useCallback(async () => {
    try {
      await onConfirm();
      setOpen(false);
    } catch {
      // parent handles its own error toast
    }
  }, [onConfirm]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={disabled || pending}
        title={
          disabled
            ? 'Cần upload GPX + có checkpoints trước khi auto-snap'
            : 'Auto-snap tất cả checkpoints về vị trí gần polyline nhất'
        }
        data-testid="auto-snap-button"
      >
        <RotateCcw className="mr-1.5 size-4" aria-hidden="true" />
        Khôi phục tự động
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Khôi phục vị trí tự động?</DialogTitle>
            <DialogDescription>
              Tất cả checkpoints sẽ được snap về vertex gần nhất trên polyline GPX.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold">⚠ Sẽ ghi đè drag thủ công</p>
            <p className="mt-1 text-xs">
              Nếu bạn đã kéo thả checkpoint vào vị trí thực tế (cổng aid station,
              ngã rẽ thực địa), auto-snap sẽ kéo về polyline. Có thể kéo lại
              thủ công sau.
            </p>
          </div>
          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Hủy
            </Button>
            <Button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={pending}
              style={{ background: '#FF0E65', borderColor: '#FF0E65' }}
            >
              {pending ? 'Đang xử lý...' : 'Khôi phục'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
