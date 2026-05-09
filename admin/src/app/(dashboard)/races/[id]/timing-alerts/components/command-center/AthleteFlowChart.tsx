'use client';

/**
 * FEATURE-005 — Athlete Flow Chart component (Command Center).
 *
 * Per design canvas Artboard 3 (race-ops-command.jsx FlowChart):
 * - Dual-bar overlay: ghost dashed (expected) + filled gradient (actual)
 * - Health colors: good ≥90% (green), warn 70-90% (amber), fail <70% (red)
 * - Pct-of-expected label + status badge (OK/ATT/CRIT)
 * - Pill course tabs (Tab primitive style)
 */

import { useState } from 'react';
import type { CheckpointProgression } from '@/lib/timing-alert-api';
import { vnHealthLabel } from '@/lib/vn-microcopy';

// F-011 BR-PB-03 — race status type aligned with backend Race schema.
// Optional prop: backward-compat default `undefined` → existing behavior preserved.
type RaceStatus = 'draft' | 'pre_race' | 'live' | 'ended';

interface AthleteFlowChartProps {
  progression: CheckpointProgression[];
  /** F-011 BR-PB-03 — optional race status. When 'draft' | 'pre_race', component
   *  short-circuits to a neutral "race chưa khởi động" card instead of rendering
   *  health badges (which would mislead BTC about timing devices). */
  raceStatus?: RaceStatus;
}

export function AthleteFlowChart({
  progression,
  raceStatus,
}: AthleteFlowChartProps) {
  const [activeCourseId, setActiveCourseId] = useState<string>(
    progression[0]?.courseId ?? '',
  );

  // F-011 BR-PB-04 — pre-race status guard ABOVE existing empty-state ladder.
  // Backend health calc (lines below) is technically correct (0/N = fail) but
  // pre-race UI must NOT show "KIỂM TRA THIẾT BỊ" badge (BTC misreads as device fail).
  // Render single neutral grey card instead of FlowRows.
  if (raceStatus === 'draft' || raceStatus === 'pre_race') {
    return (
      <CardShell>
        <div
          className="flex items-center gap-3 px-4 py-6 text-sm text-stone-600"
          style={{
            background: 'var(--5s-surface)',
            borderTop: '1px solid var(--5s-border)',
          }}
        >
          <span aria-hidden className="text-lg">
            ⏱
          </span>
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-stone-700">
              Race chưa khởi động
            </span>
            <span className="text-xs text-stone-500">— chờ start gun —</span>
          </div>
        </div>
      </CardShell>
    );
  }

  if (progression.length === 0) {
    return (
      <CardShell>
        <div className="p-4 text-sm text-stone-600">
          Chưa có course nào có checkpoints config — chưa render được chart flow.
        </div>
      </CardShell>
    );
  }

  const active =
    progression.find((p) => p.courseId === activeCourseId) ?? progression[0];

  return (
    <CardShell>
      {/* Course pill tabs */}
      <div
        className="flex items-center gap-3 border-b px-4 py-3"
        style={{ borderColor: 'var(--5s-border)' }}
      >
        <h3
          className="text-[15px] font-extrabold tracking-tight"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Athlete Flow Monitor
        </h3>
        <div
          className="ml-auto flex items-center gap-1 rounded-full p-[3px]"
          style={{ background: 'var(--5s-surface)' }}
        >
          {progression.map((p) => (
            <PillTab
              key={p.courseId}
              active={p.courseId === active.courseId}
              onClick={() => setActiveCourseId(p.courseId)}
            >
              {p.courseName}
            </PillTab>
          ))}
        </div>
      </div>

      <div className="p-4">
        {active.points.length === 0 ? (
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            ⚠ Course chưa config checkpoints. Mở tab Course settings để
            auto-derive.
          </div>
        ) : active.startedCount === 0 ? (
          <div
            className="rounded border bg-stone-50 p-3 text-sm text-stone-600"
            style={{ borderColor: 'var(--5s-border)' }}
          >
            ⏳ Chưa có athlete nào qua điểm nào.
          </div>
        ) : (
          <FlowRows points={active.points} startedCount={active.startedCount} />
        )}
      </div>
    </CardShell>
  );
}

