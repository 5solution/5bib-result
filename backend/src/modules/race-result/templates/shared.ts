import type { SKRSContext2D } from '@napi-rs/canvas';
import { GRADIENT_STOPS } from './types';
import type { RenderData } from './types';

export function drawRoundedRect(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

export function fillGradientBackground(
  ctx: SKRSContext2D,
  data: RenderData,
): void {
  const stops = GRADIENT_STOPS[data.gradientPreset] ?? GRADIENT_STOPS.blue;
  const grad = ctx.createLinearGradient(0, 0, data.canvasWidth, data.canvasHeight);
  for (const [pos, color] of stops) {
    grad.addColorStop(pos, color);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, data.canvasWidth, data.canvasHeight);
}

/**
 * Draw a custom photo as cover-fit background with dark overlay for text readability.
 */
export function fillCustomPhotoBackground(
  ctx: SKRSContext2D,
  data: RenderData,
  overlayAlpha = 0.45,
): void {
  if (!data.customPhoto) {
    fillGradientBackground(ctx, data);
    return;
  }
  const img = data.customPhoto;
  const scale = Math.max(
    data.canvasWidth / img.width,
    data.canvasHeight / img.height,
  );
  const sw = data.canvasWidth / scale;
  const sh = data.canvasHeight / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, data.canvasWidth, data.canvasHeight);
  if (overlayAlpha > 0) {
    ctx.fillStyle = `rgba(0,0,0,${overlayAlpha})`;
    ctx.fillRect(0, 0, data.canvasWidth, data.canvasHeight);
  }
}

/**
 * Word-wrap text to fit within maxWidth. Uses current ctx font.
 * Returns array of lines.
 */
export function wrapText(
  ctx: SKRSContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Truncate text to fit maxWidth, adding ellipsis. Uses current ctx font.
 */
export function truncateText(
  ctx: SKRSContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(truncated + '…').width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated.trim() + '…';
}

/** Format athlete name (title case). */
export function formatName(name: string): string {
  return name
    .toLowerCase()
    .split(' ')
    .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/**
 * Draw 5BIB watermark logo. Position varies per template via opts.
 */
export async function drawWatermark(
  ctx: SKRSContext2D,
  data: RenderData,
  opts: {
    x: number;
    y: number;
    height: number;
    alpha?: number;
    anchor?: 'left' | 'center' | 'right';
  },
): Promise<void> {
  if (!data.assets.logo5BIB) return;
  const logo = data.assets.logo5BIB;
  const h = opts.height;
  const w = (logo.width / logo.height) * h;
  let drawX = opts.x;
  if (opts.anchor === 'center') drawX = opts.x - w / 2;
  else if (opts.anchor === 'right') drawX = opts.x - w;
  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 0.6;
  ctx.drawImage(logo, drawX, opts.y, w, h);
  ctx.restore();
}

/**
 * Draw QR code image at specified position. Returns true if drawn.
 */
export function drawQrCode(
  ctx: SKRSContext2D,
  data: RenderData,
  opts: { x: number; y: number; size: number; showLabel?: boolean; labelColor?: string },
): boolean {
  if (!data.qrImage) return false;
  // White rounded background for QR contrast
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  drawRoundedRect(ctx, opts.x - 8, opts.y - 8, opts.size + 16, opts.size + 16, 12);
  ctx.fill();
  ctx.drawImage(data.qrImage, opts.x, opts.y, opts.size, opts.size);
  if (opts.showLabel) {
    ctx.fillStyle = opts.labelColor ?? 'rgba(255,255,255,0.75)';
    ctx.font = `500 14px "${data.assets.fontFamily}", sans-serif`;
    ctx.fillText('Quét để xem kết quả', opts.x, opts.y + opts.size + 28);
  }
  ctx.restore();
  return true;
}

/**
 * Draw a pill-shaped tag with text. Returns pill width (for stacking).
 */
export function drawPill(
  ctx: SKRSContext2D,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  opts: { bg?: string; fg?: string; paddingX?: number } = {},
): number {
  const paddingX = opts.paddingX ?? 18;
  ctx.font = `700 ${fontSize}px "Inter", "Be Vietnam Pro", sans-serif`;
  const metrics = ctx.measureText(text);
  const pillW = metrics.width + paddingX * 2;
  const pillH = fontSize + 14;
  ctx.fillStyle = opts.bg ?? 'rgba(255,255,255,0.2)';
  drawRoundedRect(ctx, x, y, pillW, pillH, pillH / 2);
  ctx.fill();
  ctx.fillStyle = opts.fg ?? 'white';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + paddingX, y + pillH / 2 + 1);
  ctx.textBaseline = 'alphabetic';
  return pillW;
}

/**
 * Draw badges row. Returns the Y position below the row.
 */
export function drawBadgesRow(
  ctx: SKRSContext2D,
  data: RenderData,
  x: number,
  y: number,
  maxWidth: number,
  fontSize = 22,
): number {
  if (!data.badges || data.badges.length === 0 || !data.showBadges) {
    return y;
  }
  let cursorX = x;
  const pillH = fontSize + 14;
  const gap = 10;
  for (const badge of data.badges.slice(0, 4)) {
    const label = badge.label;
    ctx.font = `700 ${fontSize}px "${data.assets.fontFamily}", sans-serif`;
    const w = ctx.measureText(label).width + 32;
    if (cursorX - x + w > maxWidth) break; // don't overflow
    const width = drawPill(ctx, label, cursorX, y, fontSize, {
      bg: badge.color,
      fg: '#ffffff',
      paddingX: 16,
    });
    cursorX += width + gap;
  }
  return y + pillH + 12;
}

/**
 * Scale factor for preview mode — reduces stroke/line widths proportionally.
 * All pixel values in templates should be for FULL-RES, templates use this to scale
 * consistently when in preview mode.
 */
export function scale(data: RenderData, value: number): number {
  if (!data.preview) return value;
  // Preview = width/1080, so scale everything by that ratio
  return Math.round((value * data.canvasWidth) / 1080);
}

/**
 * Render the custom message as a centered quote pill at the VERY BOTTOM of
 * the canvas — below watermark / QR row. The semi-transparent dark pill ensures
 * readability on any background (dark gradient, light cream, custom photo).
 *
 * Call this LAST in any template render function so it paints on top.
 */
export function drawBottomQuote(
  ctx: SKRSContext2D,
  data: RenderData,
  contentW: number,
): void {
  if (!data.customMessage) return;

  const W = data.canvasWidth;
  const H = data.canvasHeight;

  const fontSize = scale(data, 19);
  ctx.font = `500 italic ${fontSize}px "${data.assets.fontFamily}", sans-serif`;

  const raw = `"${data.customMessage}"`;
  const msg = truncateText(ctx, raw, contentW - scale(data, 40));
  const textW = ctx.measureText(msg).width;

  const pillPadX = scale(data, 20);
  const pillH = scale(data, 36);
  const pillW = textW + pillPadX * 2;
  const pillX = (W - pillW) / 2;
  // 56px from bottom edge — sits below the watermark row (watermarks end ≥72px from bottom)
  const pillY = H - scale(data, 56);

  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  drawRoundedRect(ctx, pillX, pillY, pillW, pillH, scale(data, 18));
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText(msg, pillX + pillPadX, pillY + scale(data, 24));
}
