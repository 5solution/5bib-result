"use client";

/**
 * F-024 UX-39 v3 Task 1 — Audit Viewer component.
 *
 * Render template DOCX → HTML qua backend mammoth endpoint, hiển thị
 * trong iframe sandbox để CSS isolation. READ-ONLY — viewer purely audit.
 *
 * KHÔNG roundtrip → fidelity 100% so với DOCX gốc (header/footer style sẽ
 * không hiển thị vì mammoth chỉ extract body — đó là expected, vì header/
 * footer giữ nguyên ở DOCX, audit viewer chỉ show body để verify
 * Bên A/B + 11 điều + phụ lục + signature).
 */
import { useEffect, useState } from "react";
import { AlertCircle, FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getContractTemplatePreviewHtml,
  type ContractType,
} from "@/lib/contracts-api";

interface Props {
  type: ContractType;
  /** Counter to force refresh — increment after upload. */
  refreshKey?: number;
}

// CSS inject vào iframe — font Times 13pt + page A4 width + spacing
const IFRAME_STYLE = `
  body {
    font-family: "Times New Roman", Times, serif;
    font-size: 13pt;
    line-height: 1.55;
    color: #1c1917;
    background: #fafaf9;
    margin: 0;
    padding: 28px 44px;
    max-width: 794px; /* A4 width approx */
  }
  h1, h2, h3, h4 {
    margin: 1.2em 0 0.6em;
    line-height: 1.2;
  }
  h1.contract-title {
    text-align: center;
    font-size: 18pt;
    font-weight: 700;
  }
  h2.contract-subtitle {
    text-align: center;
    font-size: 14pt;
    font-weight: 600;
  }
  h1.contract-h1, h2.contract-h2 {
    font-weight: 700;
  }
  p {
    margin: 0.5em 0;
    text-align: justify;
  }
  table {
    border-collapse: collapse;
    margin: 0.8em 0;
    width: 100%;
    font-size: 11.5pt;
  }
  table, th, td {
    border: 1px solid #44403c;
  }
  th, td {
    padding: 5px 8px;
    vertical-align: top;
  }
  th {
    background: #f3f0eb;
    font-weight: 700;
  }
  strong { font-weight: 700; }
  em { font-style: italic; }
  ul, ol { padding-left: 1.4em; }
  li { margin: 0.25em 0; }
`;

export function TemplatePreviewViewer({
  type,
  refreshKey = 0,
}: Props): React.ReactElement {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{
    cached: boolean;
    templateFile: string;
  } | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let abort = false;
    setLoading(true);
    setError(null);
    getContractTemplatePreviewHtml(type)
      .then((res) => {
        if (abort) return;
        setHtml(res.html);
        setMeta({ cached: res.cached, templateFile: res.templateFile });
      })
      .catch((err: Error) => {
        if (!abort) setError(err.message);
      })
      .finally(() => {
        if (!abort) setLoading(false);
      });
    return () => {
      abort = true;
    };
  }, [type, refreshKey, reloadTick]);

  const srcDoc = html
    ? `<!doctype html><html><head><meta charset="utf-8"><style>${IFRAME_STYLE}</style></head><body>${html}</body></html>`
    : "";

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 p-8 text-center">
        <AlertCircle className="size-10 text-amber-600" />
        <div>
          <p className="text-sm font-semibold text-amber-900">
            Không tải được mẫu DOCX
          </p>
          <p className="mt-1 text-xs text-amber-700">{error}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setReloadTick((t) => t + 1)}
        >
          <RefreshCw className="mr-1.5 size-3.5" /> Thử lại
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between border-b border-[var(--border,#E7E2D9)] bg-[#F3F0EB]/60 px-4 py-2">
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted,#78716C)]">
          <FileText className="size-3.5" />
          <span>
            Mẫu nguồn:{" "}
            <code className="rounded bg-white px-1 font-mono text-[11px]">
              {meta?.templateFile ?? "—"}
            </code>
          </span>
          {meta?.cached ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              cache 60s
            </span>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setReloadTick((t) => t + 1)}
          title="Tải lại preview"
        >
          <RefreshCw className="size-3.5" />
        </Button>
      </div>
      <iframe
        title={`Audit viewer ${type}`}
        sandbox=""
        srcDoc={srcDoc}
        className="h-[calc(100vh-18rem)] min-h-[480px] w-full border-0 bg-white"
      />
      <div className="border-t border-[var(--border,#E7E2D9)] bg-[#F3F0EB]/40 px-4 py-2 text-[11px] text-[var(--text-muted,#78716C)]">
        Viewer chỉ hiển thị thân hợp đồng (Bên A/B + 11 điều + phụ lục +
        signature). Header/footer DOCX gốc giữ nguyên khi xuất file thật.
      </div>
    </div>
  );
}

export default TemplatePreviewViewer;
