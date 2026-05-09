'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { recompute } from '../awards-api';

export function useRecompute(raceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { courseId?: string }) => recompute(raceId, { courseId: vars.courseId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['awards', 'podium', raceId] });
      qc.invalidateQueries({ queryKey: ['awards', 'anomalies', raceId] });
      qc.invalidateQueries({ queryKey: ['awards', 'predicted-ranks', raceId] });
    },
  });
}
