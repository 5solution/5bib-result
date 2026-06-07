/**
 * FEATURE-047 Phase 1B — Single photo moderation card.
 *
 * Renders photo preview (signed URL 24h) + slug context + approve/reject buttons.
 */

'use client';

import { useState } from 'react';

interface QueueItem {
  id: string;
  athleteSlug: string;
  type: 'selfie' | 'bib_photo' | 'finish_line';
  signedUrl: string;
  mime: string;
  sizeBytes: number;
  uploadedAt: string;
  raceId?: string;
  bib?: string;
}

interface Props {
  item: QueueItem;
  onApprove: () => void;
  onReject: (reason?: string) => void;
  isApproving: boolean;
  isRejecting: boolean;
}

const TYPE_LABEL: Record<QueueItem['type'], string> = {
  selfie: 'Selfie',
  bib_photo: 'Ảnh BIB',
  finish_line: 'Về đích',
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function PhotoModerationCard({
  item,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: Props) {
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [reason, setReason] = useState('');
  const busy = isApproving || isRejecting;

  return (
    <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
      {/* Photo preview */}
      <div className="aspect-square bg-stone-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.signedUrl}
          alt={`Photo ${item.id}`}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>

      {/* Metadata */}
      <div className="border-t border-stone-100 p-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-block rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
            {TYPE_LABEL[item.type]}
          </span>
          <span className="text-xs text-stone-500">{formatSize(item.sizeBytes)}</span>
        </div>
        <div
          className="truncate text-sm font-medium text-stone-900"
          title={item.athleteSlug}
        >
          {item.athleteSlug}
        </div>
        {(item.raceId || item.bib) && (
          <div className="mt-1 text-xs text-stone-600">
            {item.raceId && <span>Race: {item.raceId}</span>}
            {item.bib && <span className="ml-2">BIB: {item.bib}</span>}
          </div>
        )}
        <div className="mt-1 text-xs text-stone-500">
          {new Date(item.uploadedAt).toLocaleString('vi-VN')}
        </div>
      </div>

      {/* Actions */}
      {!showRejectDialog ? (
        <div className="flex border-t border-stone-100">
          <button
            onClick={onApprove}
            disabled={busy}
            className="flex-1 bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isApproving ? 'Đang duyệt...' : '✓ Duyệt'}
          </button>
          <button
            onClick={() => setShowRejectDialog(true)}
            disabled={busy}
            className="flex-1 border-l border-stone-100 bg-stone-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            ✗ Từ chối
          </button>
        </div>
      ) : (
        <div className="border-t border-stone-100 p-3">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Lý do từ chối (tùy chọn, tối đa 500 ký tự)..."
            maxLength={500}
            rows={3}
            className="w-full rounded border border-stone-300 px-2 py-1 text-sm"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => {
                onReject(reason.trim() || undefined);
                setShowRejectDialog(false);
                setReason('');
              }}
              disabled={isRejecting}
              className="flex-1 rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {isRejecting ? 'Đang xử lý...' : 'Xác nhận từ chối'}
            </button>
            <button
              onClick={() => {
                setShowRejectDialog(false);
                setReason('');
              }}
              className="rounded border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50"
            >
              Hủy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
