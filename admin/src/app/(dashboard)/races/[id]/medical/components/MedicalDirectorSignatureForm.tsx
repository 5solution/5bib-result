'use client';

/**
 * F-018 A3 — Phase 1 typed-name signature.
 * Phase 2 will swap in `<canvas>` digital signature pad → S3 PNG.
 */
import { useState } from 'react';

interface MedicalDirectorSignatureFormProps {
  value: { name: string; signedAt: string } | null;
  onChange: (sig: { name: string; signedAt: string } | null) => void;
}

export function MedicalDirectorSignatureForm({
  value,
  onChange,
}: MedicalDirectorSignatureFormProps) {
  const [name, setName] = useState(value?.name ?? '');

  const sign = () => {
    const v = name.trim();
    if (!v) return;
    onChange({ name: v, signedAt: new Date().toISOString() });
  };

  const clear = () => {
    setName('');
    onChange(null);
  };

  return (
    <div className="space-y-2 rounded-md border border-stone-200 bg-stone-50 p-3">
      <p className="text-xs font-medium text-stone-700">
        Chữ ký Trưởng Y tế cuộc đua (Phase 1: gõ tên)
      </p>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="VD: BS Nguyễn Văn A"
        className="w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
      />
      {value ? (
        <p className="text-xs italic text-green-700">
          Đã ký: {value.name} — {new Date(value.signedAt).toLocaleString('vi-VN')}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={sign}
          className="rounded bg-stone-900 px-3 py-1.5 text-xs text-white"
        >
          Ký
        </button>
        {value ? (
          <button
            type="button"
            onClick={clear}
            className="rounded border border-stone-300 bg-white px-3 py-1.5 text-xs"
          >
            Xoá chữ ký
          </button>
        ) : null}
      </div>
    </div>
  );
}
