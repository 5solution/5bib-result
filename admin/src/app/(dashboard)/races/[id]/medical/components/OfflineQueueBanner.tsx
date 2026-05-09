'use client';

import { useOfflineQueue } from '../hooks/useOfflineQueue';
import { COPY } from '../medical.microcopy';

export function OfflineQueueBanner() {
  const { pending, isOnline, flush } = useOfflineQueue();

  if (isOnline && pending === 0) return null;

  return (
    <div
      role="status"
      className={`rounded-md border px-3 py-2 text-sm ${
        isOnline
          ? 'border-blue-200 bg-blue-50 text-blue-900'
          : 'border-amber-300 bg-amber-50 text-amber-900'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>
          {isOnline ? (
            <>
              {COPY.offline.queueBadge}: <strong>{pending}</strong>
            </>
          ) : (
            COPY.offline.banner
          )}
          {pending > 0 && !isOnline ? (
            <span className="ml-2 font-mono">
              ({COPY.offline.queueBadge}: {pending})
            </span>
          ) : null}
        </p>
        {pending > 0 ? (
          <button
            type="button"
            onClick={() => flush()}
            className="rounded bg-stone-900 px-2 py-1 text-xs text-white"
          >
            Đồng bộ ngay
          </button>
        ) : null}
      </div>
    </div>
  );
}
