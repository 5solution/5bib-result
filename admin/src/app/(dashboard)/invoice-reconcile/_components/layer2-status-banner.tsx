"use client";

/**
 * F-076 — Layer 2 status banner (BR-17 graceful degradation).
 */
import { AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";
import type { Layer2Status } from "@/lib/invoice-reconcile-api";
import { LAYER2_STATUS_LABEL } from "@/lib/invoice-reconcile-labels";

interface Props {
  status: Layer2Status;
}

export function Layer2StatusBanner({ status }: Props) {
  if (status === "OK") return null; // no banner when healthy

  const isUnavailable = status === "UNAVAILABLE";
  const Icon = isUnavailable ? AlertCircle : AlertTriangle;
  const containerClass = isUnavailable
    ? "border-red-300 bg-red-50 text-red-900"
    : "border-amber-300 bg-amber-50 text-amber-900";

  return (
    <div className={`flex items-center gap-3 rounded-md border px-4 py-3 ${containerClass}`}>
      <Icon className="h-5 w-5 flex-shrink-0" />
      <div className="text-sm">
        <strong>
          {isUnavailable ? "🔴 MISA UNREACHABLE" : "⚠️ MISA chậm"}
        </strong>
        <span className="ml-2">{LAYER2_STATUS_LABEL[status]}</span>
      </div>
    </div>
  );
}
