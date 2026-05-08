'use client';

/**
 * F-015 Surface 1 — admin shell tab body (kiosk OFF).
 *
 * Layout:
 *  - PageHero
 *  - Settings card: station picker + sound toggle + window display + "Bật chế
 *    độ Kiosk" CTA (mirror F-013 KioskTabBody)
 *  - Stats card: pickup rate + per-station table + recent feed (SSE-driven)
 *  - Status-aware guard: race.status === 'draft' → empty state
 */

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import '@/lib/api';
import { authHeaders } from '@/lib/api';
import { racesControllerGetRaceById } from '@/lib/api-generated';
import { PageHero } from '@/components/race-ops-shell/PageHero';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useCheckInContext } from './CheckInModeProvider';
import { StationPickerDropdown } from './StationPickerDropdown';
import { CHECKIN_COPY } from '../checkin.microcopy';
import type { CheckInStatsPayload } from '../checkin.types';

interface RaceMeta {
  _id?: string;
  id?: string;
  title: string;
  status: 'draft' | 'pre_race' | 'live' | 'ended';
  startDate?: string;
  checkInWindow?: { start?: string | null; end?: string | null } | null;
}

interface CheckInTabBodyProps {
  raceId: string;
  stats: CheckInStatsPayload | null;
  connected: boolean;
  fallbackPolling: boolean;
}

