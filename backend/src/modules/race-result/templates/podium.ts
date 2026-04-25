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

/**
 * Podium template — gated behind overallRank ≤ 3 OR categoryRank ≤ 3.
 * The registry-level resolveTemplate() handles the gate + fallback to Classic
 * when the athlete is not top-3. This render function assumes eligibility has
 * been checked. It will still render sensibly if called without top-3 (defensive),
 * but the picker UI will hide it for ineligible athletes.
 *
 * Design:
 *   - Bold metallic gradient based on rank tier (gold/silver/bronze)
 *   - Giant podium number "#1/2/3" as hero
 *   - Trophy/medal emoji watermark in corner
 *   - Race name + athlete name + chip time
 *   - Rank metadata (overall + category)
 */
async function render(ctx: SKRSContext2D, data: RenderData): Promise<void> {
  const W = data.canvasWidth;
  const H = data.canvasHeight;
  const PAD_X = scale(data, 72);
  const contentW = W - PAD_X * 2;

  // Determine which rank drives the tier (overall preferred; category as fallback)
  const overallRank = parseRank(data.overallRank);
  const categoryRank = parseRank(data.categoryRank);
  const tierRank: 1 | 2 | 3 =
    overallRank && overallRank <= 3
      ? (overallRank as 1 | 2 | 3)
      : categoryRank && categoryRank <= 3
        ? (categoryRank as 1 | 2 | 3)
        : 1;
  const tierScope = overallRank && overallRank <= 3 ? 'OVERALL' : 'CATEGORY';
  const theme = TIER_THEMES[tierRank];

  // ─── Background ─────────────────────────────────────────────
  if (data.customPhoto) {
    fillCustomPhotoBackground(ctx, data, 0.50);
  } else {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, theme.bg[0]);
    bg.addColorStop(0.5, theme.bg[1]);
    bg.addColorStop(1, theme.bg[2]);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const sheen = ctx.createLinearGradient(0, 0, W, H);
    sheen.addColorStop(0, 'rgba(255,255,255,0.18)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
    sheen.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, W, H);
  }

  // ─── Top: eyebrow + race meta ────────────────────────────────
  // Kept small so they don't compete with the hero number below.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `900 ${scale(data, 18)}px "${data.assets.monoFontFamily}", sans-serif`;
  ctx.letterSpacing = '6px';
  ctx.fillText(`${theme.eyebrow} · ${tierScope}`, PAD_X, scale(data, 88));
  ctx.letterSpacing = '0px';

  ctx.fillStyle = 'white';
  ctx.font = `600 ${scale(data, 24)}px "${data.assets.fontFamily}", sans-serif`;
  const raceName = truncateText(ctx, data.raceName || '', contentW);
  ctx.fillText(raceName, PAD_X, scale(data, 128));

  const subtitle = [data.courseName, data.distance].filter(Boolean).join(' · ');
  if (subtitle) {
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = `500 ${scale(data, 18)}px "${data.assets.monoFontFamily}", sans-serif`;
    ctx.fillText(subtitle, PAD_X, scale(data, 160));
  }

  // ─── Medal emoji (centered, above hero) ─────────────────────
  // Smaller than before (80px vs 180px) and positioned clearly ABOVE the
  // hero number so there's no overlap with race meta or hero text.
  // heroY baseline = 500 → visual top ≈ 500-165 = 335.
  // Medal baseline = 306 → medal visually ends ~306, hero starts ~335. ✓
  const medalSize = scale(data, 80);
  try {
    ctx.font = `${medalSize}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    const mw = ctx.measureText(theme.medal).width;
    ctx.fillText(theme.medal, (W - Math.max(mw, medalSize)) / 2, scale(data, 306));
  } catch {
    // emoji rendering not supported on this platform — silently skip
  }

  // ─── HERO rank number: #1 / #2 / #3 ────────────────────────
  // Reduced from 320→220px so the visual top (~335) clears race meta (~160).
  // Moving heroY down from 340→500 prevents the giant glyph from swallowing
  // the race name and subtitle that share the top section.
  const heroSize = scale(data, 220);
  const heroY = scale(data, 500);
  ctx.fillStyle = 'white';
  ctx.font = `900 ${heroSize}px "${data.assets.monoFontFamily}", sans-serif`;
  const heroText = `#${tierRank}`;
  const heroW = ctx.measureText(heroText).width;
  const heroX = (W - heroW) / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = scale(data, 30);
  ctx.shadowOffsetY = scale(data, 6);
  ctx.fillText(heroText, heroX, heroY);
  ctx.restore();

  // ─── Athlete name (centered, below hero) ────────────────────
  const nameSize = scale(data, 58);
  const nameY = heroY + scale(data, 90);
  ctx.fillStyle = 'white';
  ctx.font = `900 ${nameSize}px "${data.assets.fontFamily}", sans-serif`;
  const name = formatName(data.athleteName);
  const nameLines = wrapText(ctx, name, contentW).slice(0, 2);
  let curY = nameY;
  for (const line of nameLines) {
    const lw = ctx.measureText(line).width;
    ctx.fillText(line, (W - lw) / 2, curY);
    curY += Math.round(nameSize * 1.05);
  }

  // ─── BIB + category pills row (centered) ────────────────────
  const tagFontSize = scale(data, 22);
  ctx.font = `700 ${tagFontSize}px "Inter", "${data.assets.fontFamily}", sans-serif`;
  const bibLabel = `BIB ${data.bib}`;
  const catLabel = data.category || '';
  const bibPillW = ctx.measureText(bibLabel).width + 36;
  const catPillW = catLabel ? ctx.measureText(catLabel).width + 36 : 0;
  const pillGap = scale(data, 12);
  const totalPillW = bibPillW + (catLabel ? pillGap + catPillW : 0);
  let tagX = (W - totalPillW) / 2;
  const tagY = curY + scale(data, 24);
  tagX +=
    drawPill(ctx, bibLabel, tagX, tagY, tagFontSize, { bg: 'rgba(0,0,0,0.3)' }) + pillGap;
  if (catLabel) {
    drawPill(ctx, catLabel, tagX, tagY, tagFontSize, { bg: 'rgba(0,0,0,0.3)' });
  }

  // ─── Chip time pane ──────────────────────────────────────────
  // chipPaneY = H - 420px at full-res → leaves ~150px strip below for
  // message + watermark without crowding the athlete name/pills above.
  const chipPaneH = scale(data, 210);
  const chipPaneY = H - chipPaneH - scale(data, 210);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  drawRoundedRect(ctx, PAD_X, chipPaneY, contentW, chipPaneH, scale(data, 36));
  ctx.fill();

  // Chip label
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `700 ${scale(data, 16)}px "${data.assets.monoFontFamily}", sans-serif`;
  ctx.letterSpacing = '3px';
  ctx.fillText('CHIP TIME', PAD_X + scale(data, 36), chipPaneY + scale(data, 40));
  ctx.letterSpacing = '0px';

  // Chip value
  ctx.fillStyle = 'white';
  ctx.font = `900 ${scale(data, 90)}px "${data.assets.monoFontFamily}", sans-serif`;
  ctx.fillText(data.chipTime || '--:--:--', PAD_X + scale(data, 36), chipPaneY + scale(data, 130));

  // Pace + gap (right-aligned inside chip pane)
  const miniRight = PAD_X + contentW - scale(data, 36);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `600 ${scale(data, 20)}px "${data.assets.monoFontFamily}", sans-serif`;
  const paceText = `${data.pace || '--'} /km`;
  ctx.fillText(paceText, miniRight - ctx.measureText(paceText).width, chipPaneY + scale(data, 60));

  if (data.gap && data.gap !== '-' && data.gap !== '--') {
    ctx.font = `500 ${scale(data, 18)}px "${data.assets.monoFontFamily}", sans-serif`;
    const gapText = `Gap ${data.gap}`;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(gapText, miniRight - ctx.measureText(gapText).width, chipPaneY + scale(data, 92));
  }

  // Badges strip inside chip pane (bottom of pane)
  if (data.showBadges && data.badges && data.badges.length > 0) {
    drawBadgesRow(
      ctx,
      data,
      PAD_X + scale(data, 36),
      chipPaneY + scale(data, 152),
      contentW - scale(data, 72),
      scale(data, 18),
    );
  }

  // ─── Bottom row: watermark + QR ─────────────────────────────
  const bottomY = H - scale(data, 64);
  const logoH = scale(data, 40);
  await drawWatermark(ctx, data, {
    x: PAD_X,
    y: bottomY - logoH,
    height: logoH,
    alpha: 0.85,
    anchor: 'left',
  });

  if (data.showQrCode && data.qrImage) {
    const qrSize = scale(data, 100);
    drawQrCode(ctx, data, {
      x: W - PAD_X - qrSize,
      y: bottomY - qrSize,
      size: qrSize,
    });
  }

  // ─── Bottom quote (always last — paints over metallic gradient) ──
  drawBottomQuote(ctx, data, contentW);
}

