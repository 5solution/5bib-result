'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfidenceScore } from './ConfidenceScore';
import {
  useAckAnomaly,
  useResolveAnomaly,
} from '../hooks/useAnomalyWarnings';
import type { AnomalyWarning } from '../awards.types';
import { VN } from '../awards.microcopy';

const TIER_BG: Record<number, string> = {
  1: 'border-red-300 bg-red-50',
  2: 'border-amber-300 bg-amber-50',
  3: 'border-stone-200 bg-stone-50',
};

export function AnomalyWarningRow({
  warning,
  raceId,
}: {
  warning: AnomalyWarning;
  raceId: string;
}) {
  const ackMut = useAckAnomaly(raceId);
  const resolveMut = useResolveAnomaly(raceId);
  const [note, setNote] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [resolution, setResolution] = useState<'ignored' | 'fixed' | 'btc_override'>('fixed');

  const isAcked = !!warning.ackedAt;
  const isResolved = warning.resolution !== 'pending';

  return (
    <div className={`rounded-md border ${TIER_BG[warning.tier]} p-3 text-sm`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">Pattern {warning.pattern}</Badge>
        <span className="font-mono text-xs">BIB {warning.bib}</span>
        <span>{warning.athleteName ?? '?'}</span>
        <span className="ml-auto text-xs text-stone-600">
          tier <ConfidenceScore value={warning.confidence} />
        </span>
      </div>
      <div className="mt-1 text-xs text-stone-600">
        {VN.PATTERN_LABELS[warning.pattern]} — {VN.RESOLUTION_LABELS_FULL[warning.resolution]}
      </div>
      {!isResolved && (
        <div className="mt-3 flex flex-col gap-2">
          <input
            type="text"
            placeholder={VN.ACK_NOTE_LABEL}
            className="w-full rounded border border-stone-300 px-2 py-1 text-xs"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <input
            type="text"
            placeholder={VN.ACK_EVIDENCE_LABEL}
            className="w-full rounded border border-stone-300 px-2 py-1 text-xs"
            value={evidenceUrl}
            onChange={(e) => setEvidenceUrl(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {!isAcked && warning.tier === 2 && (
              <Button
                size="sm"
                variant="outline"
                disabled={note.length < 5 || ackMut.isPending}
                onClick={() =>
                  ackMut.mutate({
                    warningId: warning.id,
                    note,
                    evidenceUrl: evidenceUrl || undefined,
                  })
                }
              >
                {VN.ACK_BUTTON}
              </Button>
            )}
            <select
              className="rounded border border-stone-300 px-2 py-1 text-xs"
              value={resolution}
              onChange={(e) =>
                setResolution(e.target.value as 'ignored' | 'fixed' | 'btc_override')
              }
            >
              {(['fixed', 'ignored', 'btc_override'] as const).map((r) => (
                <option key={r} value={r}>
                  {VN.RESOLUTION_OPTIONS[r]}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              disabled={note.length < 5 || resolveMut.isPending}
              onClick={() =>
                resolveMut.mutate({
                  warningId: warning.id,
                  resolution,
                  note,
                  evidenceUrl: evidenceUrl || undefined,
                })
              }
            >
              {VN.RESOLVE_BUTTON}
            </Button>
          </div>
        </div>
      )}
      {isResolved && warning.resolutionNote && (
        <div className="mt-2 rounded bg-white/60 px-2 py-1 text-xs text-stone-700">
          {warning.resolutionNote}
        </div>
      )}
    </div>
  );
}
