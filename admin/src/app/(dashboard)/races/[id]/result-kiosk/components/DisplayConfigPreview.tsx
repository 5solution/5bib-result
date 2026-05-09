'use client';

/**
 * F-017 — Live preview pane shown in DisplayConfigDialog right column.
 *
 * Renders KioskResultCard with sample athlete data + the in-progress
 * DisplayConfig so admin sees changes immediately.
 */

import { KioskResultCard } from './KioskResultCard';
import type { DisplayConfig } from '@/lib/kiosk/result-display-config';

const SAMPLE_DATA = {
  bib: '123',
  name: 'Nguyễn Văn Demo',
  raceId: 'sample',
  distance: '21K',
  category: 'Male 30-39',
  chipTime: '01:42:18',
  gunTime: '01:42:35',
  overallRank: '5',
  genderRank: '4',
  categoryRank: '2',
  timingPoint: 'FINISH',
  Chiptimes: JSON.stringify({ Start: '00:00', TM1: '24:29', Finish: '1:42:18' }),
  Paces: JSON.stringify({ Start: '', TM1: '4:53', Finish: '4:51' }),
  OverallRanks: JSON.stringify({ Start: '1', TM1: '5', Finish: '5' }),
} as const;

interface Props {
  config: DisplayConfig;
}

export function DisplayConfigPreview({ config }: Props) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4" data-testid="display-config-preview">
      <div className="mb-2 text-xs uppercase tracking-wide text-stone-500">Preview</div>
      <KioskResultCard data={SAMPLE_DATA} config={config} />
    </div>
  );
}
