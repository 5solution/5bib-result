'use client';

/**
 * F-013 BR-RK-03/04/05/08 — Result card for Surface 3 (5 status variants).
 *
 * BR-AF-23 verbatim port note: the JSON.parse split-time logic below is a
 * byte-for-byte copy of `parseSplitsFromData` from
 * `frontend/app/(main)/races/[slug]/[bib]/page.tsx` (lines 178-256). Drift
 * limited to the single import-fix mandate (admin SplitTime interface lives
 * in this scope-local file rather than the frontend's). Same exception
 * swallow, same Member/TODs/OverallRanks/GenderRanks fan-out.
 *
 * BR-RK-05 privacy guard: this component MUST NOT render `editHistory`,
 * `isManuallyEdited`, `dsqInternalNote`, or `_id` even if the upstream
 * payload accidentally carries them. We never index those keys explicitly —
 * we read only the public allowlist of fields.
 */

import { useMemo, useState } from 'react';
import { Award, Flag, Users, Trophy, AlertTriangle, Activity } from 'lucide-react';
import {
  deriveKioskStatus,
  type AthleteDetailData,
  type KioskResultStatus,
} from '../kiosk.types';
import { KIOSK_COPY } from '../kiosk.microcopy';

interface SplitTime {
  name: string;
  distance: string;
  time: string;
  pace: string;
  member?: string;
  timeOfDay?: string;
  overallRank?: string;
  genderRank?: string;
  rankDelta?: number;
}

/**
 * BR-AF-23 verbatim port from frontend `[bib]/page.tsx::parseSplitsFromData`.
 * Drift: drop `services` / `CheckpointConfig` (admin kiosk skips checkpoint
 * config for MVP). Logic identical otherwise.
 */
export function parseSplitsFromData(data: Record<string, unknown>): SplitTime[] | null {
  try {
    const chiptimesStr = data.Chiptimes as string;
    const pacesStr = data.Paces as string;
    if (!chiptimesStr) return null;

    const chiptimes: Record<string, string> = JSON.parse(chiptimesStr);
    const paces: Record<string, string> = pacesStr ? JSON.parse(pacesStr) : {};

    let members: Record<string, string> = {};
    let tods: Record<string, string> = {};
    let overallRanks: Record<string, string> = {};
    let genderRanks: Record<string, string> = {};
    const memberStr = data.Member as string | undefined;
    if (memberStr) {
      try {
        members = JSON.parse(memberStr);
      } catch {
        /* ignore */
      }
    }
    const todsStr = data.TODs as string | undefined;
    if (todsStr) {
      try {
        tods = JSON.parse(todsStr);
      } catch {
        /* ignore */
      }
    }
    const overallRanksStr = data.OverallRanks as string | undefined;
    if (overallRanksStr) {
      try {
        overallRanks = JSON.parse(overallRanksStr);
      } catch {
        /* ignore */
      }
    }
    const genderRanksStr = data.GenderRanks as string | undefined;
    if (genderRanksStr) {
      try {
        genderRanks = JSON.parse(genderRanksStr);
      } catch {
        /* ignore */
      }
    }

    const keys = Object.keys(chiptimes);
    if (keys.length === 0) return null;

    const splits: SplitTime[] = keys
      .filter((key) => chiptimes[key] !== '')
      .map((key) => {
        const name =
          key === 'Start' ? 'Xuất phát' : key === 'Finish' ? 'Về đích' : key;
        return {
          name,
          distance: '',
          time: chiptimes[key] || '-',
          pace: paces[key] || '-',
          member: members[key] || undefined,
          timeOfDay: tods[key] || undefined,
          overallRank: overallRanks[key] || undefined,
          genderRank: genderRanks[key] || undefined,
        };
      });

    for (let i = 1; i < splits.length; i++) {
      const curr = parseInt(splits[i].overallRank ?? '', 10);
      const prev = parseInt(splits[i - 1].overallRank ?? '', 10);
      if (curr > 0 && prev > 0) {
        splits[i].rankDelta = prev - curr;
      }
    }

    return splits.length > 0 ? splits : null;
  } catch {
    return null;
  }
}

import type { DisplayConfig } from '@/lib/kiosk/result-display-config';
import { HeroRank } from './configurable-sections/HeroRank';
import { HeroFinishTime } from './configurable-sections/HeroFinishTime';
import { HeroPhoto } from './configurable-sections/HeroPhoto';
import { SponsorBanner } from './configurable-sections/SponsorBanner';
import { CustomMessageSection } from './configurable-sections/CustomMessageSection';
import { QrShareSection } from './configurable-sections/QrShareSection';

interface KioskResultCardProps {
  data: AthleteDetailData;
  /** Optional override (test injection). Default: derive from data via deriveKioskStatus. */
  status?: KioskResultStatus;
  /**
   * F-017 — admin-configurable display config. When omitted, falls back to
   * F-013 legacy render (preserves backward compat for any non-config caller).
   */
  config?: DisplayConfig;
}

