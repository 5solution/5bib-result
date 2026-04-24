'use client';

/**
 * PhotoCropEditor — lets users pan and zoom a photo before it is used as a
 * result-image background.
 *
 * Interactions:
 *  - Mouse drag to pan
 *  - Scroll wheel to zoom (zooms around cursor position)
 *  - Two-finger pinch to zoom on touch devices
 *  - One-finger drag to pan on touch devices
 *
 * On confirm the visible crop area is exported as a JPEG Blob at 3× the
 * preview canvas resolution (~840–960 px wide) — good quality, reasonable size.
 *
 * The canvas is always cover-filled: the image can never leave the viewport
 * edges exposed (clampOffset enforces this).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, Check, RotateCcw } from 'lucide-react';

export interface PhotoCropEditorProps {
  /** Original file the user selected. */
  file: File;
  /** width / height of the target template canvas (e.g. 4/5, 1/1, 9/16). */
  aspectRatio: number;
  onConfirm: (cropped: Blob) => void;
  onCancel: () => void;
}

/** Preview canvas width in CSS px. Height is derived from aspectRatio. */
const PREVIEW_W = 300;

export default function PhotoCropEditor({
  file,
  aspectRatio,
  onConfirm,
  onCancel,
}: PhotoCropEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const previewH = Math.round(PREVIEW_W / aspectRatio);

  // ─── State ────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  // Persistent refs so touch/drag handlers never capture stale state
  const stateRef = useRef({ zoom: 1, ox: 0, oy: 0 });
  useEffect(() => { stateRef.current = { zoom, ox: offset.x, oy: offset.y }; }, [zoom, offset]);

  const dragOrigin = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);

  // ─── Load image ───────────────────────────────────────────
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      // Cover-fit: fill viewport with no white space
      const initZoom = Math.max(PREVIEW_W / img.width, previewH / img.height);
      const ox = (PREVIEW_W - img.width * initZoom) / 2;
      const oy = (previewH - img.height * initZoom) / 2;
      setZoom(initZoom);
      setOffset({ x: ox, y: oy });
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file, previewH]);

  // ─── Draw ─────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, PREVIEW_W, previewH);
    ctx.drawImage(
      img,
      0, 0, img.width, img.height,
      offset.x, offset.y, img.width * zoom, img.height * zoom,
    );

    // Rule-of-thirds grid overlay
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 0.5;
    for (let i = 1; i < 3; i++) {
      const x = (PREVIEW_W / 3) * i;
      const y = (previewH / 3) * i;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, previewH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(PREVIEW_W, y); ctx.stroke();
    }
  }, [zoom, offset, previewH]);

  // ─── Clamp offset so the image always covers the viewport ─
  const clamp = useCallback((ox: number, oy: number, z: number) => {
    const img = imgRef.current;
    if (!img) return { x: ox, y: oy };
    const iw = img.width * z;
    const ih = img.height * z;
    return {
      x: Math.min(0, Math.max(ox, PREVIEW_W - iw)),
      y: Math.min(0, Math.max(oy, previewH - ih)),
    };
  }, [previewH]);

  // ─── Zoom around a point (cx, cy in canvas-local px) ──────
  const applyZoom = useCallback((newZoom: number, cx: number, cy: number) => {
    const img = imgRef.current;
    if (!img) return;
    const minZoom = Math.max(PREVIEW_W / img.width, previewH / img.height);
    const z = Math.max(minZoom, Math.min(newZoom, 8));
    const { ox, oy } = stateRef.current;
    const scale = z / stateRef.current.zoom;
    const nx = cx - scale * (cx - ox);
    const ny = cy - scale * (cy - oy);
    setZoom(z);
    setOffset(clamp(nx, ny, z));
  }, [previewH, clamp]);

  // ─── Mouse ────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setDragging(true);
    dragOrigin.current = { mx: e.clientX, my: e.clientY, ox: stateRef.current.ox, oy: stateRef.current.oy };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragOrigin.current.mx;
    const dy = e.clientY - dragOrigin.current.my;
    setOffset(clamp(dragOrigin.current.ox + dx, dragOrigin.current.oy + dy, stateRef.current.zoom));
  }, [dragging, clamp]);

  const handleMouseUp = useCallback(() => setDragging(false), []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (PREVIEW_W / rect.width);
    const cy = (e.clientY - rect.top) * (previewH / rect.height);
    applyZoom(stateRef.current.zoom * (e.deltaY < 0 ? 1.12 : 0.9), cx, cy);
  }, [previewH, applyZoom]);

  // ─── Touch ────────────────────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const t = e.touches[0];
      dragOrigin.current = { mx: t.clientX, my: t.clientY, ox: stateRef.current.ox, oy: stateRef.current.oy };
      pinchRef.current = null;
    } else if (e.touches.length === 2) {
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      pinchRef.current = { dist: Math.hypot(dx, dy), zoom: stateRef.current.zoom };
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1 && !pinchRef.current) {
      const t = e.touches[0];
      const dx = t.clientX - dragOrigin.current.mx;
      const dy = t.clientY - dragOrigin.current.my;
      setOffset(clamp(dragOrigin.current.ox + dx, dragOrigin.current.oy + dy, stateRef.current.zoom));
    } else if (e.touches.length === 2 && pinchRef.current) {
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      const dist = Math.hypot(dx, dy);
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const lcx = (cx - rect.left) * (PREVIEW_W / rect.width);
      const lcy = (cy - rect.top) * (previewH / rect.height);
      applyZoom(pinchRef.current.zoom * (dist / pinchRef.current.dist), lcx, lcy);
    }
  }, [clamp, applyZoom, previewH]);

  const handleTouchEnd = useCallback(() => { pinchRef.current = null; }, []);

  // ─── Zoom buttons ─────────────────────────────────────────
  const zoomIn  = useCallback(() => applyZoom(stateRef.current.zoom * 1.25, PREVIEW_W / 2, previewH / 2), [applyZoom, previewH]);
  const zoomOut = useCallback(() => applyZoom(stateRef.current.zoom * 0.8,  PREVIEW_W / 2, previewH / 2), [applyZoom, previewH]);

  const resetCrop = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    const initZoom = Math.max(PREVIEW_W / img.width, previewH / img.height);
    const ox = (PREVIEW_W - img.width * initZoom) / 2;
    const oy = (previewH - img.height * initZoom) / 2;
    setZoom(initZoom);
    setOffset({ x: ox, y: oy });
  }, [previewH]);

  // ─── Export ───────────────────────────────────────────────
  const handleConfirm = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    // Export at 3× preview resolution for good quality
    const exportW = PREVIEW_W * 3;
    const exportH = Math.round(exportW / aspectRatio);
    const offscreen = document.createElement('canvas');
    offscreen.width = exportW;
    offscreen.height = exportH;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;
    const s = exportW / PREVIEW_W;
    ctx.drawImage(
      img,
      0, 0, img.width, img.height,
      offset.x * s, offset.y * s, img.width * zoom * s, img.height * zoom * s,
    );
    offscreen.toBlob((blob) => { if (blob) onConfirm(blob); }, 'image/jpeg', 0.93);
  }, [offset, zoom, aspectRatio, onConfirm]);

  return (
    <div className="space-y-2">
      {/* Canvas crop area */}
      <div className="relative rounded-lg overflow-hidden bg-black select-none">
        <canvas
          ref={canvasRef}
          width={PREVIEW_W}
          height={previewH}
          className={`block w-full touch-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
        {/* Zoom controls — top-right corner */}
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          <button
            type="button"
            onClick={zoomIn}
            className="w-7 h-7 rounded-md bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70"
            aria-label="Phóng to"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={zoomOut}
            className="w-7 h-7 rounded-md bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70"
            aria-label="Thu nhỏ"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={resetCrop}
            className="w-7 h-7 rounded-md bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70"
            aria-label="Reset"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
        {/* Hint */}
        <div className="absolute bottom-1.5 inset-x-0 flex justify-center pointer-events-none">
          <span className="text-[10px] text-white/70 bg-black/40 px-2 py-0.5 rounded-full">
            Kéo để di chuyển · Cuộn / pinch để zoom
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition"
        >
          Huỷ
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-1.5 transition"
        >
          <Check className="w-3.5 h-3.5" />
          Áp dụng
        </button>
      </div>
    </div>
  );
}
