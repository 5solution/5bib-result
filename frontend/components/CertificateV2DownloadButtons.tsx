'use client';

/**
 * Header-placement share/download buttons for v1.1 template system.
 *
 * Only renders the SHARE CARD button here — the full "Tải chứng nhận kèm ảnh"
 * lives as a primary CTA next to the legacy certificate button in the
 * certificate section (see CertificateWithPhotoCta). Share cards are
 * typography-only (no photo_area) so they don't need the upload+crop flow.
 */

import { useEffect, useState, useCallback } from 'react';
import { Share2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface Props {
  raceId: string;
  bib: string | number;
  courseId?: string;
  runnerName: string;
  className?: string;
  variant?: 'glass' | 'solid';
}

interface Availability {
  hasCertificate: boolean;
  hasShareCard: boolean;
}

export default function CertificateV2DownloadButtons({
  raceId,
  bib,
  courseId,
  runnerName,
  className = '',
  variant = 'glass',
}: Props) {
  const { t } = useTranslation();
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!raceId) return;
    let cancelled = false;
    const url = courseId
      ? `/api/certificates/check/${raceId}?courseId=${encodeURIComponent(courseId)}`
      : `/api/certificates/check/${raceId}`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setAvailability({
            hasCertificate: !!data.hasCertificate,
            hasShareCard: !!data.hasShareCard,
          });
        }
      })
      .catch(() => {
        /* silently ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [raceId, courseId]);

  const downloadShareCard = useCallback(async () => {
    if (!raceId || !bib) return;
    setDownloading(true);
    const toastId = 'share-card-dl';
    toast.loading(t('athlete.downloadingV2'), { id: toastId });
    try {
      const qs = new URLSearchParams({ type: 'share_card' });
      if (courseId) qs.set('courseId', courseId);
      const res = await fetch(`/api/certificates/render/${raceId}/${bib}?${qs.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (runnerName || 'runner').replace(/\s+/g, '-');
      a.download = `share-card-${safeName}-BIB${bib}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t('athlete.downloadV2Success'), { id: toastId });
    } catch (err) {
      console.error('[CertificateV2] share_card download failed', err);
      toast.error(t('athlete.downloadV2Failed'), { id: toastId });
    } finally {
      setDownloading(false);
    }
  }, [raceId, bib, courseId, runnerName, t]);

  if (!availability || !availability.hasShareCard) return null;

  const btnBase =
    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed';
  const btnStyle =
    variant === 'glass'
      ? 'bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white border border-white/20'
      : 'bg-blue-600 hover:bg-blue-700 text-white';

  return (
    <button
      type="button"
      onClick={downloadShareCard}
      disabled={downloading}
      className={`${btnBase} ${btnStyle} ${className}`}
    >
      {downloading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Share2 className="w-3.5 h-3.5" />
      )}
      {t('athlete.shareCardV2')}
    </button>
  );
}
