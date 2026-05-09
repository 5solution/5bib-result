'use client';

/**
 * F-018 A2 — witness statements form.
 * Server enforces ≥2 for Sev 4-5 closure transition.
 * Client surfaces blocking warning when below threshold + Sev ≥4.
 */
import { useState } from 'react';
import { Severity } from '../medical.constant';
import { COPY } from '../medical.microcopy';

export interface WitnessDraft {
  name: string;
  statement?: string;
  contact?: string;
}

interface WitnessStatementFormProps {
  severity: Severity | null;
  value: WitnessDraft[];
  onChange: (next: WitnessDraft[]) => void;
}

export function WitnessStatementForm({
  severity,
  value,
  onChange,
}: WitnessStatementFormProps) {
  const [draft, setDraft] = useState<WitnessDraft>({ name: '' });
  const required = severity !== null && severity >= 4;
  const insufficient = required && value.length < 2;

  const add = () => {
    const name = draft.name.trim();
    if (!name) return;
    onChange([...value, { ...draft, name }]);
    setDraft({ name: '' });
  };

  const remove = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      {required ? (
        <p
          className={`text-xs font-medium ${
            insufficient ? 'text-red-700' : 'text-stone-700'
          }`}
        >
          {COPY.form.witnessRequiredHint}
          {insufficient ? ` — hiện có ${value.length}/2` : ' ✓'}
        </p>
      ) : null}

      <ul className="space-y-2">
        {value.map((w, idx) => (
          <li
            key={`${w.name}-${idx}`}
            className="rounded-md border border-stone-200 bg-stone-50 p-2 text-sm"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-stone-900">{w.name}</p>
                {w.contact ? (
                  <p className="text-xs text-stone-500">{w.contact}</p>
                ) : null}
                {w.statement ? (
                  <p className="mt-1 text-xs italic text-stone-700">
                    “{w.statement}”
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                aria-label={`Xoá nhân chứng ${w.name}`}
                onClick={() => remove(idx)}
                className="text-xs text-stone-500 hover:text-red-600"
              >
                Xoá
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <input
          type="text"
          placeholder="Tên nhân chứng"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="rounded border border-stone-300 px-2 py-1.5 text-sm"
        />
        <input
          type="text"
          placeholder="SĐT / Liên hệ"
          value={draft.contact ?? ''}
          onChange={(e) => setDraft({ ...draft, contact: e.target.value })}
          className="rounded border border-stone-300 px-2 py-1.5 text-sm"
        />
        <input
          type="text"
          placeholder="Lời khai (tóm tắt)"
          value={draft.statement ?? ''}
          onChange={(e) => setDraft({ ...draft, statement: e.target.value })}
          className="rounded border border-stone-300 px-2 py-1.5 text-sm"
        />
      </div>
      <button
        type="button"
        onClick={add}
        className="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white"
      >
        Thêm nhân chứng
      </button>
    </div>
  );
}
