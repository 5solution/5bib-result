'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Download, Loader2, ImagePlus, RotateCcw, Share2, ChevronLeft, ChevronRight, ChevronDown, Check } from 'lucide-react';
import { toast } from 'sonner';
import TemplatePicker, { TEMPLATE_META } from './TemplatePicker';
import PhotoCropEditor from './PhotoCropEditor';
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
  // Only updated when user explicitly clicks ✓ — drives GET preview URL and
  // auto-gen POSTs. customMessage is the live input; appliedMessage is the
  // "committed" value that actually reaches the server.
  const [appliedMessage, setAppliedMessage] = useState('');
  // Ref keeps appliedMessage readable inside effects without adding to their dep array
  const appliedMessageRef = useRef('');
  const [customPhoto, setCustomPhoto] = useState<File | null>(null);
  const [customPhotoPreview, setCustomPhotoPreview] = useState<string | null>(null);
  // Blob output from the crop editor (null = not cropped yet)
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [previewToken, setPreviewToken] = useState(0);
  // Mobile UX: template section collapsed by default (user swipes the preview to switch)
  const [templateSectionOpen, setTemplateSectionOpen] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const touchStartXRef = useRef<number | null>(null);
  // Monotonically-increasing counter: each generate() or auto-gen claims a slot.
  // Any older in-flight request sees a stale ID on resolve and self-discards.
  const generationIdRef = useRef(0);
  // True while the crop editor is open (customPhoto set but crop not confirmed).
  // Settings-change effect reads this ref to skip auto-gen POSTs while the user
  // hasn't committed a crop yet — prevents posting the raw uncropped file.
  const cropPendingRef = useRef(false);

  // Force 9:16 size for story
  const size: SizeKey = template === 'story' ? '9:16' : '4:5';
  // Aspect ratio (width / height) passed to the crop editor canvas
  const aspectRatio = size === '9:16' ? 9 / 16 : 4 / 5;

  // ─── Generation mutation ──────────────────────────────────
  // Declared early so swipe callbacks can read isPending without TDZ issues.
  const generateMutation = useGenerateResultImage(raceId, String(athlete.Bib));
  const incrementShare = useIncrementShareCount(raceId, String(athlete.Bib));
  const logShareEvent = useLogShareEvent();

  // ─── Template carousel navigation (mobile swipe) ──────────
  const TEMPLATE_KEYS = TEMPLATE_META.map((t) => t.key) as TemplateKey[];
  const currentTemplateIdx = TEMPLATE_KEYS.indexOf(template);

  const goToPrevTemplate = useCallback(() => {
    if (generateMutation.isPending) return;
    const idx = TEMPLATE_KEYS.indexOf(template);
    setTemplate(TEMPLATE_KEYS[(idx - 1 + TEMPLATE_KEYS.length) % TEMPLATE_KEYS.length]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, generateMutation.isPending]);

  const goToNextTemplate = useCallback(() => {
    if (generateMutation.isPending) return;
    const idx = TEMPLATE_KEYS.indexOf(template);
    setTemplate(TEMPLATE_KEYS[(idx + 1) % TEMPLATE_KEYS.length]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, generateMutation.isPending]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartXRef.current;
    touchStartXRef.current = null;
    if (Math.abs(dx) < 50) return; // ignore taps / micro-drags
    if (dx < 0) goToNextTemplate(); // swipe left → next
    else goToPrevTemplate();        // swipe right → prev
  }, [goToNextTemplate, goToPrevTemplate]);

  // Tracks whether backend fell back to classic (podium → classic, etc.)
  const [lastFallback, setLastFallback] = useState<boolean>(false);

  // Ref so the settings-change effect can always read the latest effective photo
  // (croppedBlob if crop is confirmed, else the raw file) without adding either
  // to the effect's dep array (which would cause loops).
  // Updated SYNCHRONOUSLY inside every handler that changes photo state
  // (handleFile, handleCropConfirm, removeCustomPhoto) — never via useEffect,
  // which would leave a 1-frame async gap where the ref is stale.
  const effectivePhotoRef = useRef<File | Blob | null>(null);
  // Keep appliedMessageRef in sync so effects can read it without stale closures
  useEffect(() => { appliedMessageRef.current = appliedMessage; }, [appliedMessage]);

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
  // Uses appliedMessage (not raw customMessage) so GET preview only fires
  // when the user explicitly clicks ✓, NOT on every keystroke.
  const previewUrl = useMemo(
    () =>
      buildPreviewUrl(raceId, String(athlete.Bib), {
        template,
        size,
        gradient,
        showBadges,
        showQrCode,
        showSplits,
        customMessage: appliedMessage,
        token: previewToken,
      }),
    [raceId, athlete.Bib, template, size, gradient, showBadges, showQrCode, showSplits, appliedMessage, previewToken],
  );

  // Debounce the main preview img — 350ms after last settings change.
  // Prevents spamming the server when users click through templates quickly.
  // TemplatePicker thumbnails use previewToken directly (not debounced) so
  // they still update immediately for that grid.
  const [debouncedPreviewUrl, setDebouncedPreviewUrl] = useState(previewUrl);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedPreviewUrl(previewUrl), 350);
    return () => clearTimeout(id);
  }, [previewUrl]);

  // When template / gradient / toggles change:
  //  - Always bump previewToken  → GET preview refetches (no-photo path)
  //  - If custom photo active    → debounce 500ms then POST with current settings.
  //    Generation ID ensures out-of-order / stale responses are discarded so
  //    rapid template clicks never produce broken or wrong previews.
  //
  // NOTE: neither customMessage nor appliedMessage is in the deps array.
  //   - GET preview (no photo): previewUrl useMemo uses appliedMessage — only
  //     updates when user clicks ✓, never on keystroke.
  //   - Photo POST: appliedMessageRef.current is read at fire time.
  //     Applying a message is handled exclusively by handleApplyMessage.
  useEffect(() => {
    setPreviewToken((t) => t + 1);

    const file = effectivePhotoRef.current;
    if (!file) {
      setGeneratedUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
      return;
    }

    // Crop editor is open → user hasn't confirmed a crop yet. Skip auto-gen:
    // posting the raw uncropped file here would produce a wrong/confusing result.
    // handleCropConfirm will trigger the first POST once the user confirms.
    if (cropPendingRef.current) return;

    // Claim this generation slot — any in-flight request from a prior settings
    // change will see a stale ID on resolve and self-discard its blob URL.
    const myId = ++generationIdRef.current;
    // Clear the old result so the GET preview (correct template, no photo) shows
    // immediately while the new photo-POST is in flight. This gives instant visual
    // feedback that the template changed. The photo result replaces it when ready.
    // (Keeping the old blob here made it look like template switching was broken.)
    setGeneratedUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });

    // Debounce: rapid template / gradient clicks only fire ONE POST, 500ms
    // after the user settles on a choice.
    const tid = setTimeout(() => {
      if (generationIdRef.current !== myId) return; // superseded by newer change
      void generateMutation.mutateAsync({
        template,
        size,
        gradient,
        showBadges,
        showQrCode,
        showSplits,
        customMessage: appliedMessageRef.current || undefined, // ref read — only applied messages
        customPhoto: file,
      }).then((result) => {
        if (generationIdRef.current !== myId) {
          URL.revokeObjectURL(result.objectUrl); // discard stale result
          return;
        }
        // Atomically swap: revoke old blob + set new one in a single setState call
        setGeneratedUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return result.objectUrl; });
        setLastFallback(result.templateFallback);
      }).catch(() => {});
    }, 500);

    return () => clearTimeout(tid);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, gradient, showBadges, showQrCode, showSplits]);

  // ─── Apply message (explicit submit — no auto-fire per keystroke) ────
  // GET preview (no photo): previewUrl already includes customMessage via useMemo → bumping
  // previewToken refreshes it immediately without a POST.
  // Photo POST: user explicitly applies the message, fires a single POST with current settings.
  const handleApplyMessage = useCallback(() => {
    const msg = customMessage.slice(0, 50);

    // Commit the message — this updates appliedMessage state which:
    //   (a) recomputes previewUrl → fires GET preview for no-photo path
    //   (b) updates appliedMessageRef so future auto-gen POSTs use it
    appliedMessageRef.current = msg;
    setAppliedMessage(msg);

    // If photo active → POST with the new applied message immediately.
    // NOTE: do NOT clear generatedUrl before the POST — keep the current photo
    // preview visible while the server regenerates. Atomically swap old→new when
    // the result arrives (same pattern as the settings-change effect).
    const file = effectivePhotoRef.current;
    if (!file) return;
    const myId = ++generationIdRef.current;
    void generateMutation.mutateAsync({
      template,
      size,
      gradient,
      showBadges,
      showQrCode,
      showSplits,
      customMessage: msg || undefined,
      customPhoto: file,
    }).then((result) => {
      if (generationIdRef.current !== myId) {
        URL.revokeObjectURL(result.objectUrl);
        return;
      }
      setGeneratedUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return result.objectUrl; });
      setLastFallback(result.templateFallback);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generateMutation, template, size, gradient, showBadges, showQrCode, showSplits, customMessage]);

  // ─── File upload handler ──────────────────────────────────
  /**
   * File picked → open the crop editor.
   * We do NOT auto-generate here; generation happens after crop is confirmed
   * so users can adjust framing before burning a server round-trip.
   */
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
    const thumbUrl = URL.createObjectURL(file);
    effectivePhotoRef.current = file; // sync — settings-change effect reads this immediately
    cropPendingRef.current = true;    // block auto-gen until crop is confirmed
    setCustomPhoto(file);
    setCustomPhotoPreview(thumbUrl);
    setCroppedBlob(null); // reset any previous crop so editor opens
    // Reset input so the same file can be re-selected after remove
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [customPhotoPreview]);

  /**
   * Crop confirmed → receive JPEG blob, fire POST generate immediately.
   */
  const handleCropConfirm = useCallback(async (blob: Blob) => {
    // Sync refs first — settings-change effect reads both immediately.
    effectivePhotoRef.current = blob;
    cropPendingRef.current = false; // crop confirmed — auto-gen is allowed now
    setCroppedBlob(blob);
    // Claim generation ID so any in-flight crop POST doesn't overwrite a later
    // template-switch result if the user switches templates before this resolves.
    const myId = ++generationIdRef.current;
    setGeneratedUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    try {
      const result = await generateMutation.mutateAsync({
        template,
        size,
        gradient,
        showBadges,
        showQrCode,
        showSplits,
        customMessage: appliedMessageRef.current || undefined,
        customPhoto: blob,
      });
      // Discard if a newer generation (e.g. template switch) beat us.
      if (generationIdRef.current !== myId) {
        URL.revokeObjectURL(result.objectUrl);
        return;
      }
      setGeneratedUrl(result.objectUrl);
      setLastFallback(result.templateFallback);
    } catch {
      // error toast already handled by generate()
    }
  }, [generateMutation, template, size, gradient, showBadges, showQrCode, showSplits]);

  const removeCustomPhoto = useCallback(() => {
    effectivePhotoRef.current = null; // sync — must clear before next settings-change effect
    cropPendingRef.current = false;
    ++generationIdRef.current; // cancel any in-flight auto-gen POST
    if (customPhotoPreview) URL.revokeObjectURL(customPhotoPreview);
    // Functional update — always gets the current generatedUrl even if stale in closure
    setGeneratedUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    setCustomPhoto(null);
    setCustomPhotoPreview(null);
    setCroppedBlob(null);
    // Bump token so the GET preview img refetches without the custom photo
    setPreviewToken((t) => t + 1);
  }, [customPhotoPreview]);

  // ─── Generate + download/share ────────────────────────────
  const generate = useCallback(async () => {
    // Claim generation slot — any queued debounced auto-gen will see a stale
    // ID and self-abort before firing its POST.
    ++generationIdRef.current;
    // Functional update — always gets the latest generatedUrl regardless of closure staleness
    setGeneratedUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    try {
      const result = await generateMutation.mutateAsync({
        template,
        size,
        gradient,
        showBadges,
        showQrCode,
        showSplits,
        customMessage: appliedMessageRef.current || undefined,
        customPhoto: croppedBlob ?? customPhoto,
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
  }, [generateMutation, template, size, gradient, showBadges, showQrCode, showSplits, croppedBlob, customPhoto]);

  const handleDownload = useCallback(async () => {
    try {
      // Always generate fresh — guarantees current settings (including
      // customMessage) are applied. generate() self-revokes any stale blob.
      const result = await generate();
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
  }, [generate, athlete.Bib, template, incrementShare, logShareEvent, raceId, gradient, size, lastFallback]);

  const handleShare = useCallback(async () => {
    try {
      // Always generate fresh — ensures current settings are applied and
      // we always have a Blob for Web Share API (no stale URL reuse).
      const result = await generate();

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
  }, [generate, athlete.Bib, athlete.Name, athlete.ChipTime, raceName, incrementShare, logShareEvent, raceId, template, gradient, size, lastFallback]);

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
            {/* Left: live preview — touch area for swipe-to-change-template */}
            <div
              className="bg-gray-900 p-4 sm:p-8 flex flex-col items-center justify-center min-h-[360px] select-none"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <div
                className={`relative bg-gray-800 rounded-lg overflow-hidden shadow-2xl ${
                  size === '9:16' ? 'aspect-[9/16] max-h-[520px]' : 'aspect-[4/5] max-h-[520px]'
                }`}
                style={{ width: size === '9:16' ? '280px' : '380px' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  // When a custom photo is uploaded we auto-generate via POST
                  // and store the blob URL in `generatedUrl`. The GET preview
                  // endpoint is query-params-only so it cannot show custom photos.
                  key={generatedUrl ?? debouncedPreviewUrl}
                  src={generatedUrl ?? debouncedPreviewUrl}
                  alt="Preview kết quả"
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="eager"
                />
                {pending && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-white" />
                  </div>
                )}
                {/* Template name pill — mobile only, fades on top of image */}
                <div className="lg:hidden absolute bottom-2 inset-x-0 flex justify-center pointer-events-none">
                  <span className="bg-black/55 backdrop-blur-sm text-white text-[11px] font-medium px-3 py-1 rounded-full">
                    {TEMPLATE_META[currentTemplateIdx]?.label}
                  </span>
                </div>
              </div>

              {/* ── Mobile dot navigator ── */}
              <div className="lg:hidden mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={goToPrevTemplate}
                  disabled={pending}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 flex items-center justify-center text-white disabled:opacity-40 transition"
                  aria-label="Template trước"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-1.5" role="tablist" aria-label="Chọn template">
                  {TEMPLATE_META.map((t, i) => (
                    <button
                      key={t.key}
                      type="button"
                      role="tab"
                      aria-selected={i === currentTemplateIdx}
                      aria-label={t.label}
                      onClick={() => !pending && setTemplate(t.key)}
                      disabled={pending}
                      className={[
                        'rounded-full transition-all duration-200',
                        i === currentTemplateIdx
                          ? 'w-5 h-2 bg-white'
                          : 'w-2 h-2 bg-white/40 hover:bg-white/60',
                      ].join(' ')}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={goToNextTemplate}
                  disabled={pending}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 flex items-center justify-center text-white disabled:opacity-40 transition"
                  aria-label="Template tiếp theo"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Right: controls */}
            <div className="p-4 sm:p-5 space-y-5 border-t lg:border-t-0 lg:border-l border-gray-100 overflow-y-auto">
              {/* Template picker — collapsible on mobile, always open on desktop */}
              <section>
                <button
                  type="button"
                  className="w-full flex items-center justify-between lg:cursor-default"
                  onClick={() => setTemplateSectionOpen((o) => !o)}
                  aria-expanded={templateSectionOpen}
                >
                  <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                    Template
                    <span className="lg:hidden ml-2 text-[10px] font-normal normal-case text-gray-400">
                      {TEMPLATE_META.find((t) => t.key === template)?.label}
                    </span>
                  </h3>
                  <ChevronDown
                    className={[
                      'w-4 h-4 text-gray-400 transition-transform duration-200 lg:hidden',
                      templateSectionOpen ? 'rotate-180' : '',
                    ].join(' ')}
                  />
                </button>

                {/* Visible always on desktop (lg:block), toggled on mobile */}
                <div className={[
                  'mt-2',
                  templateSectionOpen ? 'block' : 'hidden',
                  'lg:block',
                ].join(' ')}>
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
                </div>
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

                {/* ── State 1: photo picked, crop not yet confirmed → show editor ── */}
                {customPhoto && !croppedBlob ? (
                  <PhotoCropEditor
                    file={customPhoto}
                    aspectRatio={aspectRatio}
                    onConfirm={handleCropConfirm}
                    onCancel={removeCustomPhoto}
                  />
                ) : customPhoto && croppedBlob ? (
                  /* ── State 2: crop confirmed → thumbnail + action buttons ── */
                  <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                    {customPhotoPreview && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={customPhotoPreview} alt="" className="w-12 h-12 rounded object-cover shrink-0" />
                    )}
                    <span className="flex-1 text-xs text-gray-600 truncate min-w-0">
                      {customPhoto.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        // Reset to raw file — crop not confirmed, block auto-gen
                        effectivePhotoRef.current = customPhoto;
                        cropPendingRef.current = true;
                        setCroppedBlob(null);
                      }}
                      className="text-xs text-blue-600 hover:underline whitespace-nowrap shrink-0"
                    >
                      Chỉnh lại
                    </button>
                    <button
                      type="button"
                      onClick={removeCustomPhoto}
                      className="text-xs text-red-600 hover:underline flex items-center gap-1 shrink-0"
                    >
                      <RotateCcw className="w-3 h-3" /> Bỏ
                    </button>
                  </div>
                ) : (
                  /* ── State 3: no photo → upload button ── */
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
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value.slice(0, 50))}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleApplyMessage(); }}
                    placeholder='vd: "Đích đến không phải là dấu chấm hết"'
                    className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                    maxLength={50}
                  />
                  <button
                    type="button"
                    onClick={handleApplyMessage}
                    disabled={pending}
                    title="Áp dụng lời nhắn"
                    className="shrink-0 w-9 h-9 rounded-lg bg-blue-100 hover:bg-blue-200 active:bg-blue-300 text-blue-700 flex items-center justify-center disabled:opacity-50 transition"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-1 flex justify-between">
                  <span>Nhấn ✓ hoặc Enter để áp dụng lên ảnh</span>
                  <span>{customMessage.length}/50</span>
                </p>
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
