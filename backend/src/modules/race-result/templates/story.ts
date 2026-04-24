import type { SKRSContext2D } from '@napi-rs/canvas';
import type { RenderData, TemplateConfig } from './types';
import {
  drawBadgesRow,
  drawQrCode,
  drawWatermark,
  fillCustomPhotoBackground,
  fillGradientBackground,
  formatName,
  scale,
  truncateText,
  wrapText,
} from './shared';

/**
 * Story template — 9:16 vertical for Instagram/Facebook Stories.
 * Photo-first: optimized for custom background, with giant chip time overlay.
 *
 * Layout (full-res 1080×1920):
 *   Top third:    race eyebrow + athlete name (big)
 *   Mid-ish:      GIANT chip time (dominant focal point)
 *   Lower third:  rank trio + pace + badges + QR + watermark
 *
 * When customPhoto is set → photo covers full frame, strong overlay for readability.
 * Without photo → gradient fills + subtle pattern.
 *
 * Story template should ONLY render at 9:16. The DTO normalizer forces that.
 */
async function render(ctx: SKRSContext2D, data: RenderData): Promise<void> {
  const W = data.canvasWidth;
  const H = data.canvasHeight;
  const PAD_X = scale(data, 72);
  const contentW = W - PAD_X * 2;

  // ─── Background ─────────────────────────────────────────────
  if (data.customPhoto) {
    // Stronger overlay for story since text sits on more of the frame
    fillCustomPhotoBackground(ctx, data, 0.55);
    // Extra bottom vignette for rank row readability
    const vignette = ctx.createLinearGradient(0, H * 0.55, 0, H);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, H * 0.55, W, H * 0.45);
  } else {
    fillGradientBackground(ctx, data);
    // Extra flare: top highlight sweep
    const sweep = ctx.createRadialGradient(W * 0.3, H * 0.2, 50, W * 0.3, H * 0.2, W);
    sweep.addColorStop(0, 'rgba(255,255,255,0.25)');
    sweep.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sweep;
    ctx.fillRect(0, 0, W, H);
  }

  // ─── Top eyebrow strip ──────────────────────────────────────
  const TOP_Y = scale(data, 140);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `900 ${scale(data, 18)}px "${data.assets.monoFontFamily}", sans-serif`;
  ctx.letterSpacing = '6px';
  ctx.fillText('5BIB · RESULT', PAD_X, TOP_Y);
  ctx.letterSpacing = '0px';

  // Race name
  ctx.fillStyle = 'white';
  ctx.font = `700 ${scale(data, 34)}px "${data.assets.fontFamily}", sans-serif`;
  const raceName = truncateText(ctx, data.raceName || '', contentW);
  ctx.fillText(raceName, PAD_X, TOP_Y + scale(data, 52));

  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = `500 ${scale(data, 22)}px "${data.assets.monoFontFamily}", sans-serif`;
  const subtitle = [data.courseName, data.distance, data.raceDate]
    .filter(Boolean)
    .join(' · ');
  if (subtitle) {
    ctx.fillText(subtitle, PAD_X, TOP_Y + scale(data, 88));
  }

  // ─── Athlete name (large) ───────────────────────────────────
  ctx.fillStyle = 'white';
  const nameSize = scale(data, 72);
  ctx.font = `900 ${nameSize}px "${data.assets.fontFamily}", sans-serif`;
  const name = formatName(data.athleteName);
  const nameLines = wrapText(ctx, name, contentW).slice(0, 2);
  let nameY = TOP_Y + scale(data, 180);
  for (const line of nameLines) {
    ctx.fillText(line, PAD_X, nameY);
    nameY += Math.round(nameSize * 1.05);
  }

  // BIB pill
  ctx.fillStyle = '#f59e0b';
  ctx.font = `900 ${scale(data, 24)}px "${data.assets.monoFontFamily}", sans-serif`;
  ctx.fillText(
    `#${data.bib}${data.category ? `  ·  ${data.category}` : ''}`,
    PAD_X,
    nameY + scale(data, 32),
  );

  // ─── GIANT chip time (centered horizontally, middle of frame) ──
  const chipCenterY = Math.round(H * 0.52);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `700 ${scale(data, 22)}px "${data.assets.monoFontFamily}", sans-serif`;
  ctx.letterSpacing = '4px';
  const labelText = 'CHIP TIME';
  const labelW = ctx.measureText(labelText).width;
  ctx.fillText(labelText, (W - labelW) / 2, chipCenterY - scale(data, 130));
  ctx.letterSpacing = '0px';

  ctx.fillStyle = 'white';
  const chipSize = scale(data, 160);
  ctx.font = `900 ${chipSize}px "${data.assets.monoFontFamily}", sans-serif`;
  const chipText = data.chipTime || '--:--:--';
  // Shrink-to-fit if too wide
  let actualChipSize = chipSize;
  while (
    ctx.measureText(chipText).width > contentW &&
    actualChipSize > scale(data, 80)
  ) {
    actualChipSize -= 4;
    ctx.font = `900 ${actualChipSize}px "${data.assets.monoFontFamily}", sans-serif`;
  }
  const chipW = ctx.measureText(chipText).width;
  ctx.fillText(chipText, (W - chipW) / 2, chipCenterY);

  // Pace below
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `600 ${scale(data, 28)}px "${data.assets.monoFontFamily}", sans-serif`;
  const paceText = `${data.pace || '--'} /km`;
  const paceW = ctx.measureText(paceText).width;
  ctx.fillText(paceText, (W - paceW) / 2, chipCenterY + scale(data, 60));

  // Gap (centered below pace)
  if (data.gap && data.gap !== '-' && data.gap !== '--') {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `500 ${scale(data, 22)}px "${data.assets.monoFontFamily}", sans-serif`;
    const gapText = `Gap ${data.gap}`;
    const gapW = ctx.measureText(gapText).width;
    ctx.fillText(gapText, (W - gapW) / 2, chipCenterY + scale(data, 96));
  }

  // ─── Lower third: ranks + badges + QR ──────────────────────
  const LOWER_Y = Math.round(H * 0.72);

  // Ranks row — centered columns
  const cols: { label: string; value: string }[] = [
    { label: 'OVERALL', value: `#${data.overallRank || '-'}` },
    { label: 'GENDER', value: `#${data.genderRank || '-'}` },
  ];
  if (data.categoryRank) {
    cols.push({ label: 'CATEGORY', value: `#${data.categoryRank}` });
  }
  const colW = contentW / cols.length;
  cols.forEach((c, i) => {
    const cx = PAD_X + i * colW + colW / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `700 ${scale(data, 14)}px "${data.assets.monoFontFamily}", sans-serif`;
    ctx.letterSpacing = '3px';
    const lblW = ctx.measureText(c.label).width;
    ctx.fillText(c.label, cx - lblW / 2, LOWER_Y);
    ctx.letterSpacing = '0px';

    ctx.fillStyle = 'white';
    ctx.font = `900 ${scale(data, 46)}px "${data.assets.monoFontFamily}", sans-serif`;
    const valW = ctx.measureText(c.value).width;
    ctx.fillText(c.value, cx - valW / 2, LOWER_Y + scale(data, 56));
  });

  // Badges strip (between ranks and QR)
  if (data.showBadges && data.badges && data.badges.length > 0) {
    const badgeY = LOWER_Y + scale(data, 100);
    // center the badges group
    ctx.save();
    drawBadgesRow(ctx, data, PAD_X, badgeY, contentW, scale(data, 20));
    ctx.restore();
  }

  // ─── Bottom CTA: custom message + QR + watermark ───────────
  const bottomY = H - scale(data, 100);

  // Custom message
  if (data.customMessage) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = `500 italic ${scale(data, 22)}px "${data.assets.fontFamily}", sans-serif`;
    const msg = truncateText(ctx, `"${data.customMessage}"`, contentW - scale(data, 140));
    ctx.fillText(msg, PAD_X, bottomY - scale(data, 30));
  }

  // QR right-bottom
  if (data.showQrCode && data.qrImage) {
    const qrSize = scale(data, 120);
    drawQrCode(ctx, data, {
      x: W - PAD_X - qrSize,
      y: bottomY - qrSize - scale(data, 20),
      size: qrSize,
    });
  }

  // Watermark logo bottom-left
  const logoH = scale(data, 48);
  await drawWatermark(ctx, data, {
    x: PAD_X,
    y: bottomY - logoH,
    height: logoH,
    alpha: 0.8,
    anchor: 'left',
  });

  // Result URL hint (below watermark, very small)
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `500 ${scale(data, 14)}px "${data.assets.monoFontFamily}", sans-serif`;
  const hint = `result.5bib.com · #${data.bib}`;
  ctx.fillText(hint, PAD_X, bottomY + scale(data, 10));
}

export const STORY_TEMPLATE: TemplateConfig = {
  name: 'story',
  sizes: ['9:16'] as const,
  render,
};
