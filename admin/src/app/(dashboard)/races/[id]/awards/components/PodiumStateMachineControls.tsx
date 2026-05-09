'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ALLOWED_TRANSITIONS, type PodiumState } from '../awards.constant';
import { usePodiumStateMachine } from '../hooks/usePodiumStateMachine';
import { VN } from '../awards.microcopy';

export function PodiumStateMachineControls({
  raceId,
  podiumId,
  fromState,
  blockingMessage,
}: {
  raceId: string;
  podiumId: string;
  fromState: PodiumState;
  /** If set, lock button disabled with tooltip (BR-AG-24/25). */
  blockingMessage?: string;
}) {
  const mutation = usePodiumStateMachine(raceId);
  const [note, setNote] = useState('');
  const allowed = ALLOWED_TRANSITIONS[fromState] ?? [];

  if (allowed.length === 0) {
    return (
      <div className="text-xs text-stone-500">Trạng thái terminal — không còn transition.</div>
    );
  }

  return (
    <div className="space-y-2">
      <input
        type="text"
        placeholder={VN.TRANSITION_NOTE_LABEL}
        className="w-full rounded border border-stone-300 px-2 py-1 text-xs"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        {allowed.map((to) => {
          const disabled = !!blockingMessage || mutation.isPending;
          return (
            <Button
              key={to}
              size="sm"
              variant={to === 'PODIUM_LOCKED' ? 'default' : 'outline'}
              disabled={disabled}
              title={blockingMessage}
              onClick={() =>
                mutation.mutate({
                  podiumId,
                  toState: to,
                  note: note.length >= 5 ? note : undefined,
                })
              }
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
      {mutation.error && (
        <div className="text-xs text-red-700">{(mutation.error as Error).message}</div>
      )}
    </div>
  );
}
