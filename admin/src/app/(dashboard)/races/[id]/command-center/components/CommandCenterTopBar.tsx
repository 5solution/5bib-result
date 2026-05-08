'use client';

/**
 * F-008 — Command Center Top Bar.
 *
 * 4 elements per Canvas 03 + BR-CC-08/10/11:
 *   1. `Last sync 155s ago` — magenta khi >300s stale
 *   2. Poll dropdown `[60, 90, 120, 300]s` — persist localStorage `cc-poll-interval`
 *   3. Force Refresh button + 30s inline countdown (1Hz setInterval)
 *   4. Export CSV button (current course pill scope, BR-CC-11)
 *
 * VN microcopy 100% via `vnLabel()` per BR-CC-21.
 */

import { useEffect, useState } from 'react';
import { Download, RefreshCw, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { vnLabel } from '@/lib/vn-microcopy';
import { SoundToggleButton } from './SoundToggleButton';
import { CommandCenterFullscreenButton } from './CommandCenterFullscreenButton';
import { ResetConfirmModal } from './ResetConfirmModal';

interface CommandCenterTopBarProps {
  /** Seconds since last successful poll (snapshot.generatedAt). */
  elapsedSec: number;
  /** Current poll interval (seconds). */
  pollIntervalSec: number;
  /** User changed poll interval (seconds). */
  onPollIntervalChange: (sec: number) => void;
  /** Force Refresh trigger. */
  onForceRefresh: () => void;
  /** Force Refresh in-flight. */
  refreshing: boolean;
  /** 30s rate-limit countdown (>0 → button disabled). */
  retryAfterSec: number;
  /** Export CSV trigger. */
  onExportCSV: () => void;
  /** Export CSV in-flight (disable while generating). */
  exporting?: boolean;
  // ─── F-008 v2 EXTEND additive props ───
  /** F-008 v2 BR-CC2-14 — race meta needed for Reset 2-step modal. */
  raceMeta?: {
    raceId: string;
    raceTitle: string;
    raceSlug: string;
    raceStatus: 'draft' | 'pre_race' | 'live' | 'ended';
  };
  /** F-008 v2 — open Discovery dialog for given course (button only — handled by parent). */
  onOpenDiscovery?: () => void;
  /** F-008 v2 — show Discovery trigger (default true when raceMeta present). */
  showDiscoveryTrigger?: boolean;
}

const STALE_THRESHOLD_SEC = 300;

export function CommandCenterTopBar({
  elapsedSec,
  pollIntervalSec,
  onPollIntervalChange,
  onForceRefresh,
  refreshing,
  retryAfterSec,
  onExportCSV,
  exporting,
  raceMeta,
  onOpenDiscovery,
  showDiscoveryTrigger,
}: CommandCenterTopBarProps) {
  const stale = elapsedSec > STALE_THRESHOLD_SEC;
  const refreshDisabled = refreshing || retryAfterSec > 0;

  return (
    <header
      className="flex flex-wrap items-center justify-end gap-3 rounded-[14px] border bg-white px-4 py-3"
      style={{
        borderColor: 'var(--5s-border)',
        boxShadow: 'var(--shadow-xs)',
      }}
      data-testid="command-center-top-bar"
    >
      <span
        className="inline-flex items-center gap-2 text-xs"
        style={{
          color: stale ? 'var(--5s-magenta, #FF0E65)' : 'var(--5s-text-muted)',
          fontFamily: 'var(--font-mono)',
        }}
        data-testid="last-sync"
      >
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{
            background: stale
              ? 'var(--5s-magenta, #FF0E65)'
              : 'var(--5s-success, #16A34A)',
            animation: stale ? 'none' : 'ro-blink 2s infinite',
          }}
        />
        Last sync: {elapsedSec}s ago
      </span>

      <label
        className="inline-flex items-center gap-2 rounded-md border bg-white px-3 text-xs"
        style={{
          height: 34,
          borderColor: 'var(--5s-border)',
        }}
        data-testid="poll-dropdown-wrapper"
      >
        <span className="text-stone-500">Poll</span>
        <select
          value={pollIntervalSec}
          onChange={(e) => onPollIntervalChange(Number(e.target.value))}
          className="cursor-pointer border-none bg-transparent text-xs font-bold outline-none"
          style={{ fontFamily: 'var(--font-mono)' }}
          data-testid="poll-dropdown"
          aria-label="Poll interval"
        >
          <option value={60}>60s</option>
          <option value={90}>90s</option>
          <option value={120}>120s</option>
          <option value={300}>300s</option>
        </select>
      </label>

      <Button
        type="button"
        onClick={onForceRefresh}
        disabled={refreshDisabled}
        variant="outline"
        size="sm"
        className="h-9 gap-2"
        title={vnLabel('force-refresh')}
        data-testid="force-refresh-button"
      >
        <RefreshCw
          className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
        />
        {retryAfterSec > 0
          ? `Đợi ${retryAfterSec}s`
          : refreshing
            ? 'Đang cập nhật…'
            : vnLabel('force-refresh')}
      </Button>

      <Button
        type="button"
        onClick={onExportCSV}
        disabled={!!exporting}
        variant="outline"
        size="sm"
        className="h-9 gap-2"
        title={vnLabel('export-csv')}
        data-testid="export-csv-button"
      >
        <Download className="h-3.5 w-3.5" />
        {exporting ? 'Đang tạo…' : vnLabel('export-csv')}
      </Button>

      {/* F-008 v2 EXTEND — Sound + Fullscreen always shown */}
      <SoundToggleButton />
      <CommandCenterFullscreenButton />

      {/* F-008 v2 EXTEND — Discovery trigger (parent owns dialog state) */}
      {showDiscoveryTrigger && onOpenDiscovery && (
        <Button
          type="button"
          onClick={onOpenDiscovery}
          variant="outline"
          size="sm"
          className="h-9 gap-2"
          title="Auto-detect checkpoints from RR API"
          data-testid="discovery-trigger-button"
        >
          <Compass className="h-3.5 w-3.5" />
          <span>Discover CP</span>
        </Button>
      )}

      {/* F-008 v2 BR-CC2-14 — Reset 2-step modal trigger (race-day safety) */}
      {raceMeta && (
        <ResetConfirmModal
          raceId={raceMeta.raceId}
          raceTitle={raceMeta.raceTitle}
          raceSlug={raceMeta.raceSlug}
          raceStatus={raceMeta.raceStatus}
        />
      )}
    </header>
  );
}

/**
 * Helper: read persisted Poll interval from localStorage with default 90s.
 * Returns sec value (60/90/120/300). Hardened for SSR (returns default
 * during render trên server).
 */
export function usePersistedPollInterval(): [number, (sec: number) => void] {
  const [intervalSec, setIntervalSec] = useState<number>(90);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem('cc-poll-interval');
    if (!raw) return;
    const parsed = Number(raw);
    if ([60, 90, 120, 300].includes(parsed)) {
      setIntervalSec(parsed);
    }
  }, []);
  const update = (sec: number) => {
    setIntervalSec(sec);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('cc-poll-interval', String(sec));
    }
  };
  return [intervalSec, update];
}
