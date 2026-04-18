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
}

const SAMPLE_DATA: Record<string, string> = {
  full_name: "Nguyễn Văn A",
  phone: "0901234567",
  email: "nguyenvana@gmail.com",
  cccd: "001234567890",
  dob: "15/05/1995",
  event_name: "HHTT 2026",
  event_start_date: "01/05/2026",
  event_end_date: "02/05/2026",
  event_location: "TP Vinh, Nghệ An",
  role_name: "Crew - Hậu Cần",
  daily_rate: "300.000",
  working_days: "2",
  total_compensation: "600.000",
  signed_date: "15/04/2026",
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
function renderContent(html: string, withSampleData: boolean): string {
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
    const sample = SAMPLE_DATA[key];
    return sample != null ? escapeHtml(sample) : "";
  });
}

const WRAPPER_STYLE = `
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 14px;
    color: #1c1917;
    background: #fff;
    padding: 32px;
    margin: 0;
    line-height: 1.6;
  }
  h1 { font-size: 22px; margin: 16px 0 8px; }
  h2 { font-size: 18px; margin: 14px 0 6px; }
  h3 { font-size: 16px; margin: 12px 0 6px; }
  p { margin: 8px 0; }
  ul, ol { margin: 8px 0; padding-left: 24px; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #e5e7eb; padding: 6px 8px; }
  strong, b { font-weight: 700; }
  em, i { font-style: italic; }
  u { text-decoration: underline; }
`;

export default function ContractPreview({
  contentHtml,
  withSampleData,
}: ContractPreviewProps): React.ReactElement {
  const srcDoc = useMemo(() => {
    const body = renderContent(contentHtml, withSampleData);
    return `<!doctype html><html><head><meta charset="utf-8"><style>${WRAPPER_STYLE}</style></head><body>${body}</body></html>`;
  }, [contentHtml, withSampleData]);

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
