'use client';

/**
 * Certificate-with-photo download flow.
 *
 * UX:
 *   1. Fetch template metadata (canvas size + photo_area bounds).
 *   2. Fetch a "base" PNG from the render endpoint with ?includePhoto=false
 *      — this PNG has everything EXCEPT the athlete photo.
 *   3. User uploads a photo (or reuses athlete.avatarUrl).
 *   4. User drags + zooms the photo inside photo_area on a live canvas preview.
 *   5. On download, we composite base PNG + user photo clipped to photo_area
 *      bounds and save the final PNG.
 *
 * Everything happens client-side after step 2 — no photo ever leaves the
 * browser until the user clicks download on their own machine.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Upload, X, Download, RotateCcw, ZoomIn, ZoomOut, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

// Scale is relative to "cover fit" of the photo_area:
//   1.0  = image exactly covers the area (may crop on the longer side)
//   <1   = shrinks the image (empty space around it, inside the area)
//   >1   = zooms in (crops more aggressively)
const MIN_SCALE = 0.2;
const MAX_SCALE = 4;

interface PhotoArea {
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius: number;
}

interface Meta {
  canvas: { width: number; height: number };
  photo_area: PhotoArea | null;
  photo_behind_background: boolean;
  placeholder_photo_url: string | null;
  default_photo_url: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  raceId: string;
  bib: string | number;
  courseId?: string;
  runnerName: string;
  /** Suggested initial photo (athlete avatar). User can replace it. */
  initialPhotoUrl?: string | null;
}

