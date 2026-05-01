'use client';

import type { ChipLookupResponse, ChipResult } from '@/lib/chip-verify-api';

interface Props {
  data: ChipLookupResponse;
  /**
   * Tên đã resolve qua fallback chain ở upstream (ChipVerifyKioskClient).
   * AthleteCard chỉ render — KHÔNG resolve mode logic ở đây để giữ pure.
   */
  displayName: string;
  /** Label cho field tên — "Tên" (mode bib) hoặc "Họ và tên" (mode full). */
  nameLabel: string;
}

/**
 * BR-08: long name auto-shrink. Threshold theo Vietnamese chars (multibyte
 * không tính bằng code units — dùng .length sẽ count chính xác char với
 * diacritics đơn lẻ, vì JS string là UTF-16 code units, mỗi diacritic
 * Vietnamese chiếm 1 unit khi đã NFC-composed).
 *
 * - <= 24 chars: text-6xl / sm:text-7xl (default — tier với BIB)
 * - 25-40 chars: text-4xl / sm:text-5xl (giảm 2 bậc)
 * - 41-60 chars: text-2xl / sm:text-3xl + line-clamp-2
 * - > 60: text-xl / sm:text-2xl + line-clamp-2 (KHÔNG truncate '…' để giữ
 *   verify CCCD chính xác)
 */
function nameSizeClass(name: string): string {
  const len = name.length;
  if (len <= 24) return 'text-6xl sm:text-7xl';
  if (len <= 40) return 'text-4xl sm:text-5xl';
  if (len <= 60) return 'text-2xl sm:text-3xl line-clamp-2';
  return 'text-xl sm:text-2xl line-clamp-2';
}

const RESULT_STYLE: Record<
  ChipResult,
  { bg: string; border: string; text: string; label: string; emoji: string }
> = {
  FOUND: {
    bg: 'bg-green-50',
    border: 'border-green-500',
    text: 'text-green-900',
    label: 'GIAO RACEKIT',
    emoji: '✅',
  },
  ALREADY_PICKED_UP: {
    bg: 'bg-amber-50',
    border: 'border-amber-500',
    text: 'text-amber-900',
    label: 'ĐÃ NHẬN RACEKIT',
    emoji: '⚠️',
  },
  CHIP_NOT_FOUND: {
    bg: 'bg-red-50',
    border: 'border-red-500',
    text: 'text-red-900',
    label: 'CHIP KHÔNG CÓ TRONG HỆ THỐNG',
    emoji: '❌',
  },
  BIB_UNASSIGNED: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-500',
    text: 'text-yellow-900',
    label: 'BIB CHƯA GÁN VĐV — KIỂM TRA LẠI',
    emoji: '⚠️',
  },
  DISABLED: {
    bg: 'bg-gray-50',
    border: 'border-gray-400',
    text: 'text-gray-700',
    label: 'CHIP ĐÃ BỊ DISABLE',
    emoji: '🚫',
  },
};

export function AthleteCard({ data, displayName, nameLabel }: Props) {
  const style = RESULT_STYLE[data.result];
  const nameSize = nameSizeClass(displayName);

  return (
    <section
      className={`rounded-xl border-4 ${style.border} ${style.bg} p-6 shadow-lg sm:p-8`}
      aria-live="polite"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-4xl" aria-hidden>
            {style.emoji}
          </span>
          <div>
            <p
              className={`text-xs font-bold uppercase tracking-widest ${style.text}`}
            >
              {style.label}
            </p>
            {data.is_first_verify && data.result === 'FOUND' && (
              <p className="text-xs text-green-700">First verify ✨</p>
            )}
          </div>
        </div>
        <p className="text-xs text-stone-500">
          {new Date(data.verified_at).toLocaleTimeString('vi-VN')}
        </p>
      </div>

      {/* BIB + Tên cùng tier visual — same font weight + size để VĐV verify
          nhanh cả 2 thông tin. Name có thể wrap nếu dài (font-black + leading-tight). */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
        <div>
          <p className="text-sm uppercase tracking-wide text-stone-600">BIB</p>
          <p
            className={`text-6xl font-black leading-none tracking-tight ${style.text} sm:text-7xl`}
          >
            {data.bib_number ?? '—'}
          </p>
        </div>
        <div>
          <p className="text-sm uppercase tracking-wide text-stone-600">
            {nameLabel}
          </p>
          <p
            className={`break-words font-black leading-tight tracking-tight ${style.text} ${nameSize}`}
          >
            {displayName}
          </p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Field label="Cự ly" value={data.course_name} />
        <Field label="Giới tính" value={data.gender} />
        <Field
          label="Racekit"
          value={data.racekit_received ? 'Đã nhận' : 'Chưa nhận'}
          highlight={data.racekit_received ? 'amber' : undefined}
        />
        {/* Vật phẩm BTC giao kèm racekit (áo, mũ, túi, ...). Free-form string
            từ subinfo.achivements — render raw, break-words cho nhiều items. */}
        <Field label="Vật phẩm" value={data.items} />
      </dl>
    </section>
  );
}

function Field({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | null;
  highlight?: 'amber';
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-stone-600">{label}</dt>
      <dd
        className={`mt-0.5 break-words font-semibold ${
          highlight === 'amber' ? 'text-amber-800' : 'text-stone-900'
        }`}
      >
        {value ?? '—'}
      </dd>
    </div>
  );
}
