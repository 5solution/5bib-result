"use client";

import { useState } from "react";
import { Download } from "lucide-react";

interface Props {
  onExportPdf: () => Promise<void> | void;
  onExportExcel: () => Promise<void> | void;
}

/**
 * F-026 BR-22/23/24 — Export PDF + Excel manual click MVP.
 */
export function ExportButton({ onExportPdf, onExportExcel }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const wrap = async (fn: () => Promise<void> | void) => {
    setBusy(true);
    setOpen(false);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((s) => !s)}
        className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-900 hover:bg-stone-50 disabled:opacity-60"
      >
        <Download className="size-4" />
        {busy ? "Đang xuất..." : "Export"}
      </button>
      {open && !busy && (
        <div className="absolute right-0 top-full mt-1 w-44 rounded-md border border-stone-200 bg-white shadow-lg z-20">
          <button
            type="button"
            onClick={() => wrap(onExportPdf)}
            className="block w-full px-3 py-2 text-left text-sm hover:bg-stone-50"
          >
            Export PDF (A4)
          </button>
          <button
            type="button"
            onClick={() => wrap(onExportExcel)}
            className="block w-full px-3 py-2 text-left text-sm hover:bg-stone-50"
          >
            Export Excel
          </button>
        </div>
      )}
    </div>
  );
}
