import type { SKRSContext2D } from '@napi-rs/canvas';
import type { RenderData, TemplateConfig } from './types';
import {
  drawBadgesRow,
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

  // Determine which rank drives the tier
  const overallRank = parseRank(data.overallRank);
  const categoryRank = parseRank(data.categoryRank);
  // Prefer overall if top-3; else category
  const tierRank =
    overallRank && overallRank <= 3
      ? overallRank
      : categoryRank && categoryRank <= 3
        ? categoryRank
        : 1; // defensive fallback, shouldn't happen if gate applied
  const tierScope =
    overallRank && overallRank <= 3 ? 'OVERALL' : 'CATEGORY';

  const theme = TIER_THEMES[tierRank];

  // ─── Background ─────────────────────────────────────────────
  // Custom photo replaces the metallic gradient.  The podium text elements
  // (all white) remain readable against the photo + dark overlay.
  if (data.customPhoto) {
    fillCustomPhotoBackground(ctx, data, 0.50);
  } else {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, theme.bg[0]);
    bg.addColorStop(0.5, theme.bg[1]);
    bg.addColorStop(1, theme.bg[2]);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    // Diagonal sheen overlay
    const sheen = ctx.createLinearGradient(0, 0, W, H);
    sheen.addColorStop(0, 'rgba(255,255,255,0.18)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
    sheen.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, W, H);
  }

  // ─── Top eyebrow ────────────────────────────────────────────
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `900 ${scale(data, 18)}px "${data.assets.monoFontFamily}", sans-serif`;
  ctx.letterSpacing = '6px';
  ctx.fillText(`${theme.eyebrow} · ${tierScope}`, PAD_X, scale(data, 100));
  ctx.letterSpacing = '0px';

  // Race name
  ctx.fillStyle = 'white';
  ctx.font = `700 ${scale(data, 28)}px "${data.assets.fontFamily}", sans-serif`;
  const raceName = truncateText(ctx, data.raceName || '', contentW);
  ctx.fillText(raceName, PAD_X, scale(data, 140));

  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = `500 ${scale(data, 20)}px "${data.assets.monoFontFamily}", sans-serif`;
  const subtitle = [data.courseName, data.distance].filter(Boolean).join(' · ');
  if (subtitle) ctx.fillText(subtitle, PAD_X, scale(data, 172));

  // ─── HERO rank number: #1 / #2 / #3 ────────────────────────
  // Rendered large-centered with medal emoji beside it.
  const heroY = scale(data, 340);
  ctx.fillStyle = 'white';
  const heroSize = scale(data, 320);
  ctx.font = `900 ${heroSize}px "${data.assets.monoFontFamily}", sans-serif`;
  const heroText = `#${tierRank}`;
  const heroW = ctx.measureText(heroText).width;
  const heroX = (W - heroW) / 2;
  // Soft shadow behind hero for depth
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = scale(data, 30);
  ctx.shadowOffsetY = scale(data, 6);
  ctx.fillText(heroText, heroX, heroY);
  ctx.restore();

  // Medal emoji (big, left of hero)
  ctx.font = `${scale(data, 180)}px "Apple Color Emoji", sans-serif`;
  const medalText = theme.medal;
  const medalW = ctx.measureText(medalText).width;
  ctx.fillStyle = 'white';
  // attempt — canvas emoji rendering varies; fallback is fine (renders nothing)
  try {
    ctx.fillText(medalText, heroX - medalW - scale(data, 30), heroY - scale(data, 20));
  } catch {
    // ignore emoji failure
  }

  // ─── Athlete name (centered, below hero) ────────────────────
  const nameY = heroY + scale(data, 90);
  ctx.fillStyle = 'white';
  const name = formatName(data.athleteName);
  let nameSize = scale(data, 62);
  ctx.font = `900 ${nameSize}px "${data.assets.fontFamily}", sans-serif`;
  const nameLines = wrapText(ctx, name, contentW).slice(0, 2);
  let curY = nameY;
  for (const line of nameLines) {
    const lw = ctx.measureText(line).width;
    ctx.fillText(line, (W - lw) / 2, curY);
    curY += Math.round(nameSize * 1.05);
  }

  // BIB + category pills row (centered)
  const tagFontSize = scale(data, 22);
  ctx.font = `700 ${tagFontSize}px "Inter", "${data.assets.fontFamily}", sans-serif`;
  const bibLabel = `BIB ${data.bib}`;
  const catLabel = data.category || '';
  const bibW = ctx.measureText(bibLabel).width + 36;
  const catW = catLabel ? ctx.measureText(catLabel).width + 36 : 0;
  const gap = scale(data, 12);
  const totalPillW = bibW + (catLabel ? gap + catW : 0);
  let tagX = (W - totalPillW) / 2;
  const tagY = curY + scale(data, 20);
  tagX +=
    drawPill(ctx, bibLabel, tagX, tagY, tagFontSize, {
      bg: 'rgba(0,0,0,0.3)',
    }) + gap;
  if (catLabel) {
    drawPill(ctx, catLabel, tagX, tagY, tagFontSize, {
      bg: 'rgba(0,0,0,0.3)',
    });
  }

  // ─── Chip time pane (bottom third) ──────────────────────────
  const chipPaneH = scale(data, 210);
  const chipPaneY = H - chipPaneH - scale(data, 140);
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
  const chipSize = scale(data, 90);
  ctx.font = `900 ${chipSize}px "${data.assets.monoFontFamily}", sans-serif`;
  const chipText = data.chipTime || '--:--:--';
  ctx.fillText(chipText, PAD_X + scale(data, 36), chipPaneY + scale(data, 130));

  // Right-side mini stats (pace + gap)
  const miniRight = PAD_X + contentW - scale(data, 36);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `600 ${scale(data, 20)}px "${data.assets.monoFontFamily}", sans-serif`;
  const paceText = `${data.pace || '--'} /km`;
  const pw = ctx.measureText(paceText).width;
  ctx.fillText(paceText, miniRight - pw, chipPaneY + scale(data, 60));

  if (data.gap && data.gap !== '-' && data.gap !== '--') {
    ctx.font = `500 ${scale(data, 18)}px "${data.assets.monoFontFamily}", sans-serif`;
    const gapText = `Gap ${data.gap}`;
    const gw = ctx.measureText(gapText).width;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(gapText, miniRight - gw, chipPaneY + scale(data, 92));
  }

  // Badges strip inside chip pane
  if (data.showBadges && data.badges && data.badges.length > 0) {
    drawBadgesRow(
      ctx,
      data,
      PAD_X + scale(data, 36),
      chipPaneY + scale(data, 150),
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

  // Custom message (right of watermark, compact)
  if (data.customMessage) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `500 italic ${scale(data, 18)}px "${data.assets.fontFamily}", sans-serif`;
    const msg = truncateText(ctx, `"${data.customMessage}"`, contentW - scale(data, 280));
    ctx.fillText(msg, PAD_X + scale(data, 180), bottomY - scale(data, 14));
  }
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
