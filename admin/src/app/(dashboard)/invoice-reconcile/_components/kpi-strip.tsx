"use client";

/**
 * F-076 — 4 KPI cards inline row.
 */
import { Card } from "@/components/ui/card";
import type { ReconcileReport } from "@/lib/invoice-reconcile-api";

interface Props {
  report: ReconcileReport;
}

function pct(n: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((n / total) * 100)}%`;
}

export function KpiStrip({ report }: Props) {
  // F-088 — error breakdown: ưu tiên backend, fallback tính từ report.
  const eb = report.errorBreakdown ?? {
    unissued: report.missing.filter((m) => m.bucket === "UNISSUED").length,
    duplicate: report.duplicateCount,
    orphan: report.misaOrphan.length,
    misaFail: 0,
    total:
      report.missing.filter((m) => m.bucket === "UNISSUED").length +
      report.duplicateCount +
      report.misaOrphan.length,
  };

  const kpis: Array<{
    title: string;
    value: number;
    subtitle: string;
    tone: "neutral" | "good" | "warn" | "danger" | "blink";
  }> = [
    {
      title: "Đơn cần xuất hôm nay",
      value: report.expectedCount,
      subtitle: `Race ${report.raceIdsScanned.join(", ")}`,
      tone: "neutral",
    },
    {
      title: "Đã xuất hôm nay",
      value: report.issuedCount,
      subtitle: pct(report.issuedCount, report.expectedCount),
      tone: "good",
    },
    {
      // F-088 — tổng tích lũy từ 08/06 (cumulativeIssued)
      title: "Tổng từ 08/06",
      value: report.cumulativeIssued ?? 0,
      subtitle: "Hóa đơn MISA (tích lũy)",
      tone: "neutral",
    },
    {
      title: "Còn thiếu",
      value: report.missingCount,
      subtitle: "Chưa xuất + DB chưa đồng bộ",
      tone: report.missingCount > 0 ? "warn" : "neutral",
    },
    {
      // F-088 — đang lỗi (snapshot) + breakdown
      title: "Đang lỗi",
      value: eb.total,
      subtitle: `Chưa xuất ${eb.unissued} · trùng ${eb.duplicate} · lạc ${eb.orphan} · MISA lỗi ${eb.misaFail}`,
      tone: eb.total > 0 ? "danger" : "good",
    },
    {
      title: "Đơn sắp phạt",
      value: report.atRiskCount,
      subtitle: "Age > 20h — Cần xử lý",
      tone: report.atRiskCount > 0 ? "blink" : "neutral",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {kpis.map((k) => (
        <Card key={k.title} className="p-4">
          <div className="text-xs uppercase tracking-wide text-stone-500">
            {k.title}
          </div>
          <div
            className={`mt-1 text-3xl font-bold ${toneText(k.tone)} ${
              k.tone === "blink" && k.value > 0 ? "animate-pulse" : ""
            }`}
          >
            {k.value}
          </div>
          <div className="mt-1 text-xs text-stone-600">{k.subtitle}</div>
        </Card>
      ))}
    </div>
  );
}

function toneText(
  tone: "neutral" | "good" | "warn" | "danger" | "blink",
): string {
  switch (tone) {
    case "good":
      return "text-emerald-600";
    case "warn":
      return "text-amber-600";
    case "danger":
      return "text-red-600";
    case "blink":
      return "text-red-600";
    default:
      return "text-stone-900";
  }
}