function fmt(d?: string | null): string | null {
  if (!d) return null;
  try {
    const dd = new Date(d);
    if (Number.isNaN(dd.getTime())) return null;
    return dd.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
}

function formatTimeAgo(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const t = new Date(iso).getTime();
    const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (sec < 60) return `${sec}s trước`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m trước`;
    const h = Math.floor(min / 60);
    return `${h}h trước`;
  } catch {
    return '—';
  }
}

export function CheckInTabBody({ raceId, stats, connected, fallbackPolling }: CheckInTabBodyProps) {
  const { token } = useAuth();
  const ctx = useCheckInContext();
  const [race, setRace] = useState<RaceMeta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!token || !raceId) return;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await racesControllerGetRaceById({
          path: { id: raceId },
          ...authHeaders(token),
        });
        if (error) throw new Error('Race not found');
        const body = data as { data?: RaceMeta } | RaceMeta;
        const raceData = ((body as { data?: RaceMeta })?.data ?? (body as RaceMeta)) as RaceMeta;
        if (!cancelled) setRace(raceData);
      } catch {
        if (!cancelled) setRace(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, raceId]);

  const isDraft = race?.status === 'draft';
  const winStart = fmt(race?.checkInWindow?.start);
  const winEnd = fmt(race?.checkInWindow?.end);
  const totalAthletes = stats?.totalAthletes ?? 0;
  const pickedUp = stats?.pickedUp ?? 0;
  const pct = totalAthletes > 0 ? Math.min(100, Math.round((pickedUp / totalAthletes) * 100)) : 0;

  return (
    <div className="space-y-6" data-testid="check-in-tab-body">
      <PageHero
        eyebrow={CHECKIN_COPY.tab.eyebrow}
        title={CHECKIN_COPY.tab.title}
        meta={CHECKIN_COPY.tab.meta}
      />

      {loading ? (
        <Card><CardContent className="p-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
      ) : isDraft ? (
        <Card>
          <CardContent className="p-6 text-center" data-testid="check-in-draft-empty">
            <div className="text-lg font-bold text-stone-700">
              {CHECKIN_COPY.tab.draftEmpty}
            </div>
            <div className="mt-2 text-sm text-stone-500">{CHECKIN_COPY.tab.draftEmptyHint}</div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Settings card */}
          <Card>
            <CardContent className="space-y-4 p-6">
              <div>
                <h3 className="text-base font-bold text-stone-900">{CHECKIN_COPY.tab.settingsTitle}</h3>
                <p className="text-sm text-stone-600">{CHECKIN_COPY.tab.description}</p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StationPickerDropdown value={ctx.stationId} onChange={ctx.setStationId} />
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-stone-700">{CHECKIN_COPY.tab.soundLabel}</span>
                  <button
                    type="button"
                    onClick={ctx.toggleSound}
                    className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-900"
                    data-testid="settings-sound-toggle"
                  >
                    {ctx.soundEnabled ? CHECKIN_COPY.tab.soundOnText : CHECKIN_COPY.tab.soundOffText}
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-stone-700">{CHECKIN_COPY.tab.windowTitle}</span>
                  {winStart && winEnd ? (
                    <div className="rounded-md bg-stone-50 px-3 py-2 text-xs text-stone-700">
                      <div>{CHECKIN_COPY.tab.windowOpenLabel} {winStart}</div>
                      <div>{CHECKIN_COPY.tab.windowCloseLabel} {winEnd}</div>
                    </div>
                  ) : (
                    <span className="text-xs text-stone-500">{CHECKIN_COPY.tab.windowNotConfigured}</span>
                  )}
                </div>
              </div>
              <Button
                type="button"
                onClick={() => void ctx.enterKiosk()}
                className="bg-[#FF0E65] px-6 py-6 text-lg font-bold text-white hover:bg-[#FF0E65]/90"
                data-testid="check-in-enter-button"
              >
                <Sparkles className="mr-2 h-5 w-5" aria-hidden />
                {CHECKIN_COPY.tab.enterButton}
              </Button>
              <p className="text-xs text-stone-500">{CHECKIN_COPY.tab.enterHint}</p>
            </CardContent>
          </Card>

          {/* Stats card */}
          <Card>
            <CardContent className="space-y-4 p-6">
              <h3 className="text-base font-bold text-stone-900">{CHECKIN_COPY.tab.statsTitle}</h3>
              <div className="flex items-center gap-4">
                <div className="text-3xl font-bold tabular-nums text-stone-900">
                  {pickedUp.toLocaleString('vi-VN')} / {totalAthletes.toLocaleString('vi-VN')}
                </div>
                <div className="flex-1 overflow-hidden rounded-full bg-stone-100">
                  <div
                    className="h-2 rounded-full bg-[#FF0E65] transition-all"
                    style={{ width: `${pct}%` }}
                    data-testid="check-in-progress-bar"
                  />
                </div>
                <div className="text-sm font-bold text-stone-700">{pct}%</div>
              </div>
              <div className="text-xs text-stone-500">
                SSE: {connected ? 'connected' : fallbackPolling ? 'polling 30s' : 'disconnected'}
              </div>
            </CardContent>
          </Card>

          {/* Per-station table */}
          <Card>
            <CardContent className="p-6">
              <h3 className="mb-3 text-base font-bold text-stone-900">{CHECKIN_COPY.tab.stationsTableTitle}</h3>
              {stats && stats.perStation.length > 0 ? (
                <table className="w-full text-sm" data-testid="stations-table">
                  <thead>
                    <tr className="text-left text-xs uppercase text-stone-500">
                      <th className="pb-2">Station</th>
                      <th className="pb-2">Pickup</th>
                      <th className="pb-2">Last activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.perStation.map((s) => (
                      <tr key={s.stationId} className="border-t border-stone-100">
                        <td className="py-2 font-medium text-stone-900">Station {s.stationId}</td>
                        <td className="py-2 tabular-nums text-stone-700">{s.count.toLocaleString('vi-VN')}</td>
                        <td className="py-2 text-xs text-stone-500">{formatTimeAgo(s.lastActivityAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-stone-500">Chưa có station nào active.</p>
              )}
            </CardContent>
          </Card>

          {/* Recent feed */}
          <Card>
            <CardContent className="p-6">
              <h3 className="mb-3 text-base font-bold text-stone-900">{CHECKIN_COPY.tab.feedTitle}</h3>
              {stats && stats.recentEvents.length > 0 ? (
                <ul className="space-y-1.5 text-sm" data-testid="check-in-recent-feed">
                  {stats.recentEvents.map((e, i) => (
                    <li key={`${e.bib}-${i}`} className="text-stone-700">
                      {CHECKIN_COPY.tab.feedRow(
                        e.bib,
                        e.name ?? '—',
                        e.stationId,
                        formatTimeAgo(e.checkedInAt),
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-stone-500">{CHECKIN_COPY.tab.feedEmpty}</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
