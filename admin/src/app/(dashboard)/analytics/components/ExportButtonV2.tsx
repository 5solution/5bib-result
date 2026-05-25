"use client";

/**
 * F-062 Wave 4 NEW — Export CSV/Excel button (BR-SA-10 v3).
 *
 * Triggers GET /api/analytics/export with format + reportType + period filters.
 * File downloads via fetch + Blob → click anchor.
 */

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  reportType: "overview" | "revenue" | "races" | "merchants" | "funnel" | "runners";
  query: { from?: string; to?: string; month?: string; tenantId?: number };
  format?: "csv" | "xlsx";
  label?: string;
}

export function ExportButtonV2({ reportType, query, format = "xlsx", label }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("format", format);
      params.set("reportType", reportType);
      if (query.from) params.set("from", query.from);
      if (query.to) params.set("to", query.to);
      if (query.month) params.set("month", query.month);
      if (query.tenantId) params.set("tenantId", String(query.tenantId));

      const res = await fetch(`/api/analytics/export?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const cd = res.headers.get("Content-Disposition") ?? "";
      const filenameMatch = /filename="([^"]+)"/.exec(cd);
      const filename =
        filenameMatch?.[1] ??
        `5bib-analytics-${reportType}-${Date.now()}.${format}`;
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Đã tải ${filename}`);
    } catch (e) {
      toast.error(`Export thất bại: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      <Download className="h-4 w-4" />
      {label ?? `Xuất ${format.toUpperCase()}`}
    </Button>
  );
}
