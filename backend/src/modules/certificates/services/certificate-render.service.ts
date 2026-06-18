import { Injectable, Logger } from '@nestjs/common';
import {
  createCanvas,
  loadImage,
  GlobalFonts,
  type SKRSContext2D,
  type Image,
} from '@napi-rs/canvas';
import * as path from 'path';
import { CertificateTemplate } from '../schemas/certificate-template.schema';
import type {
  TemplateLayer,
  PhotoArea,
  TemplateCanvas,
} from '../schemas/certificate-template.schema';

const FONTS_DIR = path.resolve(__dirname, '../../../../assets/fonts');

/**
 * FEATURE-091 — bảng phông CHỌN ĐƯỢC trong editor (Crew GCN + Border Pass).
 * Mỗi entry: `family` = tên truyền vào `layer.fontFamily` (khớp alias register
 * bên dưới) + `label` hiển thị dropdown + `category` để gom nhóm UI.
 *
 * Toàn bộ phông đã verify FULL Vietnamese glyph coverage + render thật qua
 * @napi-rs/canvas (cmap check + render smoke 2026-06-18). Variable fonts
 * (`*-VF.ttf`) — Skia tự chọn instance theo `fontWeight` trong font string.
 *
 * KHÔNG đổi default render logic — chỉ thêm phông + export danh sách.
 */
export const FONT_OPTIONS: ReadonlyArray<{
  family: string;
  label: string;
  category: 'sans' | 'serif' | 'display' | 'script';
}> = [
  { family: 'Be Vietnam Pro', label: 'Be Vietnam Pro', category: 'sans' },
  { family: 'Inter', label: 'Inter', category: 'sans' },
  { family: 'Montserrat', label: 'Montserrat', category: 'sans' },
  { family: 'Roboto', label: 'Roboto', category: 'sans' },
  { family: 'Oswald', label: 'Oswald (đậm, thể thao)', category: 'display' },
  { family: 'Lora', label: 'Lora (serif)', category: 'serif' },
  { family: 'Playfair Display', label: 'Playfair Display (serif sang)', category: 'serif' },
  { family: 'Dancing Script', label: 'Dancing Script (chữ viết tay)', category: 'script' },
] as const;

// Register bundled fonts once at module load.
let fontsRegistered = false;
function ensureFonts() {
  if (fontsRegistered) return;
  try {
    GlobalFonts.registerFromPath(
      path.join(FONTS_DIR, 'Inter-Regular.ttf'),
      'Inter',
    );
    GlobalFonts.registerFromPath(
      path.join(FONTS_DIR, 'Inter-Bold.ttf'),
      'Inter',
    );
    GlobalFonts.registerFromPath(
      path.join(FONTS_DIR, 'Inter-Black.ttf'),
      'Inter',
    );
    GlobalFonts.registerFromPath(
      path.join(FONTS_DIR, 'BeVietnamPro-Regular.ttf'),
      'Be Vietnam Pro',
    );
    GlobalFonts.registerFromPath(
      path.join(FONTS_DIR, 'BeVietnamPro-SemiBold.ttf'),
      'Be Vietnam Pro',
    );
    GlobalFonts.registerFromPath(
      path.join(FONTS_DIR, 'BeVietnamPro-Bold.ttf'),
      'Be Vietnam Pro',
    );
    GlobalFonts.registerFromPath(
      path.join(FONTS_DIR, 'BeVietnamPro-Black.ttf'),
      'Be Vietnam Pro',
    );
    // FEATURE-091 — phông đa dạng (Google Fonts OFL, variable). Verified VN.
    GlobalFonts.registerFromPath(
      path.join(FONTS_DIR, 'Montserrat-VF.ttf'),
      'Montserrat',
    );
    GlobalFonts.registerFromPath(
      path.join(FONTS_DIR, 'Roboto-VF.ttf'),
      'Roboto',
    );
    GlobalFonts.registerFromPath(
      path.join(FONTS_DIR, 'Oswald-VF.ttf'),
      'Oswald',
    );
    GlobalFonts.registerFromPath(
      path.join(FONTS_DIR, 'Lora-VF.ttf'),
      'Lora',
    );
    GlobalFonts.registerFromPath(
      path.join(FONTS_DIR, 'PlayfairDisplay-VF.ttf'),
      'Playfair Display',
    );
    GlobalFonts.registerFromPath(
      path.join(FONTS_DIR, 'DancingScript-VF.ttf'),
      'Dancing Script',
    );
    fontsRegistered = true;
  } catch (err) {
    // Fonts missing is non-fatal — canvas will fall back to system fonts
    // eslint-disable-next-line no-console
    console.warn(`[certificates] font registration warning: ${String(err)}`);
  }
}