function FlowRows({
  points,
  startedCount,
}: {
  points: CheckpointProgression['points'];
  startedCount: number;
}) {
  const max = Math.max(
    ...points.map((p) => Math.max(p.passedCount, p.expectedCount)),
    1,
  );
  const colors = {
    good: '#16A34A',
    warn: '#F59E0B',
    fail: '#DC2626',
  };
  const health = (c: number, e: number): keyof typeof colors =>
    c >= e * 0.9 ? 'good' : c >= e * 0.7 ? 'warn' : 'fail';

  return (
    <div className="flex flex-col gap-3.5">
      {points.map((pt, idx) => {
        const h = health(pt.passedCount, pt.expectedCount);
        const actualPct = (pt.passedCount / max) * 100;
        const expPct = (pt.expectedCount / max) * 100;
        const pctOfExp =
          pt.expectedCount > 0
            ? (pt.passedCount / pt.expectedCount) * 100
            : 0;
        const color = colors[h];
        // F-007 Item #4 — VN microcopy: TỐT / CHÚ Ý / KIỂM TRA THIẾT BỊ.
        const badgeLabel = vnHealthLabel(h);

        return (
          <div
            key={pt.key}
            className="grid items-center gap-3"
            style={{ gridTemplateColumns: '130px 1fr 110px' }}
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-stone-900">
              <span
                className="w-5 text-[11px] text-stone-500"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {idx + 1}.
              </span>
              <span className="truncate" title={pt.name}>
                {pt.name}
              </span>
            </div>
            <div className="relative h-[30px]">
              {/* F-011 BR-PB-06 — ghost dashed track full-width fallback.
                  When expPct === 0 (edge live race), ghost still visible at 100%
                  as background reference so layout không "lẻ loi". */}
              <div
                className="absolute left-0 top-0 bottom-0 rounded-md border-[1.5px] border-dashed"
                style={{
                  width: expPct > 0 ? `${expPct}%` : '100%',
                  borderColor: `${color}40`,
                }}
                aria-hidden
              />
              {/* actual filled bar */}
              <div
                className="absolute left-0 top-0 bottom-0 flex items-center rounded-md pl-2.5"
                style={{
                  width: `${actualPct}%`,
                  background: `linear-gradient(90deg, ${color}30, ${color}80)`,
                  borderLeft: `3px solid ${color}`,
                }}
              >
                <span
                  className="text-xs font-bold text-[#0F172A]"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {pt.passedCount.toLocaleString('vi-VN')}
                </span>
              </div>
              {/* F-011 BR-PB-07 — expected label.
                  When expPct < 5 (edge boundary, e.g. live race with 0 expected),
                  pin label to RIGHT of track to avoid collision with actual count "0". */}
              <div
                className="absolute top-1/2 whitespace-nowrap text-[11px] text-stone-500"
                style={
                  expPct < 5
                    ? {
                        right: 0,
                        transform: 'translate(-4px, -50%)',
                        fontFamily: 'var(--font-mono)',
                      }
                    : {
                        left: `${expPct}%`,
                        transform: 'translate(8px, -50%)',
                        fontFamily: 'var(--font-mono)',
                      }
                }
              >
                ~{pt.expectedCount.toLocaleString('vi-VN')}
              </div>
            </div>
            {/* F-011 BR-PB-07 — right column vertical stacking (count top / pct middle / badge bottom).
                Eliminates overlap with `~{expectedCount}` label when expPct === 0. */}
            <div className="flex flex-col items-end justify-center gap-0.5 text-right">
              <div
                className="text-[13px] font-bold leading-none"
                style={{ fontFamily: 'var(--font-mono)', color }}
              >
                {pctOfExp.toFixed(1)}%
              </div>
              <span
                className="rounded-full px-1.5 py-[2px] text-[9px] font-extrabold uppercase tracking-wider"
                style={{
                  background: `${color}18`,
                  color,
                  letterSpacing: '.05em',
                }}
              >
                {badgeLabel}
              </span>
            </div>
          </div>
        );
      })}
      <div
        className="mt-2 flex flex-wrap items-center gap-4 border-t border-dashed pt-3 text-[11px] text-stone-500"
        style={{ borderColor: 'var(--5s-border)' }}
      >
        <Legend color="#16A34A" label="≥90% — TỐT" />
        <Legend color="#F59E0B" label="70–90% — CHÚ Ý" />
        <Legend color="#DC2626" label="<70% — KIỂM TRA THIẾT BỊ" />
        <span
          className="ml-auto"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Started: {startedCount.toLocaleString('vi-VN')}
        </span>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5 rounded"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

function PillTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center rounded-full px-3.5 text-[12px] font-bold transition-colors"
      style={{
        height: 30,
        background: active ? '#0F172A' : 'transparent',
        color: active ? '#fff' : 'var(--5s-text-muted)',
        fontFamily: 'var(--font-display)',
      }}
    >
      {children}
    </button>
  );
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="overflow-hidden rounded-[14px] border bg-white"
      style={{
        borderColor: 'var(--5s-border)',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      {children}
    </section>
  );
}