function parseRank(rank: string | number | undefined): number | null {
  if (rank === undefined || rank === null || rank === '') return null;
  const n = typeof rank === 'number' ? rank : parseInt(rank, 10);
  return isNaN(n) ? null : n;
}

/** Tier themes — gold/silver/bronze metallic gradients. */
const TIER_THEMES: Record<1 | 2 | 3, {
  bg: [string, string, string];
  eyebrow: string;
  medal: string;
}> = {
  1: {
    // Gold
    bg: ['#fbbf24', '#d97706', '#78350f'],
    eyebrow: 'CHAMPION',
    medal: '🥇',
  },
  2: {
    // Silver
    bg: ['#e2e8f0', '#94a3b8', '#334155'],
    eyebrow: 'RUNNER-UP',
    medal: '🥈',
  },
  3: {
    // Bronze
    bg: ['#fbbf24', '#b45309', '#451a03'],
    eyebrow: 'THIRD PLACE',
    medal: '🥉',
  },
};

export const PODIUM_TEMPLATE: TemplateConfig = {
  name: 'podium',
  sizes: ['4:5', '1:1', '9:16'] as const,
  eligible: (data) => {
    const o = parseRank(data.overallRank);
    const c = parseRank(data.categoryRank);
    return (o !== null && o >= 1 && o <= 3) || (c !== null && c >= 1 && c <= 3);
  },
  render,
};
