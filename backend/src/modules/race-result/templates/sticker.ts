import type { SKRSContext2D } from '@napi-rs/canvas';
import type { RenderData, TemplateConfig } from './types';
import {
  drawRoundedRect,
  drawWatermark,
  formatName,
  scale,
  truncateText,
} from './shared';

/**
 * Sticker template — die-cut look, badge-focused.
 *
 * We output a **solid-background** PNG (not transparent — PNG alpha adds
 * complexity with JPEG fallbacks and most social apps re-encode anyway). The
 * "sticker" feel comes from a centered rounded pill-card with a thick white
 * outer ring and drop shadow, like a peel-off sticker on a bold background.
 *
 * Layout (full-res 1080×1080 reference — 4:5 and 9:16 add breathing padding):
 *   Outer:     bold gradient field (uses gradientPreset)
 *   Center:    rounded rectangle "sticker" with:
 *              - eyebrow "I FINISHED"
 *              - race name
 *              - athlete name
 *              - chip time
 *              - primary badge (if any) — headline achievement
 *              - BIB + distance
 *   Bottom:    small watermark
 *
 * If athlete has ≥1 badge, the primary badge is visually dominant (the reason
 * this template exists — it's a brag sticker). If no badges → still works,
 * just shows the finish as the headline.
 */
async function render(ctx: SKRSContext2D, data: RenderData): Promise<void> {
  const W = data.canvasWidth;
  const H = data.canvasHeight;

  // ─── Outer background ───────────────────────────────────────
  drawStickerBackdrop(ctx, data);

  // ─── Pick primary badge for headline ────────────────────────
  const primaryBadge = data.badges?.find((b) =>
    ['PB', 'PODIUM', 'AG_PODIUM', 'SUB3H', 'SUB90M', 'SUB45M', 'SUB20M', 'ULTRA'].includes(
      b.type,
    ),
  );
  const accentColor = primaryBadge?.color ?? '#1d4ed8';

  // ─── Sticker card — centered ────────────────────────────────
  const cardW = Math.round(W * 0.82);
  const cardH = Math.round(H * 0.68);
  const cardX = (W - cardW) / 2;
  const cardY = (H - cardH) / 2 - scale(data, 20);
  const radius = scale(data, 64);

  // White outer ring for die-cut feel
  const ringPad = scale(data, 16);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = scale(data, 44);
  ctx.shadowOffsetY = scale(data, 12);
  ctx.fillStyle = '#ffffff';
  drawRoundedRect(
    ctx,
    cardX - ringPad,
    cardY - ringPad,
    cardW + ringPad * 2,
    cardH + ringPad * 2,
    radius + ringPad,
  );
  ctx.fill();
  ctx.restore();

  // Inner card — accent gradient with subtle top-highlight
  const inner = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
  inner.addColorStop(0, lighten(accentColor, 0.15));
  inner.addColorStop(0.5, accentColor);
  inner.addColorStop(1, darken(accentColor, 0.2));
  ctx.fillStyle = inner;
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, radius);
  ctx.fill();

  // Glossy top stripe
  ctx.save();
  ctx.beginPath();
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, radius);
  ctx.clip();
  const gloss = ctx.createLinearGradient(0, cardY, 0, cardY + cardH * 0.45);
  gloss.addColorStop(0, 'rgba(255,255,255,0.28)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gloss;
  ctx.fillRect(cardX, cardY, cardW, cardH * 0.45);
  ctx.restore();

  // ─── Card content ───────────────────────────────────────────
  const innerPadX = scale(data, 56);
  let y = cardY + scale(data, 76);

  // Circular avatar (E-2) — if user uploaded a custom photo, show it as the
  // portrait at the top of the sticker card. This turns the generic sticker
  // into a personalised "selfie + finish" brag shot.
  if (data.customPhoto) {
    const avatarR = scale(data, 78);
    const avatarCx = cardX + cardW / 2;
    const avatarCy = y + avatarR - scale(data, 8);

    // White ring around avatar
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(avatarCx, avatarCy, avatarR + scale(data, 6), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Clipped avatar image (cover-fit)
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarCx, avatarCy, avatarR, 0, Math.PI * 2);
    ctx.clip();
    const photo = data.customPhoto;
    const pw = photo.width;
    const ph = photo.height;
    const target = avatarR * 2;
    const scaleFit = Math.max(target / pw, target / ph);
    const dw = pw * scaleFit;
    const dh = ph * scaleFit;
    ctx.drawImage(
      photo,
      avatarCx - dw / 2,
      avatarCy - dh / 2,
      dw,
      dh,
    );
    ctx.restore();

    // Shift the rest of the card down past the avatar
    y = avatarCy + avatarR + scale(data, 28);
  }

  // Eyebrow "I FINISHED" or badge short label
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `900 ${scale(data, 20)}px "${data.assets.monoFontFamily}", sans-serif`;
  ctx.letterSpacing = '6px';
  const eyebrow = primaryBadge ? primaryBadge.shortLabel.toUpperCase() : 'I FINISHED';
  const eyebrowW = ctx.measureText(eyebrow).width;
  ctx.fillText(eyebrow, cardX + (cardW - eyebrowW) / 2, y);
  ctx.letterSpacing = '0px';

  // Race name
  y += scale(data, 44);
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.font = `600 ${scale(data, 22)}px "${data.assets.monoFontFamily}", sans-serif`;
  const raceName = truncateText(ctx, data.raceName || '', cardW - innerPadX * 2);
  const raceW = ctx.measureText(raceName).width;
  ctx.fillText(raceName, cardX + (cardW - raceW) / 2, y);

  // Athlete name (centered, large, shrink-to-fit)
  y += scale(data, 78);
  ctx.fillStyle = 'white';
  const name = formatName(data.athleteName);
  let nameSize = scale(data, 60);
  ctx.font = `900 ${nameSize}px "${data.assets.fontFamily}", sans-serif`;
  while (
    ctx.measureText(name).width > cardW - innerPadX * 2 &&
    nameSize > scale(data, 28)
  ) {
    nameSize -= 2;
    ctx.font = `900 ${nameSize}px "${data.assets.fontFamily}", sans-serif`;
  }
  const nameW = ctx.measureText(name).width;
  ctx.fillText(name, cardX + (cardW - nameW) / 2, y);

  // Chip time — the big number
  y += scale(data, 140);
  ctx.fillStyle = 'white';
  const chipSize = scale(data, 124);
  ctx.font = `900 ${chipSize}px "${data.assets.monoFontFamily}", sans-serif`;
  const chipText = data.chipTime || '--:--:--';
  let actualChipSize = chipSize;
  while (
    ctx.measureText(chipText).width > cardW - innerPadX * 2 &&
    actualChipSize > scale(data, 56)
  ) {
    actualChipSize -= 4;
    ctx.font = `900 ${actualChipSize}px "${data.assets.monoFontFamily}", sans-serif`;
  }
  const chipW = ctx.measureText(chipText).width;
  ctx.fillText(chipText, cardX + (cardW - chipW) / 2, y);

  // Primary badge label (if any) — reason this sticker exists
  if (primaryBadge) {
    y += scale(data, 58);
    ctx.fillStyle = '#fef9c3';
    ctx.font = `800 ${scale(data, 32)}px "${data.assets.fontFamily}", sans-serif`;
    const lbl = primaryBadge.label;
    const lblW = ctx.measureText(lbl).width;
    ctx.fillText(lbl, cardX + (cardW - lblW) / 2, y);
  }

  // Bottom strip: BIB + distance
  const footerY = cardY + cardH - scale(data, 48);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = `700 ${scale(data, 22)}px "${data.assets.monoFontFamily}", sans-serif`;
  const footer = `#${data.bib}${data.distance ? `  ·  ${data.distance}` : ''}${
    data.pace ? `  ·  ${data.pace}/km` : ''
  }`;
  const footerW = ctx.measureText(footer).width;
  ctx.fillText(footer, cardX + (cardW - footerW) / 2, footerY);

  // ─── Watermark (bottom outside card) ────────────────────────
  const logoH = scale(data, 38);
  await drawWatermark(ctx, data, {
    x: W / 2,
    y: H - scale(data, 68),
    height: logoH,
    alpha: 0.75,
    anchor: 'center',
  });
}

