import type { SKRSContext2D } from '@napi-rs/canvas';
import type { RenderData, TemplateConfig } from './types';
import {
  drawBadgesRow,
  drawQrCode,
  drawRoundedRect,
  drawWatermark,
  formatName,
  scale,
  truncateText,
  wrapText,
} from './shared';

/**
 * Celebration template 🎉 — for PB, Podium, or other celebration-worthy results.
 * Bright cream/white background, confetti pattern, big gold chip time.
 */
async function render(ctx: SKRSContext2D, data: RenderData): Promise<void> {
  const W = data.canvasWidth;
  const H = data.canvasHeight;
  const PAD_X = scale(data, 72);
  const contentW = W - PAD_X * 2;

  // ─── Background: cream base ─────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#fffbeb'); // amber-50
  bg.addColorStop(0.6, '#fef3c7'); // amber-100
  bg.addColorStop(1, '#fde68a'); // amber-200
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Confetti dot pattern — deterministic (same hash → same pattern)
  drawConfetti(ctx, W, H, data.preview ? 40 : 80);

  // ─── Top strip: race name ───────────────────────────────────
  ctx.fillStyle = '#475569'; // slate-600
  ctx.font = `600 ${scale(data, 24)}px "${data.assets.monoFontFamily}", sans-serif`;
  const raceName = truncateText(ctx, data.raceName || '', contentW);
  ctx.fillText(raceName, PAD_X, scale(data, 100));

  ctx.fillStyle = '#64748b';
  ctx.font = `400 ${scale(data, 20)}px "${data.assets.monoFontFamily}", sans-serif`;
  const subtitle = [data.courseName, data.distance].filter(Boolean).join(' · ');
  if (subtitle) {
    ctx.fillText(subtitle, PAD_X, scale(data, 128));
  }

  // ─── Celebration banner ─────────────────────────────────────
  // Pick primary badge for main celebration text
  const primaryBadge = data.badges?.find((b) =>
    ['PB', 'PODIUM', 'AG_PODIUM'].includes(b.type),
  );
  const celebrationText = primaryBadge
    ? primaryBadge.type === 'PB'
      ? 'PERSONAL BEST!'
      : primaryBadge.type === 'PODIUM'
        ? primaryBadge.label.toUpperCase()
        : 'AGE GROUP PODIUM!'
    : 'AMAZING RUN!';
  const celebrationColor = primaryBadge?.color ?? '#1d4ed8';

  const bannerY = scale(data, 180);
  ctx.fillStyle = celebrationColor;
  ctx.font = `900 ${scale(data, 48)}px "${data.assets.monoFontFamily}", "${data.assets.fontFamily}", sans-serif`;
  ctx.fillText(celebrationText, PAD_X, bannerY);

  // ─── Athlete name ───────────────────────────────────────────
  ctx.fillStyle = '#0f172a';
  const nameSize = scale(data, 56);
  ctx.font = `900 ${nameSize}px "${data.assets.fontFamily}", sans-serif`;
  const name = formatName(data.athleteName);
  const nameLines = wrapText(ctx, name, contentW).slice(0, 2);
  let nameY = bannerY + scale(data, 72);
  for (const line of nameLines) {
    ctx.fillText(line, PAD_X, nameY);
    nameY += Math.round(nameSize * 1.1);
  }

  ctx.fillStyle = '#64748b';
  ctx.font = `500 ${scale(data, 22)}px "${data.assets.monoFontFamily}", sans-serif`;
  ctx.fillText(
    `BIB ${data.bib} · ${data.category || ''}`,
    PAD_X,
    nameY + scale(data, 8),
  );

  // ─── Huge chip time (gold) ──────────────────────────────────
  const chipY = nameY + scale(data, 100);
  ctx.fillStyle = '#1d4ed8';
  const chipSize = scale(data, 108);
  ctx.font = `900 ${chipSize}px "${data.assets.monoFontFamily}", sans-serif`;
  ctx.fillText(data.chipTime || '--:--:--', PAD_X, chipY);

  ctx.fillStyle = '#475569';
  ctx.font = `600 ${scale(data, 22)}px "${data.assets.monoFontFamily}", sans-serif`;
  ctx.letterSpacing = '3px';
  ctx.fillText('CHIP TIME', PAD_X, chipY - scale(data, 84));
  ctx.letterSpacing = '0px';

  // PB delta (if PB badge has meta)
  if (primaryBadge?.type === 'PB' && primaryBadge.meta?.delta) {
    ctx.fillStyle = '#059669';
    ctx.font = `700 ${scale(data, 22)}px "${data.assets.monoFontFamily}", sans-serif`;
    ctx.fillText(
      `⚡ ${primaryBadge.meta.delta} nhanh hơn lần trước`,
      PAD_X,
      chipY + scale(data, 40),
    );
  }

  // ─── Bottom dark band ───────────────────────────────────────
  const bandH = scale(data, 240);
  const bandY = H - bandH;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, bandY, W, bandH);

  // Rank row
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `600 ${scale(data, 14)}px "${data.assets.monoFontFamily}", sans-serif`;
  ctx.letterSpacing = '2px';
  const bandLabelY = bandY + scale(data, 40);
  ctx.fillText('OVERALL', PAD_X, bandLabelY);
  ctx.fillText('GENDER', PAD_X + scale(data, 280), bandLabelY);
  if (data.categoryRank) {
    ctx.fillText('CATEGORY', PAD_X + scale(data, 560), bandLabelY);
  }
  ctx.letterSpacing = '0px';

  ctx.fillStyle = 'white';
  const rankValSize = scale(data, 36);
  ctx.font = `900 ${rankValSize}px "${data.assets.monoFontFamily}", sans-serif`;
  const rankValY = bandY + scale(data, 80);
  ctx.fillText(`#${data.overallRank || '-'}`, PAD_X, rankValY);
  ctx.fillText(`#${data.genderRank || '-'}`, PAD_X + scale(data, 280), rankValY);
  if (data.categoryRank) {
    ctx.fillText(
      `#${data.categoryRank}`,
      PAD_X + scale(data, 560),
      rankValY,
    );
  }

  // Pace
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `500 ${scale(data, 20)}px "${data.assets.monoFontFamily}", sans-serif`;
  ctx.fillText(
    `Pace: ${data.pace || '--'} /km`,
    PAD_X,
    bandY + scale(data, 130),
  );

  // Custom message (if any)
  if (data.customMessage) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `500 italic ${scale(data, 20)}px "${data.assets.fontFamily}", sans-serif`;
    const msg = truncateText(ctx, `"${data.customMessage}"`, contentW);
    ctx.fillText(msg, PAD_X, bandY + scale(data, 165));
  }

  // Badges strip in dark band
  if (data.showBadges && data.badges && data.badges.length > 0) {
    drawBadgesRow(
      ctx,
      data,
      PAD_X,
      bandY + scale(data, 180),
      contentW - scale(data, 180),
      scale(data, 16),
    );
  }

  // Watermark + QR (bottom-right of dark band)
  const logoH = scale(data, 40);
  await drawWatermark(ctx, data, {
    x: W - PAD_X,
    y: bandY + scale(data, 30),
    height: logoH,
    alpha: 0.7,
    anchor: 'right',
  });

  if (data.showQrCode && data.qrImage) {
    const qrSize = scale(data, 110);
    drawQrCode(ctx, data, {
      x: W - PAD_X - qrSize,
      y: H - qrSize - scale(data, 30),
      size: qrSize,
    });
  }
}

/**
 * Draw deterministic confetti dots.
 * Uses a simple LCG seeded with a fixed value so pattern is stable across re-renders.
 */
function drawConfetti(
  ctx: SKRSContext2D,
  W: number,
  H: number,
  count: number,
): void {
  const colors = ['#1d4ed8', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];
  let seed = 0x1a2b3c;
  const next = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  ctx.save();
  for (let i = 0; i < count; i++) {
    const x = next() * W;
    const y = next() * H * 0.6; // confetti falls mostly from top
    const r = 4 + next() * 8;
    const rotation = next() * Math.PI;
    const color = colors[Math.floor(next() * colors.length)];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.4 + next() * 0.4;
    ctx.fillRect(-r, -r / 3, r * 2, r / 1.5);
    ctx.restore();
  }
  ctx.restore();
}

export const CELEBRATION_TEMPLATE: TemplateConfig = {
  name: 'celebration',
  sizes: ['4:5', '1:1', '9:16'] as const,
  render,
};