export interface RenderData {
  runner_name?: string;
  bib?: string | number;
  finish_time?: string;
  chip_time?: string;
  gun_time?: string;
  pace?: string;
  distance?: string;
  event_name?: string;
  event_date?: string;
  nation?: string;
  gender_rank?: string | number;
  ag_rank?: string | number;
  overall_rank?: string | number;
  runner_photo_url?: string | null;
  /**
   * FEATURE-090 — generic token map cho non-athlete render (vd Crew GCN:
   * {full_name}, {position}, {<cột tự do>}). Resolve SAU các token cố định.
   * Caller athlete cũ KHÔNG truyền → hành vi không đổi.
   */
  variables?: Record<string, string>;
}

/**
 * FEATURE-090 — subset template mà `render()` thực sự đọc. `CertificateTemplate`
 * (race-scoped) assignable; Crew GCN embed template (không race) cũng assignable.
 */
export interface RenderableTemplate {
  canvas: TemplateCanvas;
  layers: TemplateLayer[];
  photo_area?: PhotoArea | null;
  placeholder_photo_url?: string | null;
  photo_behind_background?: boolean;
}

@Injectable()
export class CertificateRenderService {
  private readonly logger = new Logger(CertificateRenderService.name);
  private readonly imageCache = new Map<string, Image>();

  constructor() {
    ensureFonts();
  }

  async render(
    template: RenderableTemplate,
    data: RenderData,
    options: { includePhoto?: boolean } = {},
  ): Promise<Buffer> {
    const {
      canvas: canvasDef,
      layers,
      photo_area,
      placeholder_photo_url,
      photo_behind_background,
    } = template;

    const includePhoto = options.includePhoto ?? true;

    const canvas = createCanvas(canvasDef.width, canvasDef.height);
    const ctx = canvas.getContext('2d');

    const photoUrl = includePhoto
      ? data.runner_photo_url || placeholder_photo_url || null
      : null;

    // Fill background color always
    ctx.fillStyle = canvasDef.backgroundColor || '#ffffff';
    ctx.fillRect(0, 0, canvasDef.width, canvasDef.height);

    if (photo_behind_background) {
      // ─── behind mode ───────────────────────────────────────────
      // 1. photo_area + "photo" layers (beneath the frame)
      if (includePhoto && photo_area && photoUrl) {
        try {
          await this.drawPhotoArea(ctx, photo_area, photoUrl);
        } catch (err) {
          this.logger.warn(`Photo area render failed: ${String(err)}`);
        }
      }
      if (includePhoto) {
        for (const layer of layers) {
          if (layer.type !== 'photo') continue;
          try {
            await this.drawLayer(ctx, layer, data);
          } catch (err) {
            this.logger.warn(`Photo layer render failed: ${String(err)}`);
          }
        }
      }

      // 2. background image (frame) on top of photo
      if (canvasDef.backgroundImageUrl) {
        try {
          await this.drawBackgroundImage(
            ctx,
            canvasDef.backgroundImageUrl,
            canvasDef.width,
            canvasDef.height,
          );
        } catch (err) {
          this.logger.warn(`Background image render failed: ${String(err)}`);
        }
      }

      // 3. remaining non-photo layers (text, image, shape)
      for (const layer of layers) {
        if (layer.type === 'photo') continue;
        try {
          await this.drawLayer(ctx, layer, data);
        } catch (err) {
          this.logger.warn(
            `Layer render failed (type=${layer.type}): ${String(err)}`,
          );
        }
      }
    } else {
      // ─── default mode (bg image behind everything) ────────────
      if (canvasDef.backgroundImageUrl) {
        try {
          await this.drawBackgroundImage(
            ctx,
            canvasDef.backgroundImageUrl,
            canvasDef.width,
            canvasDef.height,
          );
        } catch (err) {
          this.logger.warn(`Background image render failed: ${String(err)}`);
        }
      }

      for (const layer of layers) {
        if (!includePhoto && layer.type === 'photo') continue;
        try {
          await this.drawLayer(ctx, layer, data);
        } catch (err) {
          this.logger.warn(
            `Layer render failed (type=${layer.type}): ${String(err)}`,
          );
        }
      }

      if (includePhoto && photo_area && photoUrl) {
        try {
          await this.drawPhotoArea(ctx, photo_area, photoUrl);
        } catch (err) {
          this.logger.warn(`Photo area render failed: ${String(err)}`);
        }
      }
    }

    return Buffer.from(canvas.toBuffer('image/png'));
  }

