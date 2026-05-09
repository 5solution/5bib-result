'use client';

/**
 * F-018 BR-MI-09 — visual hint "Đề xuất: Lvl N (có thể đổi)".
 * NEVER hard-bind — just a hint.
 */
import {
  Category,
  SEVERITY_AUTO_SUGGEST,
  Severity,
  TraumaSubtype,
} from '../medical.constant';
import { COPY, SEVERITY_VN } from '../medical.microcopy';

interface SeverityCategoryAutoSuggestProps {
  category: Category | null;
  traumaSubtype?: TraumaSubtype | null;
  currentSeverity: Severity | null;
}

export function SeverityCategoryAutoSuggest({
  category,
  traumaSubtype,
  currentSeverity,
}: SeverityCategoryAutoSuggestProps) {
  if (!category) return null;
  const key =
    category === 'trauma' && traumaSubtype
      ? (`trauma.${traumaSubtype}` as keyof typeof SEVERITY_AUTO_SUGGEST)
      : (category as keyof typeof SEVERITY_AUTO_SUGGEST);
  const suggested = SEVERITY_AUTO_SUGGEST[key];
  if (!suggested) return null;
  if (currentSeverity === suggested) return null;
  return (
    <p className="text-xs italic text-stone-600">
      {COPY.form.autoSuggestPrefix} <strong>Lvl {suggested}</strong> —{' '}
      {SEVERITY_VN[suggested]} {COPY.form.autoSuggestSuffix}
    </p>
  );
}
