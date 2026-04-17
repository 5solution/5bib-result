import { Logger } from '@nestjs/common';
import puppeteer, { Browser } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const logger = new Logger('PdfRenderer');

/**
 * Lazily resolved executable path. On Mac dev this downloads/caches
 * chromium the first time; in Docker Alpine + AWS Lambda it uses the
 * bundled binary. Override via `CHROMIUM_PATH` env when shipping a
 * system-installed chromium.
 */
async function resolveExecutablePath(): Promise<string> {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  return chromium.executablePath();
}

/**
 * HTML → PDF buffer. Caller MUST await and handle errors; we close the
 * browser even if `page.pdf()` throws so we don't leak headless processes.
 */
export async function htmlToPdfBuffer(html: string): Promise<Buffer> {
  const executablePath = await resolveExecutablePath();
  let browser: Browser | null = null;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: true,
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30_000 });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '18mm', right: '18mm', bottom: '18mm', left: '18mm' },
    });
    return Buffer.from(pdf);
  } catch (err) {
    logger.error(`PDF render failed: ${(err as Error).message}`);
    throw err;
  } finally {
    if (browser) {
      await browser.close().catch((err) => logger.warn(`Browser close failed: ${err.message}`));
    }
  }
}

/**
 * Convert DOCX → HTML via mammoth. Extracts body styles but strips scripts.
 * Returns HTML and any conversion warnings.
 */
export async function docxToHtml(
  buffer: Buffer,
): Promise<{ html: string; warnings: string[] }> {
  // Dynamic import because mammoth is CJS but we want lazy-load.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mammoth = require('mammoth') as typeof import('mammoth');
  const result = await mammoth.convertToHtml({ buffer });
  const sanitized = sanitizeHtml(result.value);
  return {
    html: sanitized,
    warnings: result.messages.map((m) => `${m.type}: ${m.message}`),
  };
}

/**
 * Replace `{{key}}` tokens with HTML-escaped values from the map.
 * Unknown keys are left untouched so admins can preview missing vars.
 */
export function renderTemplate(
  template: string,
  vars: Record<string, string | number | null | undefined>,
): string {
  return template.replace(/{{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*}}/g, (match, key: string) => {
    if (!(key in vars)) return match;
    const v = vars[key];
    if (v == null) return '';
    return escapeHtml(String(v));
  });
}

/**
 * Strip `<script>` / `<style>` / inline event handlers from arbitrary HTML.
 * Contracts are user-uploaded so the admin can paste adversarial markup.
 */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Wrap rendered template HTML with the document shell (fonts, page margins,
 * print CSS). Keep it tiny — we don't want external network reqs during
 * puppeteer networkidle wait.
 */
export function wrapContractDocument(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>Hợp đồng</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body {
      font-family: "Helvetica", "Arial", sans-serif;
      font-size: 11pt;
      line-height: 1.55;
      color: #1c1917;
      margin: 0;
    }
    h1, h2, h3 { font-weight: 700; color: #0f172a; }
    table { border-collapse: collapse; width: 100%; margin: 0.6em 0; }
    table, th, td { border: 1px solid #c7c3bd; padding: 6px 8px; }
    .sig-block { margin-top: 3em; }
  </style>
</head>
<body>${bodyHtml}</body>
</html>`;
}