function drawStickerBackdrop(ctx: SKRSContext2D, data: RenderData): void {
  const W = data.canvasWidth;
  const H = data.canvasHeight;

  // Bold flat colour keyed to gradient preset. Stickers pop against solids.
  const baseByPreset: Record<string, string> = {
    blue: '#1e3a8a',
    dark: '#0f172a',
    sunset: '#7c2d12',
    forest: '#064e3b',
    purple: '#4c1d95',
  };
  const base = baseByPreset[data.gradientPreset] ?? '#1e3a8a';
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  // Soft radial highlight behind the card for depth
  const g = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, Math.max(W, H));
  g.addColorStop(0, 'rgba(255,255,255,0.15)');
  g.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Deterministic star speckles around edges for sticker-pop feel
  drawSpeckles(ctx, W, H, data.preview ? 40 : 80);
}

function drawSpeckles(ctx: SKRSContext2D, W: number, H: number, count: number): void {
  let seed = 0x55aa33;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < count; i++) {
    const x = next() * W;
    const y = next() * H;
    const r = 1 + next() * 3;
    ctx.globalAlpha = 0.15 + next() * 0.35;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Mix hex towards white by t (0..1). */
function lighten(hex: string, t: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(
    Math.round(r + (255 - r) * t),
    Math.round(g + (255 - g) * t),
    Math.round(b + (255 - b) * t),
  );
}

/** Mix hex towards black by t (0..1). */
function darken(hex: string, t: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(Math.round(r * (1 - t)), Math.round(g * (1 - t)), Math.round(b * (1 - t)));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  const v =
    h.length === 3
      ? [h[0] + h[0], h[1] + h[1], h[2] + h[2]]
      : [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)];
  return { r: parseInt(v[0], 16), g: parseInt(v[1], 16), b: parseInt(v[2], 16) };
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => {
    const s = Math.max(0, Math.min(255, n)).toString(16);
    return s.length === 1 ? `0${s}` : s;
  };
  return `#${h(r)}${h(g)}${h(b)}`;
}

export const STICKER_TEMPLATE: TemplateConfig = {
  name: 'sticker',
  sizes: ['4:5', '1:1', '9:16'] as const,
  render,
};
