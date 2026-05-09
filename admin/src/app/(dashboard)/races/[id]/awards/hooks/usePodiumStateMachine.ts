'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { transitionPodiumState } from '../awards-api';
import type { PodiumState } from '../awards.constant';

export function usePodiumStateMachine(raceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      podiumId: string;
      toState: PodiumState;
      note?: string;
      evidenceUrl?: string;
    }) =>
      transitionPodiumState(raceId, vars.podiumId, {
        toState: vars.toState,
        note: vars.note,
        evidenceUrl: vars.evidenceUrl,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['awards', 'podium', raceId] });
    },
  });
}
