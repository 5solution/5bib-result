'use client';
import type { PodiumStateTransition } from '../awards.types';

export function StateMachineTimeline({ history }: { history: PodiumStateTransition[] }) {
  if (!history.length) {
    return <div className="text-xs text-stone-500">Chưa có lịch sử transitions.</div>;
  }
  return (
    <ol className="space-y-2 border-l-2 border-stone-200 pl-3">
      {history.map((t, idx) => (
        <li key={`${t.at}-${idx}`} className="text-xs">
          <div className="font-mono">
            {t.fromState} → {t.toState}
          </div>
          <div className="text-stone-500">
            {new Date(t.at).toISOString().slice(0, 19)} · {t.actorId}
          </div>
          {t.note && <div className="mt-1 text-stone-700">{t.note}</div>}
          {t.evidenceUrl && (
            <a
              className="text-blue-700 underline"
              href={t.evidenceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Evidence
            </a>
          )}
        </li>
      ))}
    </ol>
  );
}
