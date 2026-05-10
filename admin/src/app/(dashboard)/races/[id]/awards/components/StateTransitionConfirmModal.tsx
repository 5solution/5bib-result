'use client';
/**
 * F-020 BR-AG-48 — Modal xác nhận chuyển trạng thái đơn giản 1 bước.
 *
 * KHÔNG yêu cầu gõ tên podium (khác F-008v2 ResetConfirmModal). Lý do:
 * `PODIUM_PUBLISHED` là cờ trạng thái nội bộ admin (BR-AG-47), KHÔNG tự đẩy
 * ra public website. Hậu quả mất kiểm soát thấp → 2-step typing là overkill.
 *
 * Body content thay đổi theo target state qua `VN.TRANSITION_WARN_BY_TARGET`.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { PodiumState } from '../awards.constant';
import { VN } from '../awards.microcopy';

interface Props {
  fromState: PodiumState;
  toState: PodiumState;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: (note?: string) => void;
}

export function StateTransitionConfirmModal({
  fromState,
  toState,
  isPending,
  onCancel,
  onConfirm,
}: Props) {
  const [note, setNote] = useState('');
  const warning = VN.TRANSITION_WARN_BY_TARGET[toState];

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="state-transition-confirm-title"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h3
          id="state-transition-confirm-title"
          className="text-base font-semibold text-stone-900"
        >
          {VN.TRANSITION_CONFIRM_TITLE}
        </h3>
        <p className="mt-2 text-sm text-stone-700">
          {VN.TRANSITION_CONFIRM_BODY(fromState, toState)}
        </p>
        {warning && (
          <p className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
            ⚠ {warning}
          </p>
        )}
        <label className="mt-3 block text-xs text-stone-700">
          {VN.TRANSITION_CONFIRM_NOTE}
          <input
            type="text"
            className="mt-1 w-full rounded border border-stone-300 px-2 py-1 text-sm"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={isPending}
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
          >
            {VN.TRANSITION_CONFIRM_CANCEL}
          </Button>
          <Button
            size="sm"
            variant={toState === 'PODIUM_LOCKED' ? 'default' : 'default'}
            onClick={() => onConfirm(note)}
            disabled={isPending}
          >
            {isPending ? '...' : VN.TRANSITION_CONFIRM_OK}
          </Button>
        </div>
      </div>
    </div>
  );
}