export default function CertificateWithPhotoModal({
  open,
  onClose,
  raceId,
  bib,
  courseId,
  runnerName,
  initialPhotoUrl,
}: Props) {
  const { t } = useTranslation();

  const [meta, setMeta] = useState<Meta | null>(null);
  const [baseImage, setBaseImage] = useState<HTMLImageElement | null>(null);
  const [userImage, setUserImage] = useState<HTMLImageElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Photo transform (in canvas pixel coordinates, relative to photo_area origin)
  // offsetX/offsetY = where the photo center sits inside photo_area
  // scale = extra zoom on top of the "cover" fit (1 = exactly fit cover)
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    initOffX: number;
    initOffY: number;
    canvasToCssScale: number;
  }>({ active: false, startX: 0, startY: 0, initOffX: 0, initOffY: 0, canvasToCssScale: 1 });

  // Load an image as HTMLImageElement from URL (string) or Blob/File
  const loadImage = useCallback((src: string | Blob): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Image load failed'));
      const url = typeof src === 'string' ? src : URL.createObjectURL(src);
      img.src = url;
      // We don't revoke ObjectURLs here — image stays alive for preview.
    });
  }, []);

  // Fetch meta + base PNG when modal opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setLoading(true);
    setScale(1);
    setOffsetX(0);
    setOffsetY(0);

    (async () => {
      try {
        const qs = new URLSearchParams({ type: 'certificate' });
        if (courseId) qs.set('courseId', courseId);

        const metaRes = await fetch(
          `/api/certificates/render-meta/${raceId}/${bib}?${qs.toString()}`,
        );
        if (!metaRes.ok) throw new Error(`Meta HTTP ${metaRes.status}`);
        const metaJson = (await metaRes.json()) as Meta;

        const baseQs = new URLSearchParams(qs);
        baseQs.set('includePhoto', 'false');
        const baseRes = await fetch(
          `/api/certificates/render/${raceId}/${bib}?${baseQs.toString()}`,
        );
        if (!baseRes.ok) throw new Error(`Base HTTP ${baseRes.status}`);
        const blob = await baseRes.blob();
        const base = await loadImage(blob);

        if (cancelled) return;
        setMeta(metaJson);
        setBaseImage(base);

        // Pre-load athlete avatar if provided
        const seedUrl = initialPhotoUrl || metaJson.default_photo_url;
        if (seedUrl) {
          try {
            const seedBlob = await fetch(seedUrl).then((r) =>
              r.ok ? r.blob() : Promise.reject(new Error('seed fetch failed')),
            );
            const seed = await loadImage(seedBlob);
            if (!cancelled) setUserImage(seed);
          } catch {
            /* ignore — user can upload their own */
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'load failed');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, raceId, bib, courseId, initialPhotoUrl, loadImage]);

  const handleFilePick = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Ảnh tối đa 10MB');
        return;
      }
      try {
        const img = await loadImage(file);
        setUserImage(img);
        setScale(1);
        setOffsetX(0);
        setOffsetY(0);
      } catch {
        toast.error('Không đọc được ảnh');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [loadImage],
  );

  // ─── Core draw: composite base + clipped photo at current transform ───
  const drawPreview = useCallback(
    (target: HTMLCanvasElement, showOutline = false) => {
      if (!meta || !baseImage) return;
      const ctx = target.getContext('2d');
      if (!ctx) return;
      const { width: W, height: H } = meta.canvas;
      target.width = W;
      target.height = H;

      const photoArea = meta.photo_area;
      const behind = meta.photo_behind_background && photoArea;

      ctx.clearRect(0, 0, W, H);

      if (behind && userImage && photoArea) {
        drawClippedPhoto(ctx, userImage, photoArea, scale, offsetX, offsetY);
        ctx.drawImage(baseImage, 0, 0, W, H);
      } else {
        ctx.drawImage(baseImage, 0, 0, W, H);
        if (userImage && photoArea) {
          drawClippedPhoto(ctx, userImage, photoArea, scale, offsetX, offsetY);
        }
      }

      // Preview-only: dashed outline showing the photo area boundary.
      // Not drawn on the downloadable composite.
      if (showOutline && photoArea) {
        ctx.save();
        ctx.setLineDash([Math.max(10, W / 120), Math.max(6, W / 200)]);
        ctx.lineWidth = Math.max(2, W / 600);
        ctx.strokeStyle = 'rgba(37, 99, 235, 0.9)';
        const r = Math.min(
          photoArea.borderRadius ?? 0,
          photoArea.width / 2,
          photoArea.height / 2,
        );
        if (r > 0) {
          pathRoundedRect(
            ctx,
            photoArea.x,
            photoArea.y,
            photoArea.width,
            photoArea.height,
            r,
          );
          ctx.stroke();
        } else {
          ctx.strokeRect(
            photoArea.x,
            photoArea.y,
            photoArea.width,
            photoArea.height,
          );
        }
        ctx.restore();
      }
    },
    [meta, baseImage, userImage, scale, offsetX, offsetY],
  );

  // Re-render preview whenever inputs change (with outline)
  useEffect(() => {
    if (previewRef.current) drawPreview(previewRef.current, true);
  }, [drawPreview]);

  // ─── Drag handlers ────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!meta?.photo_area || !userImage) return;
    const canvas = e.currentTarget;
    canvas.setPointerCapture(e.pointerId);
    const rect = canvas.getBoundingClientRect();
    const canvasToCssScale = rect.width / meta.canvas.width;
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      initOffX: offsetX,
      initOffY: offsetY,
      canvasToCssScale,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    if (!d.active) return;
    const dx = (e.clientX - d.startX) / d.canvasToCssScale;
    const dy = (e.clientY - d.startY) / d.canvasToCssScale;
    setOffsetX(d.initOffX + dx);
    setOffsetY(d.initOffY + dy);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current.active = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!meta?.photo_area || !userImage) return;
    e.preventDefault();
    const delta = -e.deltaY;
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * (1 + delta / 800)));
    setScale(next);
  };

  const resetTransform = () => {
    setScale(1);
    setOffsetX(0);
    setOffsetY(0);
  };

  const handleDownload = useCallback(() => {
    if (!meta || !baseImage) return;
    setDownloading(true);
    try {
      // Render at full template resolution to an offscreen canvas
      // (without the dashed outline — that's preview-only).
      const off = document.createElement('canvas');
      off.width = meta.canvas.width;
      off.height = meta.canvas.height;
      drawPreview(off, false);
      off.toBlob((blob) => {
        if (!blob) {
          toast.error('Không tạo được ảnh');
          setDownloading(false);
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safe = (runnerName || 'runner').replace(/\s+/g, '-');
        a.download = `certificate-${safe}-BIB${bib}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Đã tải chứng nhận');
        setDownloading(false);
        onClose();
      }, 'image/png');
    } catch (err) {
      console.error(err);
      toast.error('Tải thất bại');
      setDownloading(false);
    }
  }, [meta, baseImage, drawPreview, runnerName, bib, onClose]);

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  const hasPhotoArea = !!meta?.photo_area;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Tải chứng nhận kèm ảnh</h2>
            <p className="text-xs text-gray-500">
              Tải ảnh lên, kéo/zoom để chỉnh vị trí, rồi tải certificate kèm ảnh về máy.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          )}
          {error && !loading && (
            <div className="text-center py-10">
              <p className="text-red-600 font-semibold mb-2">Không tải được template</p>
              <p className="text-xs text-gray-500">{error}</p>
            </div>
          )}
          {!loading && !error && meta && baseImage && (
            <div className="space-y-4">
              {!hasPhotoArea && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
                  Template này không có vùng ảnh VĐV. Bạn có thể tải ngay file gốc bên dưới.
                </div>
              )}

              {/* Canvas preview — clickable drag area */}
              <div className="rounded-lg overflow-hidden border border-gray-200 bg-[repeating-conic-gradient(#f3f4f6_0%_25%,#ffffff_0%_50%)_50%/16px_16px]">
                <canvas
                  ref={previewRef}
                  className="w-full h-auto block touch-none select-none"
                  style={{
                    cursor: hasPhotoArea && userImage ? 'grab' : 'default',
                    aspectRatio: `${meta.canvas.width} / ${meta.canvas.height}`,
                  }}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  onWheel={onWheel}
                />
              </div>

              {/* Controls */}
              {hasPhotoArea && (
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleFilePick}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
                  >
                    <Upload className="w-4 h-4" />
                    {userImage ? 'Đổi ảnh khác' : 'Tải ảnh lên'}
                  </button>
                  {userImage && (
                    <>
                      <button
                        onClick={() => setScale((s) => Math.max(MIN_SCALE, s / 1.2))}
                        className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200"
                        title="Thu nhỏ"
                      >
                        <ZoomOut className="w-4 h-4" />
                      </button>
                      <input
                        type="range"
                        min={MIN_SCALE}
                        max={MAX_SCALE}
                        step={0.01}
                        value={scale}
                        onChange={(e) => setScale(Number(e.target.value))}
                        className="w-48"
                      />
                      <button
                        onClick={() => setScale((s) => Math.min(MAX_SCALE, s * 1.2))}
                        className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200"
                        title="Phóng to"
                      >
                        <ZoomIn className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-mono text-gray-500 w-12 text-right tabular-nums">
                        {Math.round(scale * 100)}%
                      </span>
                      <button
                        onClick={resetTransform}
                        className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200"
                        title="Về mặc định"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <span className="text-xs text-gray-500 ml-auto">
                        Kéo ảnh để dịch chuyển, lăn chuột hoặc dùng thanh trượt để zoom
                      </span>
                    </>
                  )}
                  {!userImage && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Camera className="w-3.5 h-3.5" />
                      Chưa có ảnh — đang dùng placeholder của template
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-100"
          >
            Hủy
          </button>
          <button
            onClick={handleDownload}
            disabled={loading || !meta || !baseImage || downloading}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-semibold"
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Tải về
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Draw userImage inside photo_area with "cover" fit + scale + offset, clipped. */
function drawClippedPhoto(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  area: PhotoArea,
  scale: number,
  offsetX: number,
  offsetY: number,
) {
  const { x, y, width: aw, height: ah, borderRadius } = area;

  ctx.save();
  // Clip to photo_area (circle / rounded-rect / rect)
  const r = Math.min(borderRadius ?? 0, aw / 2, ah / 2);
  pathRoundedRect(ctx, x, y, aw, ah, r);
  ctx.clip();

  // Compute cover fit for photo inside area, then multiply by user scale
  const coverScale = Math.max(aw / img.width, ah / img.height);
  const drawScale = coverScale * scale;
  const dw = img.width * drawScale;
  const dh = img.height * drawScale;
  const cx = x + aw / 2 + offsetX;
  const cy = y + ah / 2 + offsetY;
  ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);

  ctx.restore();
}

function pathRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  if (r >= Math.min(w, h) / 2 - 0.5) {
    // Perfect ellipse / circle
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  } else if (r > 0) {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  } else {
    ctx.rect(x, y, w, h);
  }
  ctx.closePath();
}
