'use client';

import type { NameMode } from './useNameDisplayMode';

interface Props {
  mode: NameMode;
  onChange: (mode: NameMode) => void;
}

/**
 * Segmented control toggle giữa 2 chế độ hiển thị tên VĐV trên kiosk Bàn 2.
 * - BIB: tên trên áo (subinfo.name_on_bib) — nickname, fun.
 * - Họ tên: full name (athletes.name) — verify CCCD.
 *
 * BR-06: Click → state change → upstream re-render AthleteCard với tên mới
 * KHÔNG re-fetch API (cache đã có cả 2 field).
 *
 * BR-07: Click KHÔNG trigger TTS speak — chỉ áp dụng cho lần FOUND tiếp theo.
 */
export function NameDisplayToggle({ mode, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="Chế độ hiển thị tên VĐV"
      className="inline-flex rounded-full bg-stone-100 p-1 text-xs font-semibold"
    >
      <button
        type="button"
        onClick={() => onChange('bib')}
        aria-pressed={mode === 'bib'}
        className={`rounded-full px-3 py-1 transition-colors ${
          mode === 'bib'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-stone-600 hover:text-stone-900'
        }`}
        title="Hiển thị tên trên BIB (nickname trên áo VĐV)"
      >
        🏷️ BIB
      </button>
      <button
        type="button"
        onClick={() => onChange('full')}
        aria-pressed={mode === 'full'}
        className={`rounded-full px-3 py-1 transition-colors ${
          mode === 'full'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-stone-600 hover:text-stone-900'
        }`}
        title="Hiển thị họ và tên đầy đủ (verify CCCD)"
      >
        👤 Họ tên
      </button>
    </div>
  );
}
