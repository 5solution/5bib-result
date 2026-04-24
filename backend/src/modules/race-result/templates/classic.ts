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
  fillGradientBackground,
  formatName,
  scale,
  truncateText,
  wrapText,
} from './shared';

/**
 * Classic template — default, professional, brand blue gradient.
 *
 * Layout (full-res 1080×1350 as reference):
 *   Top:    race name + distance
 *   Center: athlete name + BIB/gender/category pills
 *   Mid:    big chip time box
 *   Below:  rank boxes (Overall / Gender / Category)
 *   Bottom: badges row (if any) + watermark + optional QR
 */
async function render(ctx: SKRSContext2D, data: RenderData): Promise<void> {
  const W = data.canvasWidth;
  const H = data.canvasHeight;
  const PAD_X = scale(data, 72);
  const PAD_TOP = scale(data, 96);
  const PAD_BOTTOM = scale(data, 72);
  const contentW = W - PAD_X * 2;

  // Background
  if (data.customPhoto) {
    fillCustomPhotoBackground(ctx, data, 0.5);
  } else {
    fillGradientBackground(ctx, data);
  }

  // ─── Top: Race name ─────────────────────────────────────────
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `600 ${scale(data, 24)}px "${data.assets.monoFontFamily}", sans-serif`;
  const raceName = truncateText(ctx, data.raceName || '', contentW);
  ctx.fillText(raceName, PAD_X, PAD_TOP + scale(data, 28));

  // Distance / course
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = `400 ${scale(data, 20)}px "${data.assets.monoFontFamily}", sans-serif`;
  const subtitle = [data.courseName, data.distance].filter(Boolean).join(' · ');
  if (subtitle) {
    ctx.fillText(subtitle, PAD_X, PAD_TOP + scale(data, 56));
  }

  // ─── Athlete name ───────────────────────────────────────────
  ctx.fillStyle = 'white';
  const nameSize = scale(data, 60);
  ctx.font = `900 ${nameSize}px "${data.assets.monoFontFamily}", "${data.assets.fontFamily}", sans-serif`;
  const name = formatName(data.athleteName);
  const nameLines = wrapText(ctx, name, contentW).slice(0, 2);
  let nameY = PAD_TOP + scale(data, 140);
  for (const line of nameLines) {
    ctx.fillText(line, PAD_X, nameY);
    nameY += Math.round(nameSize * 1.1);
  }

  // ─── Tag pills: BIB / gender / category ────────────────────
  const tagY = nameY + scale(data, 16);
  const tagFontSize = scale(data, 22);
  let tagX = PAD_X;
  tagX +=
    drawPill(ctx, `BIB ${data.bib}`, tagX, tagY, tagFontSize, {
      bg: 'rgba(255,255,255,0.2)',
    }) + scale(data, 12);
  if (data.gender) {
    const label =
      data.gender === 'Male' || data.gender === 'M' ? 'Nam' : data.gender === 'Female' || data.gender === 'F' ? 'Nữ' : data.gender;
    tagX +=
      drawPill(ctx, label, tagX, tagY, tagFontSize, {
        bg: 'rgba(255,255,255,0.15)',
      }) + scale(data, 12);
  }
  if (data.category) {
    drawPill(ctx, data.category, tagX, tagY, tagFontSize, {
      bg: 'rgba(255,255,255,0.15)',
    });
  }

  // ─── Bottom-up: watermark + QR + ranks + chip time ──────────
  const bottomY = H - PAD_BOTTOM;

  // Watermark 5BIB logo (bottom-center or right)
  const logoH = scale(data, 48);
  await drawWatermark(ctx, data, {
    x: W - PAD_X,
    y: bottomY - logoH,
    height: logoH,
    alpha: 0.55,
    anchor: 'right',
  });

  // QR code bottom-left (if enabled)
  let bottomContentBaseY = bottomY - logoH - scale(data, 24);
  if (data.showQrCode && data.qrImage) {
    const qrSize = scale(data, 110);
    drawQrCode(ctx, data, {
      x: PAD_X,
      y: bottomY - qrSize,
      size: qrSize,
      showLabel: false,
    });
    bottomContentBaseY = Math.min(bottomContentBaseY, bottomY - qrSize - scale(data, 24));
  }

  // Rank boxes
  const rankBoxH = scale(data, 86);
  const rankGap = scale(data, 18);
  const rankBoxes: { label: string; value: string }[] = [
    { label: 'OVERALL', value: `#${data.overallRank || '-'}` },
    { label: 'GENDER', value: `#${data.genderRank || '-'}` },
  ];
  if (data.categoryRank) {
    rankBoxes.push({ label: 'CATEGORY', value: `#${data.categoryRank}` });
  }
  const rankBoxW = (contentW - rankGap * (rankBoxes.length - 1)) / rankBoxes.length;
  const rankY = bottomContentBaseY - rankBoxH;
  rankBoxes.forEach((box, i) => {
    const rx = PAD_X + i * (rankBoxW + rankGap);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    drawRoundedRect(ctx, rx, rankY, rankBoxW, rankBoxH, scale(data, 22));
    ctx.fill();
    // Value
    ctx.fillStyle = 'white';
    const valSize = scale(data, 34);
    ctx.font = `900 ${valSize}px "${data.assets.monoFontFamily}", sans-serif`;
    const valW = ctx.measureText(box.value).width;
    ctx.fillText(box.value, rx + (rankBoxW - valW) / 2, rankY + scale(data, 40));
    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    const lblSize = scale(data, 14);
    ctx.font = `700 ${lblSize}px "${data.assets.monoFontFamily}", sans-serif`;
    ctx.letterSpacing = '2px';
    const lblW = ctx.measureText(box.label).width;
    ctx.fillText(box.label, rx + (rankBoxW - lblW) / 2, rankY + scale(data, 68));
    ctx.letterSpacing = '0px';
  });

  // ─── Chip time box ──────────────────────────────────────────
  const chipBoxH = scale(data, 170);
  const chipBoxY = rankY - chipBoxH - scale(data, 30);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  drawRoundedRect(ctx, PAD_X, chipBoxY, contentW, chipBoxH, scale(data, 36));
  ctx.fill();

  // Label
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = `700 ${scale(data, 18)}px "${data.assets.monoFontFamily}", sans-serif`;
  ctx.letterSpacing = '2px';
  ctx.fillText('CHIP TIME', PAD_X + scale(data, 36), chipBoxY + scale(data, 34));
  ctx.letterSpacing = '0px';

  // Time value
  ctx.fillStyle = 'white';
  const chipSize = scale(data, 76);
  ctx.font = `900 ${chipSize}px "${data.assets.monoFontFamily}", "${data.assets.fontFamily}", sans-serif`;
  ctx.fillText(data.chipTime || '--:--:--', PAD_X + scale(data, 36), chipBoxY + scale(data, 112));

  // Pace + Gap line
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `400 ${scale(data, 20)}px "${data.assets.monoFontFamily}", sans-serif`;
  const paceLineY = chipBoxY + scale(data, 148);
  let paceX = PAD_X + scale(data, 36);
  ctx.fillText('Pace:', paceX, paceLineY);
  paceX += ctx.measureText('Pace: ').width;
  ctx.font = `700 ${scale(data, 20)}px "${data.assets.monoFontFamily}", sans-serif`;
  ctx.fillText(`${data.pace || '--'} /km`, paceX, paceLineY);

  if (data.gap && data.gap !== '-' && data.gap !== '--') {
    paceX += ctx.measureText(`${data.pace || '--'} /km`).width + scale(data, 30);
    ctx.font = `400 ${scale(data, 20)}px "${data.assets.monoFontFamily}", sans-serif`;
    ctx.fillText('Gap:', paceX, paceLineY);
    paceX += ctx.measureText('Gap: ').width;
    ctx.font = `700 ${scale(data, 20)}px "${data.assets.monoFontFamily}", sans-serif`;
    ctx.fillText(data.gap, paceX, paceLineY);
  }

  // ─── Badges row (between chip time and ranks — above chip time) ──
  if (data.showBadges && data.badges && data.badges.length > 0) {
    drawBadgesRow(
      ctx,
      data,
      PAD_X,
      chipBoxY - scale(data, 56),
      contentW,
      scale(data, 20),
    );
  }

  // ─── Splits table (if enabled and available) ────────────────
  if (data.showSplits && data.splits && data.splits.length > 0) {
    const splitsY = chipBoxY - scale(data, 140);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `600 ${scale(data, 14)}px "${data.assets.monoFontFamily}", sans-serif`;
    const splitText = data.splits
      .slice(0, 4)
      .map((s) => `${s.name}: ${s.time}`)
      .join('  ·  ');
    ctx.fillText(truncateText(ctx, splitText, contentW), PAD_X, splitsY);
  }

  // ─── Bottom quote (always last — renders on top of background) ──
  drawBottomQuote(ctx, data, contentW);
}

export const CLASSIC_TEMPLATE: TemplateConfig = {
  name: 'classic',
  sizes: ['4:5', '1:1', '9:16'] as const,
  render,
};
