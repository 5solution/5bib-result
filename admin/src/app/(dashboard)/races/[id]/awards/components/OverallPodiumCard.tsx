'use client';
/**
 * F-020 BR-AG-41/42/49 — OverallPodiumCard.
 *
 * Render top 3 chung cuộc per cự ly với styling distinguishable (gold/silver/
 * bronze frame, magenta border `#FF0E65` brand 5Solution). State machine
 * controls render NỔI BẬT trên card, KHÔNG chôn sau "Mở rộng".
 *
 * Tái sử dụng:
 *  - `StateBadge` cho hiển thị state hiện tại.
 *  - `PodiumStateMachineControls` (đã refactor F-020) cho transition.
 *  - `PodiumPdfExportButton` cho xuất PDF (BR-AG-33).
 *  - `StateMachineTimeline` cho lịch sử audit (đặt trong khối expanded vì ít cần).
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StateBadge } from './StateBadge';
import { StateMachineTimeline } from './StateMachineTimeline';
import { PodiumStateMachineControls } from './PodiumStateMachineControls';
import { PodiumPdfExportButton } from './PodiumPdfExportButton';
import type { PodiumResponse } from '../awards.types';
import { VN } from '../awards.microcopy';

interface Props {
  podium: PodiumResponse;
  raceId: string;
  blockingMessage?: string;
}

export function OverallPodiumCard({ podium, raceId, blockingMessage }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="border-2 border-pink-500/70 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <span className="font-semibold text-pink-700">
            {VN.OVERALL_SECTION_TITLE} — {podium.courseName}
          </span>
          <Badge
            variant="outline"
            className="border-pink-300 bg-pink-50 text-pink-800"
          >
            {VN.OVERALL_BADGE_LABEL}
          </Badge>
          <StateBadge state={podium.state} />
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
          <div className="text-sm text-stone-500">{VN.OVERALL_EMPTY}</div>
        ) : (
          <ol className="space-y-1">
            {podium.athletes.slice(0, 3).map((a, idx) => (
              <li
                key={a.bib}
                className="flex items-center gap-3 rounded border border-amber-200 bg-amber-50 px-3 py-2"
              >
                <span className="w-24 shrink-0 text-sm font-semibold">
                  {VN.OVERALL_TOP_LABELS[idx] ?? `#${a.rank}`}
                </span>
                <span className="font-mono text-sm">{a.bib}</span>
                <span className="flex-1 truncate">{a.name}</span>
                <span className="font-mono text-sm">
                  {a.chipTime ?? (a.chipTimeMs ? formatMs(a.chipTimeMs) : '—')}
                </span>
              </li>
            ))}
          </ol>
        )}

        {/* F-020 BR-AG-49 — controls render NỔI BẬT, KHÔNG sau expanded. */}
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
