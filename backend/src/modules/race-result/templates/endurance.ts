import type { SKRSContext2D } from '@napi-rs/canvas';
import type { RenderData, TemplateConfig } from './types';
import {
  drawBadgesRow,
  drawBottomQuote,
  drawPill,
  drawQrCode,
  drawRoundedRect,
  drawWatermark,
  fillCustomPhotoBackground,
  formatName,
  scale,
  truncateText,
  wrapText,
} from './shared';
import { parseChipTime } from '../services/badge.service';

/**
 * Endurance template — ultra/trail-focused.
 * Design language:
 *   - Dark slate base with topo-contour pattern (deterministic)
 *   - Trail-green accent (#166534)
 *   - Elevation profile-ish pace zones bar (runner's pace breakdown by split)
 *   - Split grid if splits available (up to 6 checkpoints)
 *
 * Layout (full-res 1080×1350):
 *   Top:    "ENDURANCE" eyebrow + race name + distance/km
 *   Mid:    athlete name + BIG chip time + pace + gap
 *   Lower:  pace-zone horizontal bars (visual of splits relative pace)
 *   Bottom: rank row + badges + QR + watermark
 *
 * Gradient preset is ignored — endurance always uses its own slate/green scheme
 * for brand consistency (trail palette). Passed gradient only tints the topo pattern.
 */
