import { Logger } from '@nestjs/common';
import puppeteer, { Browser } from 'puppeteer-core';
// CJS packages whose `module.exports` is the callable/class itself cannot
// be default-imported in our tsconfig (no esModuleInterop). `import =
// require` works for libs that also publish CJS-flavoured types, but
// `@sparticuz/chromium` ships an ESM-only `.d.ts` that TypeScript resolves
// to a namespace with `{ default: Chromium }`. At runtime `require(...)`
// returns the class directly (no `.default`). We reach for the untyped
// `require` and apply our own shape — matches the static methods we use.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const chromium: {
  executablePath: (input?: string) => Promise<string>;
  args: string[];
} = require('@sparticuz/chromium');
import sanitizeHtmlLib = require('sanitize-html');

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
    // When CHROMIUM_PATH points to a system Chrome (macOS dev), the
    // Lambda-tailored args from @sparticuz/chromium crash it with
    // "Target closed". Use a minimal arg set in that case.
    const usingSystemChrome = !!process.env.CHROMIUM_PATH;
    const args = usingSystemChrome
      ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      : chromium.args;
    browser = await puppeteer.launch({
      args,
      executablePath,
      headless: true,
    });
    const page = await browser.newPage();
    // Block all subresource fetches to prevent SSRF via attacker template
    // content (<img src="http://169.254.169.254/...">). Only the main
    // document and embedded data: URLs are allowed through.
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      const isMainFrameDoc =
        req.resourceType() === 'document' && req.frame() === page.mainFrame();
      const isDataUrl = url.startsWith('data:');
      if (isMainFrameDoc || isDataUrl) {
        void req.continue();
      } else {
        void req.abort();
      }
    });
    // networkidle0 would wait for aborted requests — use 'load' since all
    // subresources are blocked anyway.
    await page.setContent(html, { waitUntil: 'load', timeout: 30_000 });
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
  let result: Awaited<ReturnType<typeof mammoth.convertToHtml>>;
  try {
    result = await mammoth.convertToHtml({ buffer });
  } catch (err) {
    throw new Error(
      `Invalid DOCX file: ${(err as Error).message || 'could not parse'}`,
    );
  }
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
 * Strip scripts, styles, on* handlers, and dangerous URL schemes from
 * arbitrary HTML. Contracts come from admin input (paste or DOCX), which
 * must be treated as semi-trusted — a compromised admin can otherwise
 * plant XSS in the crew-facing contract preview.
 *
 * Allowlist approach via `sanitize-html`:
 *   - tags: structural text + tables + imgs + basic formatting
 *   - attributes: no `on*`, no `style` keyword URLs, no `srcset`
 *   - URL schemes: http, https, mailto, tel, data: (images only)
 */
export function sanitizeHtml(html: string): string {
  return sanitizeHtmlLib(html, {
    allowedTags: [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'p',
      'span',
      'div',
      'br',
      'hr',
      'strong',
      'em',
      'b',
      'i',
      'u',
      'a',
      'ul',
      'ol',
      'li',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'img',
      'blockquote',
      'pre',
      'code',
      'sub',
      'sup',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target'],
      img: ['src', 'alt', 'width', 'height'],
      '*': ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: {
      img: ['http', 'https', 'data'],
    },
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    enforceHtmlBoundary: false,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export { escapeHtml };

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
