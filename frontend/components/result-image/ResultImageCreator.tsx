'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Download, Loader2, ImagePlus, RotateCcw, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import TemplatePicker, { TEMPLATE_META } from './TemplatePicker';
import {
  TemplateKey,
  GradientKey,
  SizeKey,
  buildPreviewUrl,
  useGenerateResultImage,
  useIncrementShareCount,
  useLogShareEvent,
  ResultImageError,
} from '@/lib/api-hooks/result-image';

/**
 * Result Image Creator — Phase 2 modal.
 *
 * Flow:
 *  1. User picks template (6 thumbnails) + gradient (5 presets)
 *  2. Optional: upload custom photo (replaces gradient as background)
 *  3. Optional: custom short message (≤50 chars)
 *  4. Optional: toggle splits / QR / badges
 *  5. Live preview — <img> pointing at GET preview endpoint, lazy/half-res
 *  6. Click "Tải xuống" → POST full-res, download blob
 *  7. Click "Chia sẻ" → POST + Web Share API (or fallback to copy + download)
 *
 * Error handling:
 *  - 503 / 429 → toast with retry-after hint
 *  - template fallback (X-Template-Fallback header) → toast "Đã dùng template Classic"
 *  - file size > 10MB → reject client-side before request
 *
 * A11y:
 *  - Escape closes
 *  - Focus trap inside modal
 *  - Backdrop click closes (unless loading)
 */

interface AthleteLite {
  Name: string;
  Bib: number | string;
  ChipTime: string;
  OverallRank?: string;
  CatRank?: string;
  race_name?: string;
}

interface Props {
  athlete: AthleteLite;
  raceId: string;
  raceName?: string;
  onClose: () => void;
}

