import { Injectable } from '@nestjs/common';
import { createCanvas, loadImage, GlobalFonts, type SKRSContext2D } from '@napi-rs/canvas';
import * as path from 'path';

// Register custom fonts (Inter + Be Vietnam Pro) matching frontend
const FONTS_DIR = path.resolve(__dirname, '../../../../assets/fonts');
GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'Inter-Regular.ttf'), 'Inter');
GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'Inter-Bold.ttf'), 'Inter');
GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'Inter-Black.ttf'), 'Inter');
GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'BeVietnamPro-Regular.ttf'), 'Be Vietnam Pro');
GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'BeVietnamPro-SemiBold.ttf'), 'Be Vietnam Pro');
GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'BeVietnamPro-Bold.ttf'), 'Be Vietnam Pro');
GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'BeVietnamPro-Black.ttf'), 'Be Vietnam Pro');

interface AthleteImageData {
  Name: string;
  Bib: string;
  ChipTime: string;
  GunTime: string;
  Pace: string;
  Gap: string;
  Gender: string;
  Category: string;
  OverallRank: string;
  GenderRank: string;
  CatRank: string;
  distance: string;
  race_name: string;
}

const GRADIENTS: Record<string, { stops: [number, string][] }> = {
  blue: { stops: [[0, '#2563eb'], [0.5, '#1e40af'], [1, '#3730a3']] },
  dark: { stops: [[0, '#0f172a'], [0.5, '#1e293b'], [1, '#334155']] },
  sunset: { stops: [[0, '#f97316'], [0.5, '#dc2626'], [1, '#be123c']] },
  forest: { stops: [[0, '#059669'], [0.5, '#047857'], [1, '#065f46']] },
  purple: { stops: [[0, '#7c3aed'], [0.5, '#6d28d9'], [1, '#4c1d95']] },
};

/** F-07 Share Card ratios — Instagram Portrait (4:5), Facebook Square (1:1), Story (9:16). */
export type ImageRatio = '4:5' | '1:1' | '9:16';

