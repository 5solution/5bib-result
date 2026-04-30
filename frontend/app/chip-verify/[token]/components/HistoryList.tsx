'use client';

import { useQuery } from '@tanstack/react-query';
import { getRecentVerifications, type ChipResult } from '@/lib/chip-verify-api';

interface Props {
  token: string;
}

const SHORT_LABEL: Record<ChipResult, { label: string; cls: string }> = {
  FOUND: { label: 'OK', cls: 'bg-green-100 text-green-800' },
  ALREADY_PICKED_UP: { label: 'ĐÃ NHẬN', cls: 'bg-amber-100 text-amber-800' },
  CHIP_NOT_FOUND: { label: 'KHÔNG CÓ', cls: 'bg-red-100 text-red-800' },
  BIB_UNASSIGNED: { label: 'CHƯA GÁN', cls: 'bg-yellow-100 text-yellow-800' },
  DISABLED: { label: 'DISABLED', cls: 'bg-gray-100 text-gray-700' },
};

export function HistoryList({ token }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['chip-recent', token],
    queryFn: () => getRecentVerifications(token, 20),
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-12 animate-pulse rounded bg-stone-200"
            aria-hidden
          />
        ))}
      </div>
    );
  }

  const items = data?.items ?? [];

  if (items.length === 0) {
    return (
      <p className="rounded border border-dashed border-stone-300 p-4 text-center text-sm text-stone-500">
        Chưa có lượt quẹt nào.
      </p>
    );
  }

  return (
    <ol className="space-y-2">
      {items.map((it, idx) => {
        const meta = SHORT_LABEL[it.result];
        return (
          <li
            key={`${it.verified_at}-${idx}`}
            className="flex items-center justify-between gap-3 rounded border bg-white p-2 text-sm"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="font-mono text-xs text-stone-500 tabular-nums">
                {new Date(it.verified_at).toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
              <span className="min-w-[3rem] font-semibold tabular-nums">
                {it.bib_number ?? '—'}
              </span>
              <span className="truncate text-stone-700">
                {it.name ?? '(no name)'}
              </span>
              {it.course_name && (
                <span className="truncate text-xs text-stone-500">
                  · {it.course_name}
                </span>
              )}
            </div>
            <span
              className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${meta.cls}`}
            >
              {meta.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
