'use client';

import { useState, useRef, useCallback } from 'react';
import { X, Download, ImagePlus, RotateCcw, Loader2, Share2 } from 'lucide-react';
import { toast } from 'sonner';

interface AthleteData {
  Name: string;
  Bib: number;
  ChipTime: string;
  GunTime: string;
  Pace: string;
  Gap: string;
  Gender: string;
  Category: string;
  OverallRank: string;
  GenderRank: string;
  CatRank: string;
  distance: string;
  race_name?: string;
  Nationality?: string;
  Nation?: string;
}

const BACKGROUNDS = [
  { id: 'blue', label: 'Xanh', gradient: 'linear-gradient(135deg, #2563eb 0%, #1e40af 50%, #3730a3 100%)' },
  { id: 'dark', label: 'Tối', gradient: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)' },
  { id: 'sunset', label: 'Hoàng hôn', gradient: 'linear-gradient(135deg, #f97316 0%, #dc2626 50%, #be123c 100%)' },
  { id: 'forest', label: 'Rừng', gradient: 'linear-gradient(135deg, #059669 0%, #047857 50%, #065f46 100%)' },
  { id: 'purple', label: 'Tím', gradient: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #4c1d95 100%)' },
];

export default function ResultImageEditor({
  athlete,
  onClose,
}: {
  athlete: AthleteData;
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [bgStyle, setBgStyle] = useState(BACKGROUNDS[0].gradient);
  const [customBg, setCustomBg] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);

  const formatName = (name: string) =>
    name.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const genderLabel = athlete.Gender === 'Male' || athlete.Gender === 'M' ? 'Nam' : 'Nữ';

  const handleUploadBg = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn file ảnh');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCustomBg(reader.result as string);
    };
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  const resetBg = useCallback(() => {
    setCustomBg(null);
    setBgStyle(BACKGROUNDS[0].gradient);
  }, []);

  const captureCard = useCallback(async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;

    // html2canvas doesn't support aspect-ratio CSS, so we must set explicit dimensions
    const el = cardRef.current;
    const w = el.offsetWidth;
    // Use max of offsetHeight and scrollHeight to capture all content
    const h = Math.max(el.offsetHeight, el.scrollHeight);
    const origWidth = el.style.width;
    const origHeight = el.style.height;
    const origAspect = el.style.aspectRatio;
    const origOverflow = el.style.overflow;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.style.aspectRatio = 'unset';
    el.style.overflow = 'visible';

    try {
      const html2canvas = (await import('html2canvas-pro')).default;
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        width: w,
        height: h,
      });
      return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png');
      });
    } finally {
      // Restore original styles
      el.style.width = origWidth;
      el.style.height = origHeight;
      el.style.aspectRatio = origAspect;
      el.style.overflow = origOverflow;
    }
  }, []);

  const getFileName = useCallback(() => {
    return `result-${athlete.Name.replace(/\s+/g, '-')}-BIB${athlete.Bib}.png`;
  }, [athlete]);

  const handleDownload = useCallback(async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const blob = await captureCard();
      if (!blob) {
        toast.error('Không thể tạo ảnh');
        setDownloading(false);
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = getFileName();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Đã tải ảnh kết quả!');
    } catch {
      toast.error('Không thể tạo ảnh');
    } finally {
      setDownloading(false);
    }
  }, [captureCard, getFileName]);

  const handleShare = useCallback(async () => {
    if (!cardRef.current) return;
    setSharing(true);
    try {
      const blob = await captureCard();
      if (!blob) {
        toast.error('Không thể tạo ảnh');
        setSharing(false);
        return;
      }
      const file = new File([blob], getFileName(), { type: 'image/png' });
      const shareData = { files: [file] };
      if (navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
      } else {
        toast.error('Trình duyệt không hỗ trợ chia sẻ');
      }
    } catch {
      // User cancelled share - not an error
    } finally {
      setSharing(false);
    }
  }, [captureCard, getFileName]);

  const canShare = typeof navigator !== 'undefined' && !!navigator.share;

  const backgroundCss = customBg
    ? { backgroundImage: `url(${customBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: bgStyle };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-bold text-slate-900">Tạo ảnh kết quả</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Background picker */}
        <div className="px-5 py-3 border-b bg-slate-50">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Chọn nền</p>
          <div className="flex items-center gap-2 flex-wrap">
            {BACKGROUNDS.map(bg => (
              <button
                key={bg.id}
                onClick={() => { setCustomBg(null); setBgStyle(bg.gradient); }}
                className={`w-8 h-8 rounded-full border-2 transition-all ${!customBg && bgStyle === bg.gradient ? 'border-blue-600 scale-110' : 'border-transparent hover:border-slate-300'}`}
                style={{ background: bg.gradient }}
                title={bg.label}
              />
            ))}
            <button
              onClick={() => fileRef.current?.click()}
              className={`w-8 h-8 rounded-full border-2 border-dashed flex items-center justify-center transition-all ${customBg ? 'border-blue-600 bg-blue-50' : 'border-slate-300 hover:border-blue-400 bg-white'}`}
              title="Upload ảnh nền"
            >
              <ImagePlus className="w-3.5 h-3.5 text-slate-500" />
            </button>
            {customBg && (
              <button onClick={resetBg} className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors" title="Reset">
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleUploadBg} className="hidden" />
        </div>

        {/* Preview card */}
        <div className="p-5">
          <div
            ref={cardRef}
            className="rounded-xl overflow-hidden"
            style={{
              width: '100%',
              aspectRatio: '4/5',
              position: 'relative',
              ...backgroundCss,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              color: 'white',
            }}
          >
            {/* Overlay for readability on custom bg */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: customBg ? 'rgba(0,0,0,0.45)' : 'transparent',
              zIndex: 0,
            }} />

            <div style={{ position: 'relative', zIndex: 1, padding: '32px 24px 28px', display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
              {/* Race name */}
              <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 600 }}>
                {athlete.race_name || ''}
              </div>
              <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 16 }}>
                {athlete.distance}
              </div>

              {/* Athlete name */}
              <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 6, letterSpacing: '-0.02em' }}>
                {formatName(athlete.Name)}
              </div>

              {/* Tags */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
                <span style={{ padding: '3px 10px', background: 'rgba(255,255,255,0.2)', borderRadius: 16, fontSize: 11, fontWeight: 700 }}>
                  BIB: {athlete.Bib}
                </span>
                <span style={{ padding: '3px 10px', background: 'rgba(255,255,255,0.2)', borderRadius: 16, fontSize: 11, fontWeight: 600 }}>
                  {genderLabel}
                </span>
                <span style={{ padding: '3px 10px', background: 'rgba(255,255,255,0.2)', borderRadius: 16, fontSize: 11, fontWeight: 600 }}>
                  {athlete.Category}
                </span>
              </div>

              {/* Spacer */}
              <div style={{ flex: 1 }} />

              {/* Chip Time */}
              <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: '20px 16px', marginBottom: 16, backdropFilter: 'blur(8px)' }}>
                <div style={{ fontSize: 10, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 6 }}>
                  Chip Time
                </div>
                <div style={{ fontSize: 40, fontWeight: 900, fontFamily: 'ui-monospace, monospace', letterSpacing: '-0.02em' }}>
                  {athlete.ChipTime}
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                  <span>Pace: <strong style={{ fontFamily: 'ui-monospace, monospace' }}>{athlete.Pace}</strong> /km</span>
                  {athlete.Gap && athlete.Gap !== '-' && <span>Gap: <strong style={{ fontFamily: 'ui-monospace, monospace' }}>{athlete.Gap}</strong></span>}
                </div>
              </div>

              {/* Ranks */}
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { label: 'Overall', value: `#${athlete.OverallRank}` },
                  { label: 'Gender', value: `#${athlete.GenderRank}` },
                  ...(athlete.CatRank ? [{ label: 'Category', value: `#${athlete.CatRank}` }] : []),
                ].map((item) => (
                  <div key={item.label} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 8px', textAlign: 'center', backdropFilter: 'blur(4px)' }}>
                    <div style={{ fontSize: 18, fontWeight: 900 }}>{item.value}</div>
                    <div style={{ fontSize: 9, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginTop: 2 }}>{item.label}</div>
                  </div>
                ))}
              </div>

              {/* Branding */}
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo_5BIB_white.png" alt="5BIB" style={{ height: 24, opacity: 0.5, display: 'inline-block' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={handleDownload}
            disabled={downloading || sharing}
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-xl transition-all shadow-lg disabled:opacity-60"
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {downloading ? 'Đang xử lý...' : 'Tải về'}
          </button>
          {canShare && (
            <button
              onClick={handleShare}
              disabled={downloading || sharing}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all disabled:opacity-60"
            >
              {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
              {sharing ? '...' : 'Chia sẻ'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
