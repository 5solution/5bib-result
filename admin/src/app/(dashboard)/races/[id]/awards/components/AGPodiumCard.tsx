'use client';
/**
 * F-020 BR-AG-49 — Refactor: `PodiumStateMachineControls` render NỔI BẬT
 * trên card collapsed, KHÔNG còn chôn sau "Mở rộng". Khối expanded chỉ giữ
 * lại note input + history timeline + chi tiết athletes (cột Tuổi).
 *
 * Logic data + props giữ nguyên — KHÔNG breaking với AGPodiumGrid caller.
 */
import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StateBadge } from './StateBadge';
import { PodiumStateMachineControls } from './PodiumStateMachineControls';
import { StateMachineTimeline } from './StateMachineTimeline';
import { PodiumPdfExportButton } from './PodiumPdfExportButton';
import type { PodiumResponse } from '../awards.types';
import { VN } from '../awards.microcopy';

interface Props {
  podium: PodiumResponse;
  raceId: string;
  /** From banner blockingCount; if > 0 lock disabled. */
  blockingMessage?: string;
}

export function AGPodiumCard({ podium, raceId, blockingMessage }: Props) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="border-stone-200">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <span>{podium.ageGroupLabel}</span>
          <Badge variant="outline">{podium.courseName}</Badge>
          <StateBadge state={podium.state} />
          {podium.compoundingMode === 'mutually_exclusive' && (
            <Badge
              variant="outline"
              className="border-violet-300 bg-violet-50 text-violet-800"
            >
              {VN.COMPOUNDING_BADGE}
            </Badge>
          )}
          <button
            type="button"
            className="ml-auto text-xs text-stone-600 underline"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Thu gọn' : 'Mở rộng'}
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {podium.athletes.length === 0 ? (
          <div className="text-sm text-stone-500">
            Chưa có athlete trong AG này.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 text-left text-xs uppercase text-stone-500">
              <tr>
                <th className="px-2 py-1">#</th>
                <th className="px-2 py-1">BIB</th>
                <th className="px-2 py-1">Tên</th>
                <th className="px-2 py-1">Chip time</th>
                {expanded && <th className="px-2 py-1">Tuổi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {podium.athletes.map((a) => (
                <tr
                  key={a.bib}
                  className={a.rank <= 3 ? 'bg-amber-50 font-semibold' : ''}
                >
                  <td className="px-2 py-1 font-bold">
                    {a.rank === 1
                      ? '1st'
                      : a.rank === 2
                        ? '2nd'
                        : a.rank === 3
                          ? '3rd'
                          : `#${a.rank}`}
                    {a.tied && ' *'}
                  </td>
                  <td className="px-2 py-1 font-mono">{a.bib}</td>
                  <td className="px-2 py-1">{a.name}</td>
                  <td className="px-2 py-1 font-mono">
                    {a.chipTime ?? (a.chipTimeMs ? formatMs(a.chipTimeMs) : '—')}
                  </td>
                  {expanded && (
                    <td className="px-2 py-1">{a.ageOnRaceDay ?? '—'}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* F-020 BR-AG-49 — Controls render NỔI BẬT trên card, NGOÀI expanded. */}
        <div className="rounded border border-stone-200 bg-stone-50 p-2">
          <div className="mb-1 text-xs font-semibold text-stone-700">
            Hành động BTC
          </div>
          <PodiumStateMachineControls
            raceId={raceId}
            podiumId={podium.id}
            fromState={podium.state}
            stateHistory={podium.stateHistory}
            blockingMessage={blockingMessage}
          />
          <div className="mt-2">
            <PodiumPdfExportButton raceId={raceId} podiumId={podium.id} />
          </div>
        </div>

        {expanded && (
          <div>
            <div className="mb-1 text-xs font-semibold text-stone-700">
              Lịch sử trạng thái
            </div>
            <StateMachineTimeline history={podium.stateHistory} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
