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

interface AthleteFlowChartProps {
  progression: CheckpointProgression[];
}

export function AthleteFlowChart({ progression }: AthleteFlowChartProps) {
  const [activeCourseId, setActiveCourseId] = useState<string>(
    progression[0]?.courseId ?? '',
  );

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
        const badgeLabel = h === 'good' ? 'OK' : h === 'warn' ? 'ATT' : 'CRIT';

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
              {/* expected ghost bar */}
              <div
                className="absolute left-0 top-0 bottom-0 rounded-md border-[1.5px] border-dashed"
                style={{
                  width: `${expPct}%`,
                  borderColor: `${color}40`,
                }}
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
              {/* expected label */}
              <div
                className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] text-stone-500"
                style={{
                  left: `${expPct}%`,
                  transform: 'translate(8px, -50%)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                ~{pt.expectedCount.toLocaleString('vi-VN')}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <div
                className="text-[13px] font-bold"
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
        <Legend color="#16A34A" label="≥90% — healthy" />
        <Legend color="#F59E0B" label="70–90% — attention" />
        <Legend color="#DC2626" label="<70% — possible equipment" />
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
