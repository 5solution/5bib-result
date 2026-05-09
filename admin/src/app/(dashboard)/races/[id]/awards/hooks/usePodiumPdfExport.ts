'use client';
import { useMutation } from '@tanstack/react-query';
import { exportPodiumPdf } from '../awards-api';

export function usePodiumPdfExport(raceId: string) {
  return useMutation({
    mutationFn: (vars: {
      podiumId: string;
      includeWatermark?: boolean;
      includeSignatureLine?: boolean;
    }) =>
      exportPodiumPdf(raceId, vars.podiumId, {
        includeWatermark: vars.includeWatermark,
        includeSignatureLine: vars.includeSignatureLine,
      }),
  });
}
