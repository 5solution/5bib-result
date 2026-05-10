'use client';
/**
 * F-020 BR-AG-49 — Visualizer 8 dot cho 9-state forward-only matrix.
 *
 * Tách concern từ `StateMachineTimeline` (timeline = lịch sử audit).
 * ProgressDots = trạng thái tiến trình tổng thể trong vòng đời podium.
 *
 * Branch tại `PODIUM_PUBLISHED`:
 *   - DISPUTE_OPEN (đỏ) — quay về AG_COMPUTED.
 *   - PODIUM_FINAL (xanh lá) — terminal.
 *
 * Hover dot → tooltip hiển thị tên state VN + timestamp lần đầu vào state đó
 * (đọc từ `stateHistory[]`).
 */
import type { PodiumState } from '../awards.constant';
import type { PodiumStateTransition } from '../awards.types';
import { VN } from '../awards.microcopy';

/**
 * Linear sequence chính. State `DISPUTE_OPEN` rẽ nhánh — render thành 1 dot
 * phụ riêng cuối hàng (kèm `PODIUM_FINAL`).
 */
const LINEAR_STATES: PodiumState[] = [
  'RAW_RESULT',
  'AG_COMPUTED',
  'WARNINGS_GENERATED',
  'BTC_REVIEW',
  'PODIUM_DRAFT',
  'PODIUM_LOCKED',
  'PODIUM_PUBLISHED',
];

interface Props {
  currentState: PodiumState;
  stateHistory: PodiumStateTransition[];
}

interface DotMeta {
  passed: boolean;
  current: boolean;
  enteredAt?: string;
}

function metaFor(
  state: PodiumState,
  currentIdx: number,
  idx: number,
  history: PodiumStateTransition[],
): DotMeta {
  const transition = history.find((t) => t.toState === state);
  return {
    passed: idx < currentIdx,
    current: idx === currentIdx,
    enteredAt: transition?.at,
  };
}

function dotClass(meta: DotMeta, branchColor?: 'red' | 'green'): string {
  if (meta.current) {
    if (branchColor === 'red') {
      return 'bg-red-600 ring-2 ring-red-300';
    }
    if (branchColor === 'green') {
      return 'bg-green-600 ring-2 ring-green-300';
    }
    return 'bg-blue-600 ring-2 ring-blue-300';
  }
  if (meta.passed) return 'bg-stone-700';
  if (branchColor === 'red') return 'border border-red-300 bg-white';
  if (branchColor === 'green') return 'border border-green-300 bg-white';
  return 'border border-stone-300 bg-white';
}

export function StateMachineProgressDots({
  currentState,
  stateHistory,
}: Props) {
  // Resolve currentIdx trong linear sequence.
  let linearIdx = LINEAR_STATES.indexOf(currentState);
  // Khi current là DISPUTE_OPEN hoặc PODIUM_FINAL, treat linearIdx = position
  // của PODIUM_PUBLISHED (parent state trong chain) cho passed-state coloring.
  if (currentState === 'DISPUTE_OPEN' || currentState === 'PODIUM_FINAL') {
    linearIdx = LINEAR_STATES.indexOf('PODIUM_PUBLISHED') + 1;
  }

  return (
    <div className="flex items-center gap-1.5 py-1">
      {LINEAR_STATES.map((state, idx) => {
        const meta = metaFor(state, linearIdx, idx, stateHistory);
        return (
          <span key={state} className="flex items-center">
            <span
              title={VN.PROGRESS_DOT_TOOLTIP(state, meta.enteredAt)}
              aria-label={VN.STATE_LABELS[state]}
              className={`inline-block h-2.5 w-2.5 rounded-full transition-colors ${dotClass(meta)}`}
            />
            {idx < LINEAR_STATES.length - 1 && (
              <span
                className={`mx-0.5 inline-block h-px w-3 ${idx < linearIdx - 1 ? 'bg-stone-700' : 'bg-stone-300'}`}
              />
            )}
          </span>
        );
      })}
      {/* Branch nhánh: DISPUTE_OPEN (đỏ) | PODIUM_FINAL (xanh lá). */}
      <span className="ml-2 flex items-center gap-1.5 border-l border-stone-300 pl-2">
        <span
          title={VN.PROGRESS_DOT_TOOLTIP(
            'DISPUTE_OPEN',
            stateHistory.find((t) => t.toState === 'DISPUTE_OPEN')?.at,
          )}
          aria-label={VN.STATE_LABELS.DISPUTE_OPEN}
          className={`inline-block h-2.5 w-2.5 rounded-full ${dotClass(
            {
              passed: stateHistory.some((t) => t.toState === 'DISPUTE_OPEN'),
              current: currentState === 'DISPUTE_OPEN',
            },
            'red',
          )}`}
        />
        <span
          title={VN.PROGRESS_DOT_TOOLTIP(
            'PODIUM_FINAL',
            stateHistory.find((t) => t.toState === 'PODIUM_FINAL')?.at,
          )}
          aria-label={VN.STATE_LABELS.PODIUM_FINAL}
          className={`inline-block h-2.5 w-2.5 rounded-full ${dotClass(
            {
              passed: false,
              current: currentState === 'PODIUM_FINAL',
            },
            'green',
          )}`}
        />
      </span>
    </div>
  );
}