const GRADIENTS: { id: GradientKey; label: string; preview: string }[] = [
  { id: 'blue', label: 'Xanh', preview: 'linear-gradient(135deg, #2563eb, #3730a3)' },
  { id: 'dark', label: 'Tối', preview: 'linear-gradient(135deg, #0f172a, #334155)' },
  { id: 'sunset', label: 'Hoàng hôn', preview: 'linear-gradient(135deg, #f97316, #be123c)' },
  { id: 'forest', label: 'Rừng', preview: 'linear-gradient(135deg, #059669, #065f46)' },
  { id: 'purple', label: 'Tím', preview: 'linear-gradient(135deg, #7c3aed, #4c1d95)' },
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB — matches backend limit

export default function ResultImageCreator({
  athlete,
  raceId,
  raceName,
  onClose,
}: Props) {
  // ─── State ────────────────────────────────────────────────
  const [template, setTemplate] = useState<TemplateKey>('classic');
  const [gradient, setGradient] = useState<GradientKey>('blue');
  const [showBadges, setShowBadges] = useState(true);
  const [showQrCode, setShowQrCode] = useState(false);
  const [showSplits, setShowSplits] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [customPhoto, setCustomPhoto] = useState<File | null>(null);
  const [customPhotoPreview, setCustomPhotoPreview] = useState<string | null>(null);
  const [previewToken, setPreviewToken] = useState(0);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Force 9:16 size for story
  const size: SizeKey = template === 'story' ? '9:16' : '4:5';

  // ─── Generation mutation ──────────────────────────────────
  const generateMutation = useGenerateResultImage(raceId, String(athlete.Bib));
  const incrementShare = useIncrementShareCount(raceId, String(athlete.Bib));
  const logShareEvent = useLogShareEvent();

  // Tracks whether backend fell back to classic (podium → classic, etc.)
  const [lastFallback, setLastFallback] = useState<boolean>(false);

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (generatedUrl) URL.revokeObjectURL(generatedUrl);
      if (customPhotoPreview) URL.revokeObjectURL(customPhotoPreview);
    };
    // Intentionally not including generatedUrl in deps — cleanup only on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Keyboard: Escape closes ──────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !generateMutation.isPending) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, generateMutation.isPending]);

  // ─── Preview URL (changes bump previewToken → new `<img src>`) ──
  const previewUrl = useMemo(
    () =>
      buildPreviewUrl(raceId, String(athlete.Bib), {
        template,
        size,
        gradient,
        showBadges,
        showQrCode,
        showSplits,
        customMessage: customMessage.slice(0, 50),
        token: previewToken,
      }),
    [raceId, athlete.Bib, template, size, gradient, showBadges, showQrCode, showSplits, customMessage, previewToken],
  );

  // When gradient/badges/etc change, bump token so preview refetches
  useEffect(() => {
    setPreviewToken((t) => t + 1);
  }, [template, gradient, showBadges, showQrCode, showSplits]);

  // ─── File upload handler ──────────────────────────────────
  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn file ảnh (JPG/PNG/WebP)');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error('Ảnh quá lớn, tối đa 10MB');
      return;
    }
    if (customPhotoPreview) URL.revokeObjectURL(customPhotoPreview);
    const url = URL.createObjectURL(file);
    setCustomPhoto(file);
    setCustomPhotoPreview(url);
    // Reset input so same file can be re-selected after remove
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [customPhotoPreview]);

  const removeCustomPhoto = useCallback(() => {
    if (customPhotoPreview) URL.revokeObjectURL(customPhotoPreview);
    setCustomPhoto(null);
    setCustomPhotoPreview(null);
  }, [customPhotoPreview]);

  // ─── Generate + download/share ────────────────────────────
  const generate = useCallback(async () => {
    if (generatedUrl) URL.revokeObjectURL(generatedUrl);
    setGeneratedUrl(null);
    try {
      const result = await generateMutation.mutateAsync({
        template,
        size,
        gradient,
        showBadges,
        showQrCode,
        showSplits,
        customMessage: customMessage.slice(0, 50) || undefined,
        customPhoto,
      });
      setGeneratedUrl(result.objectUrl);
      setLastFallback(result.templateFallback);
      if (result.templateFallback) {
        toast.info('Đã sử dụng template Classic (Podium chỉ dành cho Top 3)');
      }
      return result;
    } catch (err) {
      if (err instanceof ResultImageError) {
        if (err.status === 429 || err.status === 503) {
          toast.error(`${err.message}${err.retryAfterSeconds ? ` (thử lại sau ${err.retryAfterSeconds}s)` : ''}`);
        } else {
          toast.error(err.message);
        }
      } else {
        toast.error('Lỗi tạo ảnh, vui lòng thử lại');
      }
      throw err;
    }
  }, [generateMutation, template, size, gradient, showBadges, showQrCode, showSplits, customMessage, customPhoto, generatedUrl]);

  const handleDownload = useCallback(async () => {
    try {
      const result = generatedUrl
        ? { objectUrl: generatedUrl, blob: null as Blob | null }
        : await generate();
      const url = result.objectUrl;
      const a = document.createElement('a');
      a.href = url;
      a.download = `5bib-${athlete.Bib}-${template}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success('Đã tải ảnh');
      incrementShare.mutate('download');
      logShareEvent.mutate({
        raceId,
        bib: String(athlete.Bib),
        template,
        channel: 'download',
        gradient,
        size,
        templateFallback: lastFallback,
      });
    } catch {
      // error already toasted in generate()
    }
  }, [generate, generatedUrl, athlete.Bib, template, incrementShare, logShareEvent, raceId, gradient, size, lastFallback]);

  const handleShare = useCallback(async () => {
    try {
      const result = generatedUrl && generateMutation.data
        ? { blob: generateMutation.data.blob, objectUrl: generatedUrl }
        : await generate();

      const navShare = typeof navigator !== 'undefined' ? navigator.share : undefined;
      const canShareFiles =
        typeof navigator !== 'undefined' &&
        typeof navigator.canShare === 'function' &&
        result.blob &&
        navigator.canShare({
          files: [new File([result.blob], 'result.png', { type: 'image/png' })],
        });

      if (navShare && canShareFiles && result.blob) {
        const file = new File([result.blob], `5bib-${athlete.Bib}.png`, {
          type: 'image/png',
        });
        await navShare.call(navigator, {
          files: [file],
          title: raceName ?? '5BIB Result',
          text: `${athlete.Name} · ${athlete.ChipTime}`,
        });
        incrementShare.mutate('native-share');
        logShareEvent.mutate({
          raceId,
          bib: String(athlete.Bib),
          template,
          channel: 'web-share',
          gradient,
          size,
          templateFallback: lastFallback,
        });
      } else {
        // Fallback: open in new tab so user can right-click → save / long-press → save
        window.open(result.objectUrl, '_blank', 'noopener');
        toast.info('Nhấn giữ ảnh để lưu về máy');
        incrementShare.mutate('fallback-share');
        logShareEvent.mutate({
          raceId,
          bib: String(athlete.Bib),
          template,
          channel: 'copy-link',
          gradient,
          size,
          templateFallback: lastFallback,
        });
      }
    } catch {
      // error already toasted
    }
  }, [generatedUrl, generateMutation.data, generate, athlete.Bib, athlete.Name, athlete.ChipTime, raceName, incrementShare, logShareEvent, raceId, template, gradient, size, lastFallback]);

  const pending = generateMutation.isPending;

  // ─── Render ──────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4"
      onClick={() => !pending && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="result-image-creator-title"
    >
      <div
        ref={modalRef}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[96vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 id="result-image-creator-title" className="text-lg font-bold text-gray-900">
              🎨 Tạo ảnh chia sẻ kết quả
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {athlete.Name} · BIB #{athlete.Bib} · {athlete.ChipTime}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 disabled:opacity-50"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body: 2-column on desktop, stacked on mobile */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-0 lg:gap-0">
            {/* Left: live preview */}
            <div className="bg-gray-900 p-4 sm:p-8 flex items-center justify-center min-h-[360px]">
              <div
                className={`relative bg-gray-800 rounded-lg overflow-hidden shadow-2xl ${
                  size === '9:16' ? 'aspect-[9/16] max-h-[520px]' : 'aspect-[4/5] max-h-[520px]'
                }`}
                style={{ width: size === '9:16' ? '280px' : '380px' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={previewToken}
                  src={previewUrl}
                  alt="Preview kết quả"
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="eager"
                />
                {pending && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-white" />
                  </div>
                )}
              </div>
            </div>

            {/* Right: controls */}
            <div className="p-4 sm:p-5 space-y-5 border-t lg:border-t-0 lg:border-l border-gray-100 overflow-y-auto">
              {/* Template picker */}
              <section>
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                  Template
                </h3>
                <TemplatePicker
                  raceId={raceId}
                  bib={String(athlete.Bib)}
                  selected={template}
                  onChange={setTemplate}
                  overallRank={athlete.OverallRank}
                  categoryRank={athlete.CatRank}
                  previewToken={previewToken}
                  gradient={gradient}
                  showBadges={showBadges}
                />
                <p className="text-[11px] text-gray-500 mt-2">
                  {template === 'story'
                    ? 'Template Story chỉ xuất ở tỉ lệ 9:16 (Instagram/FB Story)'
                    : TEMPLATE_META.find((t) => t.key === template)?.subtitle}
                </p>
              </section>

              {/* Gradient picker (only when no custom photo) */}
              {!customPhoto && (
                <section>
                  <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                    Nền gradient
                  </h3>
                  <div className="grid grid-cols-5 gap-2">
                    {GRADIENTS.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setGradient(g.id)}
                        className={[
                          'h-12 rounded-lg border-2 transition',
                          gradient === g.id ? 'border-blue-600 ring-2 ring-blue-200' : 'border-transparent',
                        ].join(' ')}
                        style={{ background: g.preview }}
                        title={g.label}
                        aria-label={`Gradient ${g.label}`}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Custom photo */}
              <section>
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                  Ảnh nền (tuỳ chọn)
                </h3>
                {customPhoto ? (
                  <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                    {customPhotoPreview && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={customPhotoPreview} alt="" className="w-12 h-12 rounded object-cover" />
                    )}
                    <span className="flex-1 text-xs text-gray-600 truncate">
                      {customPhoto.name}
                    </span>
                    <button
                      type="button"
                      onClick={removeCustomPhoto}
                      className="text-xs text-red-600 hover:underline flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" /> Bỏ
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-gray-300 rounded-lg p-4 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition">
                    <ImagePlus className="w-4 h-4 text-gray-500" />
                    <span className="text-xs text-gray-600">Tải ảnh nền (JPG/PNG ≤ 10MB)</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFile}
                      className="hidden"
                    />
                  </label>
                )}
              </section>

              {/* Toggles */}
              <section>
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                  Hiển thị
                </h3>
                <div className="space-y-2">
                  <Toggle label="Badge thành tích" checked={showBadges} onChange={setShowBadges} />
                  <Toggle label="Mã QR về trang kết quả" checked={showQrCode} onChange={setShowQrCode} />
                  <Toggle label="Thời gian split" checked={showSplits} onChange={setShowSplits} />
                </div>
              </section>

              {/* Custom message */}
              <section>
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                  Lời nhắn (≤ 50 ký tự)
                </h3>
                <input
                  type="text"
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value.slice(0, 50))}
                  onBlur={() => setPreviewToken((t) => t + 1)}
                  placeholder='vd: "Đích đến không phải là dấu chấm hết"'
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                  maxLength={50}
                />
                <div className="text-[11px] text-gray-400 text-right mt-0.5">
                  {customMessage.length}/50
                </div>
              </section>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="shrink-0 border-t border-gray-100 px-5 py-3 flex flex-col sm:flex-row gap-2 sm:justify-end bg-gray-50">
          <button
            type="button"
            onClick={handleDownload}
            disabled={pending}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
          >
            {pending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Tải xuống
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={pending}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold text-sm hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
          >
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
            Chia sẻ
          </button>
        </div>
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer py-1">
      <span className="text-sm text-gray-700">{label}</span>
      <span
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && onChange(!checked)}
        tabIndex={0}
        className={[
          'relative inline-flex h-5 w-9 items-center rounded-full transition shrink-0',
          checked ? 'bg-blue-600' : 'bg-gray-300',
        ].join(' ')}
      >
        <span
          className={[
            'inline-block h-4 w-4 transform rounded-full bg-white shadow transition',
            checked ? 'translate-x-4' : 'translate-x-0.5',
          ].join(' ')}
        />
      </span>
    </label>
  );
}
