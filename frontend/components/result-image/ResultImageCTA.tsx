'use client';

import { useRaceShareCount } from '@/lib/api-hooks/result-image';

/**
 * Result-image CTA — the "Tạo ảnh chia sẻ" button + live share counter.
 * Thin presentational component; all state lives in parent so this renders
 * consistently in multiple places (athlete header, bottom floating bar, etc).
 */

export interface ResultImageCTAProps {
  raceId: string;
  onClick: () => void;
  /** Optional — default to "Tạo ảnh chia sẻ". */
  label?: string;
  /** Show the live share counter inline (default true). */
  showCounter?: boolean;
  variant?: 'primary' | 'ghost';
  className?: string;
  /** Highlight the CTA (e.g. when user has a celebration-worthy badge). */
  highlighted?: boolean;
}

export default function ResultImageCTA({
  raceId,
  onClick,
  label = 'Tạo ảnh chia sẻ',
  showCounter = true,
  variant = 'primary',
  className = '',
  highlighted = false,
}: ResultImageCTAProps) {
  const { data: shareCount } = useRaceShareCount(raceId, { enabled: showCounter });

  const base =
    'inline-flex items-center justify-center gap-2 rounded-full font-bold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2';
  const sizing = 'px-5 py-2.5 text-sm';
  const palette =
    variant === 'primary'
      ? highlighted
        ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg hover:shadow-xl hover:brightness-110 focus:ring-amber-400'
        : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm focus:ring-blue-400'
      : 'bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 focus:ring-gray-300';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} ${sizing} ${palette} ${className}`}
      aria-label={`${label}${
        typeof shareCount === 'number' && shareCount > 0 ? ` · ${shareCount} lượt chia sẻ` : ''
      }`}
    >
      <span className="text-base" aria-hidden>
        🎨
      </span>
      <span>{label}</span>
      {showCounter && typeof shareCount === 'number' && shareCount > 0 && (
        <span
          className={[
            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold',
            variant === 'primary'
              ? 'bg-white/25 text-white'
              : 'bg-blue-50 text-blue-700',
          ].join(' ')}
          title={`${shareCount.toLocaleString('vi-VN')} lượt chia sẻ tại race này`}
        >
          {formatShareCount(shareCount)}
        </span>
      )}
    </button>
  );
}

/** Format counter: 1234 → 1.2K, 12345 → 12K. */
function formatShareCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1).replace('.0', '')}K`;
  return `${Math.round(n / 1000)}K`;
}
