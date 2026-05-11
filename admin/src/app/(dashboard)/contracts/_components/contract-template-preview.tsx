"use client";

/**
 * F-024 UX-39 v2 — Live preview pane cho rich editor.
 *
 * Reads plain-text body (database format) + array of all 11 articles →
 * renders single-pane "document" view với placeholder substitution.
 *
 * Toggle:
 *   - withSampleData=true → render `{key}` thay bằng SAMPLE_DATA
 *   - withSampleData=false → render raw `{key}` (highlighted) cho admin
 *     thấy đúng những gì lưu DB
 *
 * Unknown vars (typo) → wrapped in red pill để admin spot ngay.
 *
 * Render: iframe srcDoc với sandbox="" — defense in depth chống XSS từ
 * admin input.
 */

import { useMemo } from "react";
import { F024_VALID_KEYS } from "./contract-template-rich-editor";

// ────────────────────────────────────────────────────────────────────────────
// SAMPLE_DATA — flat key→string map. Nested keys (`client.entityName`)
// stored as literal dotted string so renderContent can look them up directly.
// ────────────────────────────────────────────────────────────────────────────
export const F024_SAMPLE_DATA: Record<string, string> = {
  "client.entityName": "CÔNG TY TNHH XYZ",
  "client.taxId": "0123456789",
  "client.representative": "Nguyễn Văn A",
  "client.position": "Giám đốc",
  "client.address": "Số 1, Đường ABC, Quận Hoàn Kiếm, TP Hà Nội",
  "client.phone": "0987 654 321",
  "client.email": "contact@xyz.vn",
  "client.bankAccount": "1234567890",
  "client.bankName": "Vietcombank CN Hà Nội",

  "provider.entityName": "CÔNG TY CỔ PHẦN 5BIB",
  "provider.taxId": "0110398986",
  "provider.address":
    "Tầng 9, Tòa nhà Hồ Gươm Plaza, 102 Trần Phú, Hà Đông, Hà Nội",
  "provider.representative": "Nguyễn Bình Minh",
  "provider.position": "Giám đốc",
  "provider.bankAccount": "110398986",
  "provider.bankName": "MB - Chi nhánh Thụy Khuê",

  contractNumber: "15.05/2026/HDDV/XYZ-5BIB",
  signDay: "15",
  signMonth: "05",
  signYear: "2026",
  signDate: "15/05/2026",

  raceName: "Giải chạy Mẫu Sơn 2026",
  raceDate: "06:00 ngày 15/06/2026",
  raceLocation: "Khu du lịch Mẫu Sơn, Lạng Sơn",
  athleteCount: "1.000",

  subtotal: "185.185.185",
  vatRate: "8",
  vatAmount: "14.814.815",
  totalAmount: "200.000.000",
  totalAmountInWords: "Hai trăm triệu đồng chẵn",

  "paymentTerms.advanceAmount": "100.000.000",
  "paymentTerms.advancePercentage": "50",
  "paymentTerms.remainderAmount": "100.000.000",
  "paymentTerms.latePenaltyRate": "0.02",
  "paymentTerms.latePenaltyUnit": "%/ngày",

  ticketFeePercent: "6",
  athleteManagementFee: "10.000",
};

const HTML_ESCAPE_RE = /[&<>"]/g;
const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

function escapeHtml(s: string): string {
  return s.replace(HTML_ESCAPE_RE, (c) => HTML_ESCAPE_MAP[c] ?? c);
}

/**
 * Replace `{key}` and `{nested.path}` in plain-text body.
 * Known keys → sample value (or highlighted raw placeholder if !withSample).
 * Unknown keys → red pill (admin typo detection).
 *
 * Regex: `\{([\w.]+)\}` — alphanumerics, underscore, dot. NO whitespace
 * inside braces (matches F-024 spec section 2). Also NOT greedy across
 * newlines (single-line content per match).
 */
function renderArticleBody(body: string, withSample: boolean): string {
  // Escape entire body first (it's plain text — no HTML in DB).
  // Then re-inject placeholder spans where matches found.
  // Strategy: split on placeholder pattern → escape each chunk → reinsert spans.
  const PLACEHOLDER_RE = /\{([\w.]+)\}/g;
  let out = "";
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = PLACEHOLDER_RE.exec(body)) !== null) {
    // Escape preceding text
    out += escapeHtml(body.slice(lastIdx, m.index));
    const key = m[1];
    const known = F024_VALID_KEYS.includes(key);
    if (!known) {
      out += `<span style="background:#fee2e2;color:#b91c1c;padding:1px 6px;border-radius:3px;font-family:monospace;font-size:0.85em" title="Biến không hợp lệ — kiểm tra chính tả">{${escapeHtml(
        key,
      )}}</span>`;
    } else if (!withSample) {
      out += `<span style="background:#dbeafe;color:#1e40af;padding:1px 6px;border-radius:3px;font-family:monospace;font-size:0.85em">{${escapeHtml(
        key,
      )}}</span>`;
    } else {
      const v = F024_SAMPLE_DATA[key];
      out += v != null ? escapeHtml(v) : "";
    }
    lastIdx = m.index + m[0].length;
  }
  // Escape trailing
  out += escapeHtml(body.slice(lastIdx));
  // Preserve newlines as <br>
  return out.replace(/\n/g, "<br>");
}

const WRAPPER_STYLE = `
  body {
    background: #fff;
    margin: 0;
    padding: 16px;
    font-family: "Times New Roman", Times, serif;
    font-size: 13pt;
    line-height: 1.55;
    color: #1c1917;
  }
  h3.article-heading {
    font-size: 14pt;
    font-weight: 700;
    margin-top: 18pt;
    margin-bottom: 6pt;
    text-transform: uppercase;
  }
  h3.article-heading:first-child { margin-top: 0; }
  .article-body { white-space: normal; }
  strong, b { font-weight: 700; }
  em, i { font-style: italic; }
  u { text-decoration: underline; }
  table { width: 100%; border-collapse: collapse; }
  td, th { vertical-align: top; }
`;

export interface PreviewArticle {
  key: string;
  heading: string;
  body: string;
}

interface ContractTemplatePreviewProps {
  articles: PreviewArticle[];
  withSampleData: boolean;
}

export default function ContractTemplatePreview({
  articles,
  withSampleData,
}: ContractTemplatePreviewProps): React.ReactElement {
  const srcDoc = useMemo(() => {
    const bodyHtml = articles
      .map((art) => {
        const renderedBody = renderArticleBody(art.body, withSampleData);
        return `<section data-key="${escapeHtml(
          art.key,
        )}"><h3 class="article-heading">${escapeHtml(
          art.heading,
        )}</h3><div class="article-body">${renderedBody}</div></section>`;
      })
      .join("");
    return `<!doctype html><html><head><meta charset="utf-8"><style>${WRAPPER_STYLE}</style></head><body>${bodyHtml}</body></html>`;
  }, [articles, withSampleData]);

  return (
    <iframe
      title="Contract template preview"
      sandbox=""
      srcDoc={srcDoc}
      className="h-full min-h-[600px] w-full rounded-md border bg-white"
    />
  );
}
