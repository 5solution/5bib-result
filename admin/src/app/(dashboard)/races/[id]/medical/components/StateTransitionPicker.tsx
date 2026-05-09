'use client';

/**
 * F-018 BR-MI-12 — forward-only transition picker.
 * Shows allowed transitions per current state; backward transitions hidden
 * (server enforces matrix; client mirror is UX nicety).
 */
import { ALLOWED_TRANSITIONS, IncidentState } from '../medical.constant';
import { STATE_VN } from '../medical.microcopy';

interface StateTransitionPickerProps {
  current: IncidentState;
  onSelect: (to: IncidentState) => void;
  disabled?: boolean;
}

export function StateTransitionPicker({
  current,
  onSelect,
  disabled,
}: StateTransitionPickerProps) {
  const options = ALLOWED_TRANSITIONS[current] ?? [];

  if (options.length === 0) {
    return (
      <p className="text-sm text-stone-500">
        Trạng thái hiện tại là cuối — không thể chuyển tiếp.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Chuyển trạng thái">
      {options.map((to) => (
        <button
          key={to}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(to)}
          className="min-h-[44px] rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800 hover:border-stone-500 hover:bg-stone-50 disabled:opacity-50"
        >
          → {STATE_VN[to]}
        </button>
      ))}
    </div>
  );
}