async function render(ctx: SKRSContext2D, data: RenderData): Promise<void> {
  const W = data.canvasWidth;
  const H = data.canvasHeight;
  const PAD_X = scale(data, 72);
  const PAD_TOP = scale(data, 96);
  const PAD_BOTTOM = scale(data, 72);
  const contentW = W - PAD_X * 2;

  // ─── Background ─────────────────────────────────────────────
  // Custom photo replaces the slate/forest gradient.  Topo contours are
  // skipped on photo so they don't muddy the athlete image.
  if (data.customPhoto) {
    fillCustomPhotoBackground(ctx, data, 0.60); // slightly heavier overlay for readability on varied photos
  } else {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0f172a'); // slate-900
    bg.addColorStop(0.6, '#14532d'); // green-900
    bg.addColorStop(1, '#052e16'); // deep forest
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    drawTopoContours(ctx, W, H, data.preview ? 8 : 14);
  }

  // ─── Top eyebrow strip ──────────────────────────────────────
  ctx.fillStyle = '#a3e635'; // lime accent
  ctx.font = `900 ${scale(data, 16)}px "${data.assets.monoFontFamily}", sans-serif`;
  ctx.letterSpacing = '6px';
  ctx.fillText('ENDURANCE', PAD_X, PAD_TOP);
  ctx.letterSpacing = '0px';

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `700 ${scale(data, 28)}px "${data.assets.monoFontFamily}", sans-serif`;
  const raceName = truncateText(ctx, data.raceName || '', contentW);
  ctx.fillText(raceName, PAD_X, PAD_TOP + scale(data, 40));

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = `400 ${scale(data, 20)}px "${data.assets.monoFontFamily}", sans-serif`;
  const subtitle = [data.courseName, data.distance, data.raceDate]
    .filter(Boolean)
    .join(' · ');
  if (subtitle) {
    ctx.fillText(subtitle, PAD_X, PAD_TOP + scale(data, 72));
  }

  // ─── Athlete name ───────────────────────────────────────────
  ctx.fillStyle = 'white';
  const nameSize = scale(data, 56);
  ctx.font = `900 ${nameSize}px "${data.assets.fontFamily}", sans-serif`;
  const name = formatName(data.athleteName);
  const nameLines = wrapText(ctx, name, contentW).slice(0, 2);
  let nameY = PAD_TOP + scale(data, 160);
  for (const line of nameLines) {
    ctx.fillText(line, PAD_X, nameY);
    nameY += Math.round(nameSize * 1.05);
  }

  // Tag pills
  const tagFontSize = scale(data, 20);
  let tagX = PAD_X;
  tagX +=
    drawPill(ctx, `BIB ${data.bib}`, tagX, nameY + scale(data, 8), tagFontSize, {
      bg: 'rgba(163,230,53,0.18)',
      fg: '#bef264',
    }) + scale(data, 10);
  if (data.category) {
    drawPill(ctx, data.category, tagX, nameY + scale(data, 8), tagFontSize, {
      bg: 'rgba(255,255,255,0.12)',
    });
  }

  // ─── BIG chip time ──────────────────────────────────────────
  const chipY = nameY + scale(data, 120);
  ctx.fillStyle = 'rgba(163,230,53,0.8)'; // lime
  ctx.font = `700 ${scale(data, 16)}px "${data.assets.monoFontFamily}", sans-serif`;
  ctx.letterSpacing = '3px';
  ctx.fillText('CHIP TIME', PAD_X, chipY);
  ctx.letterSpacing = '0px';

  ctx.fillStyle = 'white';
  const chipSize = scale(data, 104);
  ctx.font = `900 ${chipSize}px "${data.assets.monoFontFamily}", sans-serif`;
  ctx.fillText(data.chipTime || '--:--:--', PAD_X, chipY + scale(data, 90));

  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `500 ${scale(data, 20)}px "${data.assets.monoFontFamily}", sans-serif`;
  let metaX = PAD_X;
  ctx.fillText(`Pace ${data.pace || '--'}/km`, metaX, chipY + scale(data, 130));
  metaX += ctx.measureText(`Pace ${data.pace || '--'}/km`).width + scale(data, 24);
  if (data.gap && data.gap !== '-' && data.gap !== '--') {
    ctx.fillText(`Gap ${data.gap}`, metaX, chipY + scale(data, 130));
  }

  // ─── Pace zones bar ─────────────────────────────────────────
  const zoneTop = chipY + scale(data, 160);
  drawPaceZones(ctx, data, PAD_X, zoneTop, contentW, scale(data, 68));

  // ─── Bottom band: rank + QR + watermark ─────────────────────
  const bottomY = H - PAD_BOTTOM;
  const logoH = scale(data, 42);
  await drawWatermark(ctx, data, {
    x: W - PAD_X,
    y: bottomY - logoH,
    height: logoH,
    alpha: 0.7,
    anchor: 'right',
  });

  let qrBlockWidth = 0;
  if (data.showQrCode && data.qrImage) {
    const qrSize = scale(data, 110);
    drawQrCode(ctx, data, {
      x: W - PAD_X - qrSize,
      y: bottomY - qrSize - logoH - scale(data, 16),
      size: qrSize,
    });
    qrBlockWidth = qrSize + scale(data, 24);
  }

  // Rank row
  const rankRowY = bottomY - scale(data, 120);
  drawRankBox(ctx, data, PAD_X, rankRowY, 'OVERALL', `#${data.overallRank || '-'}`, scale(data, 200));
  drawRankBox(
    ctx,
    data,
    PAD_X + scale(data, 216),
    rankRowY,
    'GENDER',
    `#${data.genderRank || '-'}`,
    scale(data, 200),
  );
  if (data.categoryRank) {
    drawRankBox(
      ctx,
      data,
      PAD_X + scale(data, 432),
      rankRowY,
      'CATEGORY',
      `#${data.categoryRank}`,
      scale(data, 200),
    );
  }

  // Badges strip (above ranks)
  if (data.showBadges && data.badges && data.badges.length > 0) {
    drawBadgesRow(
      ctx,
      data,
      PAD_X,
      rankRowY - scale(data, 54),
      contentW - qrBlockWidth,
      scale(data, 18),
    );
  }

  // ─── Bottom quote (always last — renders over topo/gradient background) ──
  drawBottomQuote(ctx, data, contentW);
}

/**
 * Draw topo-like horizontal contours (deterministic sine-offset lines).
 * Cheap: just stroke sine curves. Adds trail/map feel to the background.
 */
