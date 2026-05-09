'use client';

/**
 * F-014 BR-AS-44 — Lifecycle stepper (4 buttons + history).
 *
 * Forward-only state machine. Verbatim port from legacy
 * `settings/page.tsx` lines 763–860 (BR-AF-23 preserve).
 *
 * - draft → pre_race → live → ended (terminal)
 * - Clicking a forward step opens confirm dialog (handled by parent via
 *   `onChange` callback).
 * - `ended` is terminal; all other steps disabled when `current==='ended'`.
 */

import { History } from 'lucide-react';
import type { RaceStatus, StatusHistoryEntry } from '../section-shared.types';

interface StepDef {
  key: RaceStatus;
  label: string;
  desc: string;
  icon: string;
  activeClass: string;
  dotClass: string;
}

const STEPS: StepDef[] = [
  {
    key: 'draft',
    label: 'Nháp',
    desc: 'Ẩn khỏi trang công khai',
    icon: '✏️',
    activeClass: 'border-yellow-500 bg-yellow-50 text-yellow-800',
    dotClass: 'bg-yellow-500',
  },
  {
    key: 'pre_race',
    label: 'Chuẩn bị',
    desc: 'Giải chưa diễn ra',
    icon: '📋',
    activeClass: 'border-blue-500 bg-blue-50 text-blue-800',
    dotClass: 'bg-blue-500',
  },
  {
    key: 'live',
    label: 'Đang diễn ra',
    desc: 'Giải đang thi đấu',
    icon: '🏃',
    activeClass: 'border-green-500 bg-green-50 text-green-800',
    dotClass: 'bg-green-500 animate-pulse',
  },
  {
    key: 'ended',
    label: 'Đã kết thúc',
    desc: 'Giải đã hoàn tất',
    icon: '🏁',
    activeClass: 'border-zinc-400 bg-zinc-50 text-zinc-700',
    dotClass: 'bg-zinc-400',
  },
];

const ORDER: Record<RaceStatus, number> = {
  draft: 0,
  pre_race: 1,
  live: 2,
  ended: 3,
};

interface LifecycleStepperProps {
  current: RaceStatus;
  history?: StatusHistoryEntry[];
  onRequestChange: (next: RaceStatus, label: string) => void;
}

export function LifecycleStepper({
  current,
  history,
  onRequestChange,
}: LifecycleStepperProps) {
  const currentOrder = ORDER[current] ?? 0;
  return (
    <div className="flex flex-col gap-3">
      {current === 'ended' && (
        <p className="text-xs text-muted-foreground">
          Giải đã kết thúc — không thể đổi trạng thái. Liên hệ dev nếu cần mở lại.
        </p>
      )}
      <div className="grid grid-cols-4 gap-3">
        {STEPS.map((step) => {
          const isCurrent = current === step.key;
          const isValidTransition =
            !isCurrent &&
            current !== 'ended' &&
            ORDER[step.key] > currentOrder;
          const isDisabled = !isCurrent && !isValidTransition;
          return (
            <button
              key={step.key}
              disabled={isDisabled}
              title={
                isCurrent
                  ? 'Trạng thái hiện tại'
                  : isDisabled
                    ? current === 'ended'
                      ? 'Giải đã kết thúc — không thể đổi trạng thái'
                      : `Không thể quay lại '${step.label}' — chỉ được chuyển tiến`
                    : `Chuyển sang '${step.label}'`
              }
              onClick={() => {
                if (isCurrent || isDisabled) return;
                onRequestChange(step.key, step.label);
              }}
              data-testid={`lifecycle-${step.key}`}
              className={`relative flex flex-col items-center gap-1 p-4 rounded-xl border-2 transition-all text-center ${
                isCurrent
                  ? step.activeClass
                  : isDisabled
                    ? 'border-transparent bg-muted/30 text-muted-foreground/50 cursor-not-allowed opacity-50'
                    : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted hover:border-muted-foreground/20 cursor-pointer'
              }`}
            >
              {isCurrent && (
                <span
                  className={`absolute top-2 right-2 size-2.5 rounded-full ${step.dotClass}`}
                />
              )}
              <span className="text-2xl">{step.icon}</span>
              <span
                className={`text-sm font-semibold ${isCurrent ? '' : 'opacity-70'}`}
              >
                {step.label}
              </span>
              <span
                className={`text-[10px] ${isCurrent ? 'opacity-70' : 'opacity-50'}`}
              >
                {step.desc}
              </span>
              {isCurrent && (
                <span className="mt-1 text-[10px] font-bold uppercase tracking-wider opacity-60">
                  Hiện tại
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Status history audit trail */}
      {history && history.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-lg border bg-muted/30 px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <History className="size-3.5" />
            Lịch sử override ({history.length})
          </div>
          <ul className="flex flex-col gap-1 text-[11px]">
            {[...history]
              .reverse()
              .slice(0, 5)
              .map((h, i) => (
                <li
                  key={`${h.changedAt}-${i}`}
                  className="flex flex-col gap-0.5 rounded border bg-background px-2 py-1.5"
                >
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="text-muted-foreground">{h.from}</span>
                    <span>→</span>
                    <span className="font-semibold">{h.to}</span>
                    <span className="ml-auto text-muted-foreground">
                      {new Date(h.changedAt).toLocaleString('vi-VN')}
                    </span>
                  </div>
                  <div className="text-muted-foreground truncate" title={h.reason}>
                    {h.reason}
                  </div>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default LifecycleStepper;