  private async drawBackgroundImage(
    ctx: SKRSContext2D,
    url: string,
    width: number,
    height: number,
  ): Promise<void> {
    const img = await this.loadImageCached(url);
    const scale = Math.max(width / img.width, height / img.height);
    const sw = width / scale;
    const sh = height / scale;
    const sx = (img.width - sw) / 2;
    const sy = (img.height - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
  }

  private async drawLayer(
    ctx: SKRSContext2D,
    layer: TemplateLayer,
    data: RenderData,
  ): Promise<void> {
    ctx.save();
    ctx.globalAlpha = layer.opacity ?? 1;
    if (layer.rotation) {
      const cx = layer.x + (layer.width ?? 0) / 2;
      const cy = layer.y + (layer.height ?? 0) / 2;
      ctx.translate(cx, cy);
      ctx.rotate((layer.rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }

    switch (layer.type) {
      case 'text':
        this.drawTextLayer(ctx, layer, data);
        break;
      case 'image':
        await this.drawImageLayer(ctx, layer);
        break;
      case 'shape':
        this.drawShapeLayer(ctx, layer);
        break;
      case 'photo':
        // `photo` layer is an inline runner photo (alternative to top-level photo_area)
        await this.drawInlinePhotoLayer(ctx, layer, data);
        break;
    }

    ctx.restore();
  }

  private interpolate(text: string, data: RenderData): string {
    let out = text
      .replace(/\{runner_name\}/g, String(data.runner_name ?? ''))
      .replace(/\{bib\}/g, String(data.bib ?? ''))
      .replace(/\{finish_time\}/g, String(data.finish_time ?? ''))
      .replace(/\{chip_time\}/g, String(data.chip_time ?? data.finish_time ?? ''))
      .replace(/\{gun_time\}/g, String(data.gun_time ?? ''))
      .replace(/\{pace\}/g, String(data.pace ?? ''))
      .replace(/\{distance\}/g, String(data.distance ?? ''))
      .replace(/\{event_name\}/g, String(data.event_name ?? ''))
      .replace(/\{event_date\}/g, String(data.event_date ?? ''))
      .replace(/\{nation\}/g, String(data.nation ?? ''))
      .replace(/\{gender_rank\}/g, String(data.gender_rank ?? ''))
      .replace(/\{ag_rank\}/g, String(data.ag_rank ?? ''))
      .replace(/\{overall_rank\}/g, String(data.overall_rank ?? ''));
    // FEATURE-090 — generic token pass (Crew GCN: {full_name}/{position}/<cột>).
    // Chạy SAU token cố định; athlete cũ không truyền variables → no-op.
    if (data.variables) {
      for (const [key, value] of Object.entries(data.variables)) {
        out = out.replace(
          new RegExp(`\\{${this.escapeToken(key)}\\}`, 'g'),
          String(value ?? ''),
        );
      }
    }
    return out;
  }

  private escapeToken(token: string): string {
    return token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private buildFontString(layer: TemplateLayer): string {
    const weight = layer.fontWeight ?? '400';
    const size = layer.fontSize ?? 24;
    const family = layer.fontFamily ?? 'Inter';
    return `${weight} ${size}px "${family}", "Inter", "Be Vietnam Pro", sans-serif`;
  }

  private drawTextLayer(
    ctx: SKRSContext2D,
    layer: TemplateLayer,
    data: RenderData,
  ): void {
    const text = this.interpolate(layer.text ?? '', data);
    if (!text) return;

    ctx.fillStyle = layer.color ?? '#000000';
    ctx.font = this.buildFontString(layer);
    if (layer.letterSpacing) {
      ctx.letterSpacing = `${layer.letterSpacing}px`;
    }

    const maxWidth = layer.width;
    const align = layer.textAlign ?? 'left';
    const lineHeight = (layer.fontSize ?? 24) * (layer.lineHeight ?? 1.2);

    const lines = maxWidth
      ? this.wrapText(ctx, text, maxWidth)
      : [text];

    let y = layer.y + (layer.fontSize ?? 24);
    for (const line of lines) {
      let x = layer.x;
      if (maxWidth && align !== 'left') {
        const lineWidth = ctx.measureText(line).width;
        if (align === 'center') x = layer.x + (maxWidth - lineWidth) / 2;
        else if (align === 'right') x = layer.x + (maxWidth - lineWidth);
      }
      ctx.fillText(line, x, y);
      y += lineHeight;
    }

    if (layer.letterSpacing) {
      ctx.letterSpacing = '0px';
    }
  }

  private async drawImageLayer(
    ctx: SKRSContext2D,
    layer: TemplateLayer,
  ): Promise<void> {
    if (!layer.imageUrl) return;
    const img = await this.loadImageCached(layer.imageUrl);
    const w = layer.width ?? img.width;
    const h = layer.height ?? img.height;
    ctx.drawImage(img, layer.x, layer.y, w, h);
  }

  private drawShapeLayer(ctx: SKRSContext2D, layer: TemplateLayer): void {
    const w = layer.width ?? 0;
    const h = layer.height ?? 0;
    if (w <= 0 || h <= 0) return;

    ctx.fillStyle = layer.fill ?? '#000000';
    if (layer.stroke) ctx.strokeStyle = layer.stroke;
    if (layer.strokeWidth) ctx.lineWidth = layer.strokeWidth;

    switch (layer.shape) {
      case 'rect':
        ctx.fillRect(layer.x, layer.y, w, h);
        if (layer.stroke && layer.strokeWidth) {
          ctx.strokeRect(layer.x, layer.y, w, h);
        }
        break;
      case 'rounded_rect': {
        const r = Math.min(layer.borderRadius ?? 0, w / 2, h / 2);
        this.pathRoundedRect(ctx, layer.x, layer.y, w, h, r);
        ctx.fill();
        if (layer.stroke && layer.strokeWidth) ctx.stroke();
        break;
      }
      case 'circle': {
        const rx = w / 2;
        const ry = h / 2;
        ctx.beginPath();
        ctx.ellipse(layer.x + rx, layer.y + ry, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        if (layer.stroke && layer.strokeWidth) ctx.stroke();
        break;
      }
      case 'line':
        if (!layer.stroke || !layer.strokeWidth) break;
        ctx.beginPath();
        ctx.moveTo(layer.x, layer.y);
        ctx.lineTo(layer.x + w, layer.y + h);
        ctx.stroke();
        break;
    }
  }

  private async drawInlinePhotoLayer(
    ctx: SKRSContext2D,
    layer: TemplateLayer,
    data: RenderData,
  ): Promise<void> {
    const url = data.runner_photo_url || layer.imageUrl;
    if (!url) return;
    const img = await this.loadImageCached(url);
    const w = layer.width ?? img.width;
    const h = layer.height ?? img.height;
    const r = layer.borderRadius ?? 0;

    ctx.save();
    if (r > 0) {
      this.pathRoundedRect(ctx, layer.x, layer.y, w, h, Math.min(r, w / 2, h / 2));
      ctx.clip();
    }
    this.drawImageCover(ctx, img, layer.x, layer.y, w, h);
    ctx.restore();

    if (layer.photoBorderColor && layer.photoBorderWidth) {
      ctx.strokeStyle = layer.photoBorderColor;
      ctx.lineWidth = layer.photoBorderWidth;
      if (r > 0) {
        this.pathRoundedRect(ctx, layer.x, layer.y, w, h, Math.min(r, w / 2, h / 2));
        ctx.stroke();
      } else {
        ctx.strokeRect(layer.x, layer.y, w, h);
      }
    }
  }

  private async drawPhotoArea(
    ctx: SKRSContext2D,
    area: PhotoArea,
    url: string,
  ): Promise<void> {
    const img = await this.loadImageCached(url);
    const r = Math.min(area.borderRadius ?? 0, area.width / 2, area.height / 2);
    ctx.save();
    if (r > 0) {
      this.pathRoundedRect(ctx, area.x, area.y, area.width, area.height, r);
      ctx.clip();
    }
    this.drawImageCover(ctx, img, area.x, area.y, area.width, area.height);
    ctx.restore();
  }

  private drawImageCover(
    ctx: SKRSContext2D,
    img: Image,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void {
    const scale = Math.max(dw / img.width, dh / img.height);
    const sw = dw / scale;
    const sh = dh / scale;
    const sx = (img.width - sw) / 2;
    const sy = (img.height - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  }

  private pathRoundedRect(
    ctx: SKRSContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    ctx.beginPath();
    if (r >= Math.min(w, h) / 2 - 0.5) {
      // Use proper ellipse when radius covers the full short axis → perfect circle/oval
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    } else {
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
    }
    ctx.closePath();
  }

  private wrapText(
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

  private async loadImageCached(url: string): Promise<Image> {
    // Limit cache size — avoid unbounded growth on admins uploading many bgs.
    if (this.imageCache.size > 50) {
      const firstKey = this.imageCache.keys().next().value;
      if (firstKey) this.imageCache.delete(firstKey);
    }
    const cached = this.imageCache.get(url);
    if (cached) return cached;
    const img = await loadImage(url);
    this.imageCache.set(url, img);
    return img;
  }
}