function drawTopoContours(
  ctx: SKRSContext2D,
  W: number,
  H: number,
  lineCount: number,
): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(163, 230, 53, 0.06)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < lineCount; i++) {
    const baseY = (H / (lineCount + 1)) * (i + 1);
    const amplitude = 18 + ((i * 7) % 28);
    const freq = 0.004 + (i % 3) * 0.002;
    const phase = i * 0.9;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 8) {
      const y = baseY + Math.sin(x * freq + phase) * amplitude;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Pace zones — derive from splits if available.
 * For each split, compute pace (min/km). Normalize across splits into 3 zones:
 *   Fast (blue) / Steady (lime) / Tough (orange).
 * If no splits: show a single-bar placeholder with the overall pace.
 */
function drawPaceZones(
  ctx: SKRSContext2D,
  data: RenderData,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const splits = (data.splits ?? []).filter((s) => s && s.time);
  ctx.save();

  // Section label
  ctx.fillStyle = 'rgba(163,230,53,0.85)';
  ctx.font = `700 ${scale(data, 14)}px "${data.assets.monoFontFamily}", sans-serif`;
  ctx.letterSpacing = '2px';
  ctx.fillText('PACE PROFILE', x, y - scale(data, 12));
  ctx.letterSpacing = '0px';

  // Background track
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  drawRoundedRect(ctx, x, y, w, h, scale(data, 14));
  ctx.fill();

  if (splits.length < 2) {
    // No splits — show single "overall pace" label
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = `500 ${scale(data, 18)}px "${data.assets.monoFontFamily}", sans-serif`;
    const msg = data.pace
      ? `Avg pace ${data.pace}/km across ${data.distance || 'course'}`
      : 'No split data available';
    ctx.fillText(msg, x + scale(data, 20), y + h / 2 + scale(data, 6));
    ctx.restore();
    return;
  }

  // Compute per-split paces (sec/km) if we can parse distance
  const paces: number[] = [];
  for (const s of splits) {
    const p = parsePace(s.pace);
    if (p > 0) paces.push(p);
  }
  if (paces.length < 2) {
    // fall back to segmented even bars without colour mapping
    drawEvenSegments(ctx, data, splits.length, x, y, w, h);
    ctx.restore();
    return;
  }

  const minPace = Math.min(...paces);
  const maxPace = Math.max(...paces);
  const range = Math.max(maxPace - minPace, 1);
  const segW = (w - 8) / paces.length;

  for (let i = 0; i < paces.length; i++) {
    const rel = (paces[i] - minPace) / range; // 0=fastest, 1=slowest
    const color = rel < 0.34 ? '#38bdf8' : rel < 0.67 ? '#a3e635' : '#fb923c';
    ctx.fillStyle = color;
    const segX = x + 4 + i * segW;
    const segH = h - 8;
    drawRoundedRect(ctx, segX, y + 4, segW - 4, segH, scale(data, 8));
    ctx.fill();

    // Split label (name + pace)
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.font = `700 ${scale(data, 13)}px "${data.assets.monoFontFamily}", sans-serif`;
    const split = splits[i];
    const lbl = split?.name?.slice(0, 6) ?? '';
    ctx.fillText(lbl, segX + scale(data, 6), y + scale(data, 24));

    if (split?.pace) {
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.font = `900 ${scale(data, 16)}px "${data.assets.monoFontFamily}", sans-serif`;
      ctx.fillText(split.pace, segX + scale(data, 6), y + scale(data, 48));
    }
  }
  ctx.restore();
}

function drawEvenSegments(
  ctx: SKRSContext2D,
  data: RenderData,
  count: number,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const segW = (w - 8) / count;
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(163,230,53,0.4)' : 'rgba(56,189,248,0.4)';
    const segX = x + 4 + i * segW;
    drawRoundedRect(ctx, segX, y + 4, segW - 4, h - 8, scale(data, 8));
    ctx.fill();
  }
}

/** Parse "M:SS" pace string → seconds. Returns 0 on bad input. */
function parsePace(str: string | undefined | null): number {
  if (!str) return 0;
  const parts = str.split(':').map((p) => parseFloat(p));
  if (parts.length !== 2 || parts.some((n) => isNaN(n))) {
    // Try chip-time parser as fallback (handles H:MM:SS)
    return parseChipTime(str);
  }
  return parts[0] * 60 + parts[1];
}

function drawRankBox(
  ctx: SKRSContext2D,
  data: RenderData,
  x: number,
  y: number,
  label: string,
  value: string,
  w: number,
): void {
  const h = scale(data, 96);
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  drawRoundedRect(ctx, x, y, w, h, scale(data, 18));
  ctx.fill();

  ctx.fillStyle = 'rgba(163,230,53,0.75)';
  ctx.font = `700 ${scale(data, 13)}px "${data.assets.monoFontFamily}", sans-serif`;
  ctx.letterSpacing = '2px';
  ctx.fillText(label, x + scale(data, 18), y + scale(data, 28));
  ctx.letterSpacing = '0px';

  ctx.fillStyle = 'white';
  ctx.font = `900 ${scale(data, 38)}px "${data.assets.monoFontFamily}", sans-serif`;
  ctx.fillText(value, x + scale(data, 18), y + scale(data, 72));
}

export const ENDURANCE_TEMPLATE: TemplateConfig = {
  name: 'endurance',
  sizes: ['4:5', '1:1', '9:16'] as const,
  render,
};