const RATIO_DIMENSIONS: Record<ImageRatio, { width: number; height: number }> = {
  '4:5': { width: 1080, height: 1350 },
  '1:1': { width: 1080, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
};

const PADDING_X = 72;
const PADDING_TOP = 96;
const PADDING_BOTTOM = 84;

@Injectable()
export class ResultImageService {
  private logoBuffer: Buffer | null = null;

  private async getLogo() {
    if (!this.logoBuffer) {
      const logoPath = path.resolve(__dirname, '../../../../assets/logo_5BIB_white.png');
      const fs = await import('fs/promises');
      this.logoBuffer = await fs.readFile(logoPath);
    }
    return this.logoBuffer;
  }

  private formatName(name: string): string {
    return name
      .toLowerCase()
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  private drawRoundedRect(
    ctx: SKRSContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  private drawPill(
    ctx: SKRSContext2D,
    text: string,
    x: number,
    y: number,
    fontSize: number,
  ): number {
    ctx.font = `bold ${fontSize}px "Inter", "Be Vietnam Pro", sans-serif`;
    const metrics = ctx.measureText(text);
    const pillW = metrics.width + 30;
    const pillH = fontSize + 16;
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    this.drawRoundedRect(ctx, x, y, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.fillText(text, x + 15, y + fontSize + 5);
    return pillW;
  }

  async generateImage(
    athlete: AthleteImageData,
    bgKey: string,
    customBgBuffer?: Buffer,
    ratio: ImageRatio = '4:5',
  ): Promise<Buffer> {
    const { width: WIDTH, height: HEIGHT } =
      RATIO_DIMENSIONS[ratio] ?? RATIO_DIMENSIONS['4:5'];
    const isSquare = ratio === '1:1';
    const isStory = ratio === '9:16';

    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');

    // --- Background ---
    if (customBgBuffer) {
      const img = await loadImage(customBgBuffer);
      // Cover-fit the image
      const scale = Math.max(WIDTH / img.width, HEIGHT / img.height);
      const sw = WIDTH / scale;
      const sh = HEIGHT / scale;
      const sx = (img.width - sw) / 2;
      const sy = (img.height - sh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, WIDTH, HEIGHT);
      // Dark overlay
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    } else {
      const gradientDef = GRADIENTS[bgKey] || GRADIENTS.blue;
      const grad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
      for (const [stop, color] of gradientDef.stops) {
        grad.addColorStop(stop, color);
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    // --- Content ---
    const genderLabel = athlete.Gender === 'Male' || athlete.Gender === 'M' ? 'Nam' : 'Nữ';
    const contentW = WIDTH - PADDING_X * 2;

    // Race name (truncate if too long)
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `600 24px "Inter", "Be Vietnam Pro", sans-serif`;
    let raceName = athlete.race_name || '';
    while (raceName.length > 0 && ctx.measureText(raceName).width > contentW) {
      raceName = raceName.slice(0, -1);
    }
    if (raceName !== athlete.race_name) raceName = raceName.trim() + '…';
    ctx.fillText(raceName, PADDING_X, PADDING_TOP + 28);

    // Distance
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `400 22px "Inter", "Be Vietnam Pro", sans-serif`;
    ctx.fillText(athlete.distance, PADDING_X, PADDING_TOP + 58);

    // Athlete name
    ctx.fillStyle = 'white';
    ctx.font = `900 60px "Inter", "Be Vietnam Pro", sans-serif`;
    const name = this.formatName(athlete.Name);
    // Word wrap if needed
    const nameLines = this.wrapText(ctx, name, contentW);
    let nameY = PADDING_TOP + 140;
    for (const line of nameLines) {
      ctx.fillText(line, PADDING_X, nameY);
      nameY += 72;
    }

    // Tags
    const tagY = nameY + 16;
    const tagFontSize = 26;
    let tagX = PADDING_X;
    tagX += this.drawPill(ctx, `BIB: ${athlete.Bib}`, tagX, tagY, tagFontSize) + 18;
    tagX += this.drawPill(ctx, genderLabel, tagX, tagY, tagFontSize) + 18;
    this.drawPill(ctx, athlete.Category, tagX, tagY, tagFontSize);

    // --- Bottom section (anchored to bottom) ---
    const bottomY = HEIGHT - PADDING_BOTTOM;

    // Branding (logo)
    try {
      const logoBuf = await this.getLogo();
      const logoImg = await loadImage(logoBuf);
      const logoH = 56;
      const logoW = (logoImg.width / logoImg.height) * logoH;
      ctx.globalAlpha = 0.5;
      ctx.drawImage(logoImg, (WIDTH - logoW) / 2, bottomY - logoH, logoW, logoH);
      ctx.globalAlpha = 1;
    } catch {
      // Logo not found — skip
    }

    // Ranks
    const rankY = bottomY - 56 - 100;
    const rankBoxes = [
      { label: 'OVERALL', value: `#${athlete.OverallRank}` },
      { label: 'GENDER', value: `#${athlete.GenderRank}` },
    ];
    if (athlete.CatRank) {
      rankBoxes.push({ label: 'CATEGORY', value: `#${athlete.CatRank}` });
    }
    const rankGap = 20;
    const rankBoxW = (contentW - rankGap * (rankBoxes.length - 1)) / rankBoxes.length;
    const rankBoxH = 90;
    rankBoxes.forEach((box, i) => {
      const rx = PADDING_X + i * (rankBoxW + rankGap);
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      this.drawRoundedRect(ctx, rx, rankY, rankBoxW, rankBoxH, 24);
      ctx.fill();
      // Value
      ctx.fillStyle = 'white';
      ctx.font = `900 36px "Inter", "Be Vietnam Pro", sans-serif`;
      const valMetrics = ctx.measureText(box.value);
      ctx.fillText(box.value, rx + (rankBoxW - valMetrics.width) / 2, rankY + 44);
      // Label
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = `700 16px "Inter", "Be Vietnam Pro", sans-serif`;
      const lblMetrics = ctx.measureText(box.label);
      ctx.fillText(box.label, rx + (rankBoxW - lblMetrics.width) / 2, rankY + 72);
    });

    // Chip Time box
    const chipBoxH = 180;
    const chipBoxY = rankY - chipBoxH - 36;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    this.drawRoundedRect(ctx, PADDING_X, chipBoxY, contentW, chipBoxH, 42);
    ctx.fill();

    // "Chip Time" label
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = `700 20px "Inter", "Be Vietnam Pro", sans-serif`;
    ctx.letterSpacing = '2px';
    ctx.fillText('CHIP TIME', PADDING_X + 40, chipBoxY + 36);
    ctx.letterSpacing = '0px';

    // Time value
    ctx.fillStyle = 'white';
    ctx.font = `900 80px "Inter", "Be Vietnam Pro", "Noto Sans Mono", sans-serif`;
    ctx.fillText(athlete.ChipTime, PADDING_X + 40, chipBoxY + 120);

    // Pace + Gap
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `400 24px "Inter", "Be Vietnam Pro", sans-serif`;
    let paceText = `Pace: `;
    ctx.fillText(paceText, PADDING_X + 40, chipBoxY + 160);
    const paceW = ctx.measureText(paceText).width;
    ctx.font = `700 24px "Inter", "Be Vietnam Pro", "Noto Sans Mono", sans-serif`;
    const paceVal = `${athlete.Pace} /km`;
    ctx.fillText(paceVal, PADDING_X + 40 + paceW, chipBoxY + 160);
    const paceValW = ctx.measureText(paceVal).width;

    if (athlete.Gap && athlete.Gap !== '-' && athlete.Gap !== '--') {
      const gapX = PADDING_X + 40 + paceW + paceValW + 36;
      ctx.font = `400 24px "Inter", "Be Vietnam Pro", sans-serif`;
      const gapLabel = 'Gap: ';
      ctx.fillText(gapLabel, gapX, chipBoxY + 160);
      const gapLabelW = ctx.measureText(gapLabel).width;
      ctx.font = `700 24px "Inter", "Be Vietnam Pro", "Noto Sans Mono", sans-serif`;
      ctx.fillText(athlete.Gap, gapX + gapLabelW, chipBoxY + 160);
    }

    return Buffer.from(canvas.toBuffer('image/png'));
  }

  private wrapText(ctx: SKRSContext2D, text: string, maxWidth: number): string[] {
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
}
