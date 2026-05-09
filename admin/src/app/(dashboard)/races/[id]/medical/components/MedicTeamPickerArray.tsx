'use client';

/**
 * F-018 A1 — multi-medic array picker.
 * Manager Plan §4 A1 LOCKED: `medicalTeamAssigned: string[]` from M0
 * (NOT single-string — Sev 5 requires 2 medics + ambulance simultaneously).
 *
 * Phase 1: free-text chip input. Phase 2: autocomplete from race medics roster.
 */
import { useState } from 'react';

interface MedicTeamPickerArrayProps {
  value: string[];
  onChange: (next: string[]) => void;
}

export function MedicTeamPickerArray({
  value,
  onChange,
}: MedicTeamPickerArrayProps) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (value.includes(v)) {
      setDraft('');
      return;
    }
    onChange([...value, v]);
    setDraft('');
  };

  const remove = (medic: string) => {
    onChange(value.filter((m) => m !== medic));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((m) => (
          <span
            key={m}
            className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-900"
          >
            {m}
            <button
              type="button"
              aria-label={`Xoá ${m}`}
              onClick={() => remove(m)}
              className="text-blue-700 hover:text-blue-900"
            >
              ×
            </button>
          </span>
        ))}
        {value.length === 0 ? (
          <span className="text-xs text-stone-500">Chưa phân công</span>
        ) : null}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Tên / mã y tế (Enter để thêm)"
          className="flex-1 rounded border border-stone-300 px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={add}
          className="rounded bg-stone-900 px-3 py-1.5 text-sm text-white"
        >
          Thêm
        </button>
      </div>
    </div>
  );
}
