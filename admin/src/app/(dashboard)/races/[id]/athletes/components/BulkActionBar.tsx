'use client';

/**
 * F-014 BR-AS-15..18 — Sticky-bottom bulk action bar.
 *
 * Visible only when ≥1 athlete selected. Bulk endpoint is DEFERRED
 * (Manager Option B, F-014.5). Buttons render disabled with tooltip
 * "Endpoint chưa sẵn sàng". CSV export of selection works today.
 *
 * 500-cap warning surfaced inline (BR-AS-17).
 */

import { Button } from '@/components/ui/button';
import { ArrowRightLeft, Download, X } from 'lucide-react';
import { ATHLETES_VN } from '../athletes.microcopy';
import { BULK_ACTION_CAP } from '../athletes.constant';

interface BulkActionBarProps {
  selectedCount: number;
  capExceeded: boolean;
  defer: boolean;
  onChangeStatus: () => void;
  onExportCsv: () => void;
  onClear: () => void;
}

export function BulkActionBar(props: BulkActionBarProps) {
  const { selectedCount, capExceeded, defer, onChangeStatus, onExportCsv, onClear } =
    props;
  if (selectedCount === 0) return null;

  return (
    <div
      role="region"
      aria-label="Thanh hành động hàng loạt"
      className="sticky bottom-4 z-30 mx-auto flex max-w-3xl items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/95 px-4 py-2 shadow-lg backdrop-blur-sm"
      data-testid="bulk-action-bar"
    >
      <span className="text-sm font-semibold text-blue-900">
        {ATHLETES_VN.bulkSelected(selectedCount)}
      </span>
      {capExceeded && (
        <span className="text-xs text-rose-700 font-medium">
          {ATHLETES_VN.bulkCapWarning(BULK_ACTION_CAP)}
        </span>
      )}
      <div className="ml-auto flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onChangeStatus}
          disabled={defer || capExceeded}
          title={defer ? ATHLETES_VN.bulkDisabledTip : undefined}
          data-testid="bulk-change-status"
        >
          <ArrowRightLeft className="size-4 mr-1.5" />
          {ATHLETES_VN.bulkChangeStatus}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onExportCsv}
          disabled={capExceeded}
          data-testid="bulk-export"
        >
          <Download className="size-4 mr-1.5" />
          {ATHLETES_VN.bulkExport}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClear}
          data-testid="bulk-clear"
        >
          <X className="size-4 mr-1.5" />
          {ATHLETES_VN.bulkClearSelection}
        </Button>
      </div>
    </div>
  );
}

export default BulkActionBar;
