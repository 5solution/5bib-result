'use client';
/**
 * F-020 BR-AG-49 — Render NỔI BẬT trên mỗi PodiumCard (cả AG và OVERALL),
 * KHÔNG còn chôn sau "Mở rộng".
 *
 * Bao gồm:
 *  - StateMachineProgressDots (visualizer 8 dot 9-state forward-only).
 *  - Nút action chính cho transition kế tiếp.
 *  - StateTransitionConfirmModal khi user click — xác nhận đơn giản 1 bước
 *    (BR-AG-48: KHÔNG yêu cầu gõ tên podium).
 *  - Toast / inline error khi mutation fail (409 conflict — BR-AG-23 forward-only
 *    + concurrent transition).
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ALLOWED_TRANSITIONS, type PodiumState } from '../awards.constant';
import { usePodiumStateMachine } from '../hooks/usePodiumStateMachine';
import { VN } from '../awards.microcopy';
import type { PodiumStateTransition } from '../awards.types';
import { StateMachineProgressDots } from './StateMachineProgressDots';
import { StateTransitionConfirmModal } from './StateTransitionConfirmModal';

interface Props {
  raceId: string;
  podiumId: string;
  fromState: PodiumState;
  /** State history để render lại progress dots với timestamp. */
  stateHistory?: PodiumStateTransition[];
  /** Khi set, lock button bị disable + hiển thị tooltip (BR-AG-24/25). */
  blockingMessage?: string;
  /** F-020 — render compact (chỉ progress dots + 1 nút primary) hay full (mọi nút allowed). */
  compact?: boolean;
}

export function PodiumStateMachineControls({
  raceId,
  podiumId,
  fromState,
  stateHistory,
  blockingMessage,
  compact = false,
}: Props) {
  const mutation = usePodiumStateMachine(raceId);
  const [pendingTarget, setPendingTarget] = useState<PodiumState | null>(null);
  const allowed = ALLOWED_TRANSITIONS[fromState] ?? [];

  const handleConfirm = (note?: string) => {
    if (!pendingTarget) return;
    mutation.mutate(
      {
        podiumId,
        toState: pendingTarget,
        note: note && note.length >= 5 ? note : undefined,
      },
      {
        onSettled: () => {
          setPendingTarget(null);
        },
      },
    );
  };

  const buttonsToRender = compact ? allowed.slice(0, 1) : allowed;

  return (
    <div className="space-y-2">
      <StateMachineProgressDots
        currentState={fromState}
        stateHistory={stateHistory ?? []}
      />

      {allowed.length === 0 ? (
        <div className="text-xs text-stone-500">
          Trạng thái terminal — không còn transition.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {buttonsToRender.map((to) => {
            const disabled = !!blockingMessage || mutation.isPending;
            return (
              <Button
                key={to}
                size="sm"
                variant={to === 'PODIUM_LOCKED' ? 'default' : 'outline'}
                disabled={disabled}
                title={blockingMessage}
                onClick={() => setPendingTarget(to)}
              >
                {to === 'PODIUM_LOCKED'
                  ? VN.LOCK_BUTTON
                  : to === 'PODIUM_PUBLISHED'
                    ? VN.PUBLISH_BUTTON
                    : to === 'DISPUTE_OPEN'
                      ? VN.OPEN_DISPUTE_BUTTON
                      : VN.STATE_LABELS[to]}
              </Button>
            );
          })}
        </div>
      )}

      {mutation.error && (
        <div className="text-xs text-red-700">
          {(mutation.error as Error).message}
        </div>
      )}

      {pendingTarget && (
        <StateTransitionConfirmModal
          fromState={fromState}
          toState={pendingTarget}
          isPending={mutation.isPending}
          onCancel={() => setPendingTarget(null)}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}
