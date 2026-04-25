'use client';

import { useMemo } from 'react';

/**
 * Achievement banner — inline strip of badges for the athlete detail page.
 * Renders above the athlete profile hero (or wherever placed). Each badge is a
 * pill with its own colour. Clicking scrolls/navigates to the result-image CTA.
 *
 * Keeps 0 state gracefully: returns null if no badges (no empty block).
 */

export interface AchievementBadge {
  type: string;
  label: string;
  shortLabel?: string;
  color?: string;
}

export interface AchievementBannerProps {
  badges: AchievementBadge[];
  /** Called when the user clicks "Tạo ảnh chia sẻ" CTA inside the banner. */
  onCreateImage?: () => void;
  /** Max badges to display inline. Overflow shown as "+N". Default 4. */
  maxVisible?: number;
}

export default function AchievementBanner({
  badges,
  onCreateImage,
  maxVisible = 4,
}: AchievementBannerProps) {
  const { visible, overflow, hasCelebrationWorthy } = useMemo(() => {
    const vis = badges.slice(0, maxVisible);
    const ovf = Math.max(0, badges.length - vis.length);
    const celebrate = badges.some((b) =>
      ['PB', 'PODIUM', 'AG_PODIUM', 'ULTRA', 'SUB3H', 'SUB90M', 'SUB45M', 'SUB20M'].includes(b.type),
    );
    return { visible: vis, overflow: ovf, hasCelebrationWorthy: celebrate };
  }, [badges, maxVisible]);

  if (badges.length === 0) return null;

  return (
    <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 p-4 sm:p-5 shadow-sm">
      <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span aria-hidden>🏅</span>
            <h3 className="text-sm font-bold text-amber-900 uppercase tracking-wide">
              Thành tích
            </h3>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {visible.map((b) => (
              <span
                key={b.type}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold text-white shadow-sm"
                style={{ backgroundColor: b.color ?? '#1d4ed8' }}
                title={b.label}
              >
                {b.label}
              </span>
            ))}
            {overflow > 0 && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-white/80 text-amber-900 border border-amber-200">
                +{overflow}
              </span>
            )}
          </div>
        </div>
        {onCreateImage && (
          <button
            type="button"
            onClick={onCreateImage}
            className={[
              'shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-colors shadow-sm',
              hasCelebrationWorthy
                ? 'bg-amber-600 text-white hover:bg-amber-700'
                : 'bg-white text-amber-900 border border-amber-300 hover:bg-amber-100',
            ].join(' ')}
          >
            {hasCelebrationWorthy ? '🎨 Tạo ảnh ăn mừng' : '🎨 Tạo ảnh kết quả'}
          </button>
        )}
      </div>
    </div>
  );
}
