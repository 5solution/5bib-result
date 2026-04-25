'use client';

import { useMemo } from 'react';
import type { TemplateKey } from '@/lib/api-hooks/result-image';
import { buildPreviewUrl } from '@/lib/api-hooks/result-image';

/**
 * Template picker — 6-thumbnail grid. Previews are lazy `<img>` requests to the
 * GET preview endpoint (half-res 480px for speed). The backend already applies
 * its own Redis render-lock to dedupe concurrent requests, so a row of 6 thumbs
 * won't stampede.
 *
 * Eligibility gating (from PRD):
 *   - `podium` disabled unless athlete overallRank ≤ 3 OR categoryRank ≤ 3.
 *     Shown as locked with tooltip; clicking still opens it (backend falls back
 *     to classic + sets X-Template-Fallback header).
 *   - `story` → frontend forces the 9:16 size when selected.
 *   - `celebration` → Phase 2 gate E-2 (waiting on PM). Current behavior: always
 *     enabled. If PM decides "gate", flip `celebrationEligible` to false when
 *     no badge is present.
 */

export interface TemplateMeta {
  key: TemplateKey;
  label: string;
  subtitle: string;
  accent: string;
}

export const TEMPLATE_META: readonly TemplateMeta[] = [
  { key: 'classic', label: 'Classic', subtitle: 'Brand blue · mọi dịp', accent: '#1d4ed8' },
  { key: 'celebration', label: 'Celebration', subtitle: 'PB · Podium · ăn mừng', accent: '#f59e0b' },
  { key: 'endurance', label: 'Endurance', subtitle: 'Ultra · trail · pace bar', accent: '#166534' },
  { key: 'story', label: 'Story (9:16)', subtitle: 'Instagram / FB Story', accent: '#7c3aed' },
  { key: 'sticker', label: 'Sticker', subtitle: 'Die-cut · badge nổi bật', accent: '#dc2626' },
  { key: 'podium', label: 'Podium 🏆', subtitle: 'Top 3 · huy chương vàng-bạc-đồng', accent: '#b45309' },
] as const;

export interface TemplatePickerProps {
  raceId: string;
  bib: string;
  selected: TemplateKey;
  onChange: (key: TemplateKey) => void;
  /** overallRank (numeric string) — used to gate Podium. */
  overallRank?: string | number;
  categoryRank?: string | number;
  /** Force re-fetch of previews (e.g. when user changes gradient). */
  previewToken?: string | number;
  gradient?: string;
  showBadges?: boolean;
}

export default function TemplatePicker({
  raceId,
  bib,
  selected,
  onChange,
  overallRank,
  categoryRank,
  previewToken,
  gradient,
  showBadges,
}: TemplatePickerProps) {
  const isPodiumEligible = useMemo(() => isTop3(overallRank) || isTop3(categoryRank), [
    overallRank,
    categoryRank,
  ]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {TEMPLATE_META.map((tpl) => {
        const locked = tpl.key === 'podium' && !isPodiumEligible;
        const isSelected = selected === tpl.key;
        const size = tpl.key === 'story' ? '9:16' : '4:5';
        const previewUrl = buildPreviewUrl(raceId, bib, {
          template: tpl.key,
          size,
          gradient: gradient as never,
          showBadges,
          token: previewToken,
        });
        const aspectClass = tpl.key === 'story' ? 'aspect-[9/16]' : 'aspect-[4/5]';
        return (
          <button
            key={tpl.key}
            type="button"
            onClick={() => onChange(tpl.key)}
            disabled={locked}
            title={
              locked
                ? 'Chỉ dành cho VĐV Top 3 (chung cuộc hoặc lứa tuổi)'
                : `Chọn template ${tpl.label}`
            }
            className={[
              'group relative rounded-xl overflow-hidden border-2 text-left transition',
              isSelected
                ? 'border-blue-600 ring-2 ring-blue-200 shadow-lg'
                : 'border-gray-200 hover:border-gray-400',
              locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
            ].join(' ')}
            style={{
              backgroundColor: isSelected ? `${tpl.accent}0a` : undefined,
            }}
            aria-pressed={isSelected}
          >
            <div className={`relative w-full ${aspectClass} bg-gray-100`}>
              {!locked && (
                // Lazy-loaded preview PNG from backend. Browser caches these
                // aggressively; bump `previewToken` to invalidate on gradient change.
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={previewUrl}
                  alt={`Preview template ${tpl.label}`}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
              {locked && (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400 font-medium">
                  🔒 Top 3 only
                </div>
              )}
              {isSelected && (
                <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow">
                  Đang chọn
                </div>
              )}
            </div>
            <div className="px-2.5 py-2">
              <div className="text-sm font-bold text-gray-900">{tpl.label}</div>
              <div className="text-[11px] text-gray-500 line-clamp-1">{tpl.subtitle}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function isTop3(rank: string | number | undefined): boolean {
  if (rank === undefined || rank === null || rank === '') return false;
  const n = typeof rank === 'number' ? rank : parseInt(rank, 10);
  return !isNaN(n) && n >= 1 && n <= 3;
}
