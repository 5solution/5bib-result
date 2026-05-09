'use client';

/**
 * F-018 BR-MI-06..08 — 4×2 grid of 8 categories, single-select.
 * Trauma sub-type expand on selection.
 */
import { useState } from 'react';
import { CATEGORIES, Category, TRAUMA_SUBTYPES, TraumaSubtype } from '../medical.constant';
import { CATEGORY_VN, TRAUMA_SUBTYPE_VN } from '../medical.microcopy';
import { CategoryIcon } from './CategoryIcon';
import { cn } from '@/lib/utils';

interface CategoryPickerProps {
  value: Category | null;
  traumaSubtype: TraumaSubtype | null;
  onChange: (cat: Category, subtype?: TraumaSubtype) => void;
}

export function CategoryPicker({
  value,
  traumaSubtype,
  onChange,
}: CategoryPickerProps) {
  const [internalSubtype, setInternalSubtype] = useState<TraumaSubtype | null>(
    traumaSubtype,
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {CATEGORIES.map((cat) => {
          const isActive = value === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => {
                if (cat !== 'trauma') setInternalSubtype(null);
                onChange(cat, cat === 'trauma' ? internalSubtype ?? undefined : undefined);
              }}
              aria-pressed={isActive}
              className={cn(
                'flex min-h-[56px] items-center gap-2 rounded-lg border-2 px-3 py-3 text-left text-sm transition-colors',
                isActive
                  ? 'border-stone-900 bg-stone-900 text-white'
                  : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400',
              )}
            >
              <CategoryIcon category={cat} className="shrink-0" />
              <span className="leading-tight">{CATEGORY_VN[cat]}</span>
            </button>
          );
        })}
      </div>

      {value === 'trauma' ? (
        <div
          role="radiogroup"
          aria-label="Sub-type chấn thương"
          className="grid grid-cols-2 gap-2 md:grid-cols-4"
        >
          {TRAUMA_SUBTYPES.map((sub) => {
            const isSelected = internalSubtype === sub;
            return (
              <button
                key={sub}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => {
                  setInternalSubtype(sub);
                  onChange('trauma', sub);
                }}
                className={cn(
                  'min-h-[44px] rounded-md border px-3 py-2 text-sm',
                  isSelected
                    ? 'border-orange-600 bg-orange-50 text-orange-900'
                    : 'border-stone-200 bg-white text-stone-700',
                )}
              >
                {TRAUMA_SUBTYPE_VN[sub]}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
