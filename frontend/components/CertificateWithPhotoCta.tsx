'use client';

/**
 * Primary CTA button that opens the "Tải chứng nhận kèm ảnh" modal.
 * Only renders when a v1.1 certificate template exists for the race/course.
 * Intended to sit next to the legacy "Tải chứng nhận (PNG)" button — both
 * live in parallel; user picks whichever they want.
 */

import { useEffect, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import CertificateWithPhotoModal from './CertificateWithPhotoModal';

interface Props {
  raceId: string;
  bib: string | number;
  courseId?: string;
  runnerName: string;
  /** Runner's current avatar URL — used as initial photo in the modal. */
  initialPhotoUrl?: string | null;
  className?: string;
  /**
   * Visual variant.
   * - `default`: large pill CTA (rounded-full, px-8 py-3.5) — used in the
   *   standalone certificate section.
   * - `compact`: small button matching the "Tạo ảnh ăn mừng" CTA — used
   *   inline next to the achievement banner row.
   */
  variant?: 'default' | 'compact';
}

export default function CertificateWithPhotoCta({
  raceId,
  bib,
  courseId,
  runnerName,
  initialPhotoUrl,
  className = '',
  variant = 'default',
}: Props) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!raceId) return;
    let cancelled = false;
    const url = courseId
      ? `/api/certificates/check/${raceId}?courseId=${encodeURIComponent(courseId)}`
      : `/api/certificates/check/${raceId}`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) {
          // Only show the "kèm ảnh" CTA when template has a photo_area
          // (or a photo layer). Otherwise there's nothing to upload/crop.
          setAvailable(!!data?.hasCertificate && !!data?.certificateHasPhotoArea);
        }
      })
      .catch(() => {
        if (!cancelled) setAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [raceId, courseId]);

  if (!available) return null;

  const baseStyle =
    variant === 'compact'
      ? 'w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 shadow-md shadow-orange-200 transition-all active:scale-95'
      : 'inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold rounded-full transition-all duration-300 shadow-lg shadow-orange-200 hover:shadow-xl hover:shadow-orange-300 transform hover:-translate-y-0.5';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`${baseStyle} ${className}`}
      >
        <ImageIcon className="w-4 h-4" />
        Tải chứng nhận kèm ảnh
      </button>
      <CertificateWithPhotoModal
        open={open}
        onClose={() => setOpen(false)}
        raceId={raceId}
        bib={bib}
        courseId={courseId}
        runnerName={runnerName}
        initialPhotoUrl={initialPhotoUrl}
      />
    </>
  );
}
