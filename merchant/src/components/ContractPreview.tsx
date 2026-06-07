"use client";

import { useMemo } from "react";
import { VALID_VARIABLES } from "./ContractEditor";

interface ContractPreviewProps {
  contentHtml: string;
  /**
   * When true, substitute {{vars}} with SAMPLE_DATA before rendering.
   * When false, render raw HTML with {{vars}} visible so admin can see
   * exactly what the template stores.
   */
  withSampleData: boolean;
  /**
   * Optional overrides that take priority over SAMPLE_DATA.
   * Used to reflect live form values (e.g. Party A fields) in the preview.
   */
  sampleOverrides?: Record<string, string>;
}

const SAMPLE_DATA: Record<string, string> = {
  full_name: "Nguyễn Văn A",
  phone: "0901234567",
  email: "nguyenvana@gmail.com",
  cccd: "001234567890",
  dob: "15/05/1995",
  birth_date: "15/05/1995",
  cccd_issue_date: "01/01/2021",
  cccd_issue_place: "Cục Cảnh sát quản lý hành chính về TTXH",
  address: "123 Đường Láng, Đống Đa, Hà Nội",
  bank_account_number: "19036612345678",
  bank_name: "Techcombank",
  tax_code: "001234567890",
  event_name: "HHTT 2026",
  event_start_date: "01/05/2026",
  event_end_date: "02/05/2026",
  event_location: "TP Vinh, Nghệ An",
  role_name: "Crew - Hậu Cần",
  daily_rate: "300.000",
  working_days: "2",
  total_compensation: "600.000",
  signed_date: "15/04/2026",
  // Contract aliases (from seeded DOCX template)
  sign_date: "15/04/2026",
  cccd_number: "001234567890",
  work_content: "Hỗ trợ hậu cần, phát áo, phát BIB cho vận động viên",
  work_location: "TP Vinh, Nghệ An",
  work_period: "01/05/2026 – 02/05/2026",
  unit_price: "300.000",
  unit_price_words: "Ba trăm nghìn đồng",
  // Party A sample — shown in preview so admin sees layout with real-looking data
  party_a_company_name:  "CÔNG TY CỔ PHẦN 5BIB",
  party_a_address:       "Tầng 9, Tòa nhà Hồ Gươm Plaza, Số 102 Phố Trần Phú, Phường Mộ Lao, Quận Hà Đông, TP Hà Nội",
  party_a_tax_code:      "0110398986",
  party_a_representative:"Nguyễn Bình Minh",
  party_a_position:      "Giám đốc",
  // Acceptance (Biên bản nghiệm thu) sample data
  acceptance_date:        "25/04/2026",
  acceptance_value:       "600.000",
  acceptance_value_words: "Sáu trăm nghìn đồng",
  // SVG sample signature so the preview shows what the signed document looks like.
  // The actual value at runtime is a PNG data URL from the signature pad.
  signature_image: "data:image/svg+xml;base64," + btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="70" viewBox="0 0 220 70">' +
    '<path d="M12,52 C25,20 40,58 58,38 C72,22 88,55 106,35 C122,18 140,50 158,32 C172,18 188,45 208,38" ' +
    'stroke="#1a1a2e" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M30,58 C50,54 80,60 110,57 C140,54 170,60 200,56" ' +
    'stroke="#1a1a2e" stroke-width="1.2" fill="none" stroke-linecap="round" opacity="0.4"/>' +
    '</svg>'
  ),
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Replace {{variable}} tokens. Known vars become sample values (or the
 * raw placeholder if `withSampleData` is false). Unknown vars — typos —
 * are wrapped in a red pill so admin spots them instantly.
 */
function renderContent(
  html: string,
  withSampleData: boolean,
  overrides?: Record<string, string>,
): string {
  const merged = overrides ? { ...SAMPLE_DATA, ...overrides } : SAMPLE_DATA;
  return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, rawKey: string) => {
    const key = rawKey.trim();
    const known = VALID_VARIABLES.includes(key);
    if (!known) {
      return `<span style="background:#fee2e2;color:#b91c1c;padding:1px 6px;border-radius:3px;font-family:monospace;font-size:0.85em" data-invalid-var="${escapeHtml(
        key,
      )}">{{${escapeHtml(key)}}}</span>`;
    }
    if (!withSampleData) {
      return `<span style="background:#dbeafe;color:#1e40af;padding:1px 6px;border-radius:3px;font-family:monospace;font-size:0.85em">{{${escapeHtml(
        key,
      )}}}</span>`;
    }
    const sample = merged[key];
    return sample != null ? escapeHtml(sample) : "";
  });
}

// Minimal base styles — intentionally sparse so templates that embed their
// own <style> block (e.g. the contract template with Times New Roman, .center,
// .signature table, etc.) can fully control their own typography.
// Rules here are only fallback defaults for templates that have no inline CSS.
const WRAPPER_STYLE = `
  body {
    background: #fff;
    margin: 0;
  }
  strong, b { font-weight: 700; }
  em, i { font-style: italic; }
  u { text-decoration: underline; }
  /* Table defaults — templates that need borders add them via inline style.
     Signature tables use border:none on td so they render without grid lines. */
  table { width: 100%; border-collapse: collapse; }
  td, th { vertical-align: top; }
`;

export default function ContractPreview({
  contentHtml,
  withSampleData,
  sampleOverrides,
}: ContractPreviewProps): React.ReactElement {
  const srcDoc = useMemo(() => {
    const body = renderContent(contentHtml, withSampleData, sampleOverrides);
    return `<!doctype html><html><head><meta charset="utf-8"><style>${WRAPPER_STYLE}</style></head><body>${body}</body></html>`;
  }, [contentHtml, withSampleData, sampleOverrides]);

  return (
    <iframe
      title="Contract preview"
      // Empty sandbox blocks scripts + forms + same-origin — safest option
      // since the HTML comes from admin input. allow-same-origin is NOT
      // set; the iframe will still render static markup correctly.
      sandbox=""
      srcDoc={srcDoc}
      className="h-full min-h-[600px] w-full rounded-md border bg-white"
    />
  );
}
