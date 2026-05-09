'use client';

/**
 * F-018 BR-MI-15 — vertical state machine timeline (audit trail per transition).
 * Each node shows from/to + actor + role + timestamp + reason + GPS.
 * Read-only view; transitions issued via StateTransitionPicker.
 */
import { IncidentTransition } from '../medical.types';
import { STATE_VN } from '../medical.microcopy';

interface StateMachineTimelineProps {
  transitions: IncidentTransition[];
  currentTimeInState?: string;
  slaBreached?: boolean;
}

export function StateMachineTimeline({
  transitions,
  currentTimeInState,
  slaBreached,
}: StateMachineTimelineProps) {
  if (transitions.length === 0) {
    return (
      <p className="text-sm text-stone-500">Chưa có chuyển trạng thái</p>
    );
  }

  return (
    <ol className="relative space-y-4 border-l-2 border-stone-200 pl-6">
      {transitions.map((t, idx) => {
        const isLatest = idx === transitions.length - 1;
        return (
          <li key={`${t.at}-${idx}`} className="relative">
            <span
              aria-hidden
              className="absolute -left-[33px] top-1 size-4 rounded-full border-2 border-white bg-stone-400"
              style={isLatest ? { background: '#ea580c' } : undefined}
            />
            <p className="text-sm font-semibold text-stone-900">
              {t.from === 'INITIAL' ? '⊙' : STATE_VN[t.from as keyof typeof STATE_VN] ?? t.from}
              {' → '}
              {STATE_VN[t.to]}
            </p>
            <p className="text-xs text-stone-500">
              {new Date(t.at).toLocaleString('vi-VN')} — {t.actorRole}
            </p>
            {t.reason ? (
              <p className="mt-1 text-xs italic text-stone-600">
                Lý do: {t.reason}
              </p>
            ) : null}
            {t.gps ? (
              <p className="mt-0.5 text-[11px] font-mono text-stone-400">
                GPS {t.gps.lat.toFixed(5)}, {t.gps.lng.toFixed(5)}
              </p>
            ) : null}
          </li>
        );
      })}
      {currentTimeInState ? (
        <li className="relative">
          <span
            aria-hidden
            className="absolute -left-[33px] top-1 size-4 animate-pulse rounded-full border-2 border-white bg-orange-500"
          />
          <p className="text-xs text-stone-700">
            Hiện đang trong trạng thái: <strong>{currentTimeInState}</strong>
            {slaBreached ? (
              <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-bold text-red-700">
                Vượt SLA
              </span>
            ) : null}
          </p>
        </li>
      ) : null}
    </ol>
  );
}