const STATUS_STYLES: Record<KioskResultStatus, { label: string; bg: string; border: string; text: string; Icon: typeof Award }> = {
  FIN: {
    label: KIOSK_COPY.result.badge.FIN,
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    text: 'text-emerald-700',
    Icon: Award,
  },
  DNS: {
    label: KIOSK_COPY.result.badge.DNS,
    bg: 'bg-stone-100',
    border: 'border-stone-300',
    text: 'text-stone-600',
    Icon: Flag,
  },
  DNF: {
    label: KIOSK_COPY.result.badge.DNF,
    bg: 'bg-orange-50',
    border: 'border-orange-300',
    text: 'text-orange-700',
    Icon: AlertTriangle,
  },
  DSQ: {
    label: KIOSK_COPY.result.badge.DSQ,
    bg: 'bg-rose-50',
    border: 'border-rose-300',
    text: 'text-rose-700',
    Icon: AlertTriangle,
  },
  LIVE: {
    label: KIOSK_COPY.result.badge.LIVE,
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    text: 'text-blue-700',
    Icon: Activity,
  },
};

export function KioskResultCard({ data, status: statusOverride, config }: KioskResultCardProps) {
  const status = statusOverride ?? deriveKioskStatus(data) ?? 'FIN';
  const cfg = STATUS_STYLES[status];
  const [splitsOpen, setSplitsOpen] = useState(false);

  // F-017 — config-driven render path. When config provided, use visibleSections
  // + heroChoice + themeColor to compose the card. Falls back to F-013 layout
  // when caller omits config (backward compat).
  if (config) {
    const themeColor = config.themeColor;
    const Hero =
      config.heroChoice === 'finish-time'
        ? HeroFinishTime
        : config.heroChoice === 'photo'
          ? HeroPhoto
          : HeroRank;
    const v = config.visibleSections;
    return (
      <div
        className={`rounded-3xl border-2 p-6 sm:p-8 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-reduce:animate-none`}
        style={{ borderColor: themeColor, backgroundColor: themeColor + '08' }}
        data-testid="kiosk-result-card"
        data-status={status}
        data-config-driven="true"
      >
        <div className="space-y-6">
          {(v.rank || v.finishTime || v.photo) && <Hero data={data} themeColor={themeColor} />}
          <div className="text-center">
            <div className="font-mono text-4xl font-bold tabular-nums text-stone-900">
              {data.bib != null ? String(data.bib) : '—'}
            </div>
            <div className="mt-1 text-xl font-bold text-stone-800">{data.name || '—'}</div>
          </div>
          {v.splits && status !== 'DNS' && (() => {
            const splits = parseSplitsFromData(data as unknown as Record<string, unknown>);
            if (!splits || splits.length === 0) return null;
            return (
              <div className="rounded-xl border border-stone-200 bg-white p-4" data-testid="kiosk-splits-list">
                <ul className="divide-y divide-stone-100 text-sm">
                  {splits.map((s, i) => (
                    <li key={`${s.name}-${i}`} className="flex items-center justify-between px-2 py-2">
                      <span className="font-medium text-stone-700">{s.name}</span>
                      <span className="font-mono tabular-nums">{s.time}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}
          {v.customMessage && (
            <CustomMessageSection message={config.customMessage} themeColor={themeColor} />
          )}
          {v.sponsorBanner && config.sponsorLogos.length > 0 && (
            <SponsorBanner logos={config.sponsorLogos} />
          )}
          {v.qrShare && (
            <QrShareSection bib={data.bib} raceId={data.raceId} themeColor={themeColor} />
          )}
        </div>
      </div>
    );
  }

  const splits = useMemo(
    () => parseSplitsFromData(data as unknown as Record<string, unknown>),
    [data],
  );
  const lastSplit = splits && splits.length > 0 ? splits[splits.length - 1] : null;

  const showTimes = status === 'FIN' || status === 'LIVE';
  const showRanks = status === 'FIN';

  // Sanitize DSQ public reason (BR-RK-05) — strip HTML tags defensively.
  const dsqReason =
    status === 'DSQ' && typeof data.dsqReason === 'string'
      ? data.dsqReason.replace(/<[^>]*>/g, '').trim()
      : null;

  const bibDisplay = data.bib != null ? String(data.bib) : '—';
  const name = (data.name && data.name.trim()) || '—';
  const courseLine = [data.distance, data.category].filter(Boolean).join(' · ');

  const ariaLine = KIOSK_COPY.result.ariaResult(
    name,
    data.chipTime || '—',
    data.overallRank || '—',
  );

  return (
    <div
      className={`rounded-3xl border-2 ${cfg.border} ${cfg.bg} p-6 sm:p-8 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-reduce:animate-none`}
      data-testid="kiosk-result-card"
      data-status={status}
    >
      <div aria-live="polite" className="sr-only" data-testid="kiosk-result-aria">
        {ariaLine}
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-mono text-6xl font-bold tabular-nums text-stone-900" data-testid="kiosk-bib-display">
            {bibDisplay}
          </div>
          <div className="mt-2 text-3xl font-bold text-stone-800" data-testid="kiosk-result-name">
            {name}
          </div>
          {courseLine && (
            <div className="mt-1 text-base text-stone-600">{courseLine}</div>
          )}
          {data.nationality && (
            <div className="mt-1 text-sm text-stone-500">{data.nationality}</div>
          )}
        </div>
        <div
          className={`flex items-center gap-2 rounded-full border ${cfg.border} ${cfg.text} bg-white px-4 py-2 text-sm font-bold`}
          data-testid="kiosk-status-badge"
          data-badge-status={status}
        >
          <cfg.Icon className="h-4 w-4" aria-hidden />
          {cfg.label}
        </div>
      </div>

      {showTimes && (
        <div className="mt-6 grid grid-cols-2 gap-4" data-testid="kiosk-times-row">
          <div>
            <div className="text-xs uppercase tracking-wide text-stone-500">
              {KIOSK_COPY.result.chipTimeLabel}
            </div>
            <div className="font-mono text-5xl font-bold tabular-nums text-stone-900" data-testid="kiosk-chip-time">
              {data.chipTime || '—'}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-stone-500">
              {KIOSK_COPY.result.gunTimeLabel}
            </div>
            <div className="font-mono text-3xl font-bold tabular-nums text-stone-700" data-testid="kiosk-gun-time">
              {data.gunTime || '—'}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-3 gap-3 text-center" data-testid="kiosk-ranks-row">
        <div className="rounded-xl border border-stone-200 bg-white p-3">
          <Trophy className="mx-auto h-4 w-4 text-stone-400" aria-hidden />
          <div className="mt-1 text-xs text-stone-500">{KIOSK_COPY.result.overallRankLabel}</div>
          <div className="font-mono text-2xl font-bold" data-testid="kiosk-overall-rank">
            {showRanks ? data.overallRank || KIOSK_COPY.result.rankPlaceholder : KIOSK_COPY.result.rankPlaceholder}
          </div>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-3">
          <Users className="mx-auto h-4 w-4 text-stone-400" aria-hidden />
          <div className="mt-1 text-xs text-stone-500">{KIOSK_COPY.result.genderRankLabel}</div>
          <div className="font-mono text-2xl font-bold">
            {showRanks ? data.genderRank || KIOSK_COPY.result.rankPlaceholder : KIOSK_COPY.result.rankPlaceholder}
          </div>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-3">
          <Award className="mx-auto h-4 w-4 text-stone-400" aria-hidden />
          <div className="mt-1 text-xs text-stone-500">{KIOSK_COPY.result.catRankLabel}</div>
          <div className="font-mono text-2xl font-bold">
            {showRanks ? data.categoryRank || KIOSK_COPY.result.rankPlaceholder : KIOSK_COPY.result.rankPlaceholder}
          </div>
        </div>
      </div>

      {/* DNF: last CP + last split time */}
      {status === 'DNF' && lastSplit && (
        <div className="mt-6 rounded-xl border border-orange-200 bg-white p-4" data-testid="kiosk-dnf-lastcp">
          <div className="text-xs uppercase tracking-wide text-orange-600">{KIOSK_COPY.result.lastCpLabel}</div>
          <div className="mt-1 font-mono text-lg font-bold">
            {lastSplit.name} — {lastSplit.time}
          </div>
        </div>
      )}

      {/* LIVE partial label */}
      {status === 'LIVE' && (
        <div className="mt-6 rounded-xl border border-blue-200 bg-white p-4 text-center text-sm font-medium text-blue-700" data-testid="kiosk-live-partial">
          {KIOSK_COPY.result.livePartial}
        </div>
      )}

      {/* DSQ public reason ONLY (BR-RK-05) */}
      {status === 'DSQ' && dsqReason && (
        <div className="mt-6 rounded-xl border border-rose-200 bg-white p-4" data-testid="kiosk-dsq-reason">
          <div className="text-xs uppercase tracking-wide text-rose-600">{KIOSK_COPY.result.dsqReasonLabel}</div>
          <div className="mt-1 text-sm text-stone-800">{dsqReason}</div>
        </div>
      )}

      {/* Splits collapsible — DNS hides entirely */}
      {status !== 'DNS' && splits && splits.length > 0 && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setSplitsOpen((v) => !v)}
            className="text-sm font-bold text-stone-700 underline-offset-4 hover:underline"
            data-testid="kiosk-splits-toggle"
          >
            {splitsOpen ? KIOSK_COPY.result.splitsToggleHide : KIOSK_COPY.result.splitsToggleShow}
          </button>
          {splitsOpen && (
            <ul className="mt-3 divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white text-sm" data-testid="kiosk-splits-list">
              {splits.map((s, i) => (
                <li key={`${s.name}-${i}`} className="flex items-center justify-between px-4 py-2">
                  <span className="font-medium text-stone-700">{s.name}</span>
                  <span className="font-mono tabular-nums">{s.time}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
