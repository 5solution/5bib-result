'use client';

import { useState } from 'react';
import { medicalIncidentControllerExportPdf } from '@/lib/api-generated/sdk.gen';
import type { PdfExportOptionsDto } from '@/lib/api-generated/types.gen';
import { COPY } from '../medical.microcopy';

interface PdfExportButtonProps {
  raceId: string;
  /** When omitted, exports full race batch. */
  incidentIds?: string[];
  label?: string;
  onSuccess?: (signedUrl: string) => void;
}

export function PdfExportButton({
  raceId,
  incidentIds,
  label,
  onSuccess,
}: PdfExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const exportPdf = async () => {
    setLoading(true);
    setError(null);
    setWarning(null);
    try {
      const body: PdfExportOptionsDto = {
        incidentIds,
        includeAppendix: true,
        includeSignature: true,
      } as PdfExportOptionsDto;
      const res = await medicalIncidentControllerExportPdf({
        path: { raceId },
        body,
      });
      if (res.error || !res.data) {
        throw new Error(`HTTP ${res.response?.status ?? 0}`);
      }
      const json = res.data as { signedUrl: string; warning?: string };
      if (json.warning) setWarning(json.warning);
      onSuccess?.(json.signedUrl);
      window.open(json.signedUrl, '_blank', 'noopener');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={exportPdf}
        disabled={loading}
        className="min-h-[44px] rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium hover:bg-stone-50 disabled:opacity-50"
      >
        {loading ? 'Đang tạo PDF...' : label ?? COPY.detail.exportPdf}
      </button>
      {warning ? (
        <p className="text-xs text-amber-700">{warning}</p>
      ) : null}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
