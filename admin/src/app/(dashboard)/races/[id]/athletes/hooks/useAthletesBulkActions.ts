'use client';

/**
 * F-014 BR-AS-15..18 — Bulk action hook (Manager Option B PLACEHOLDER).
 *
 * Backend bulk-action endpoint MISSING (Manager PAUSE #1). Danny APPROVED
 * deferring to F-014.5. F-014 ships UI placeholder + disabled mutation
 * + tooltip "Endpoint chưa sẵn sàng — F-014.5".
 *
 * When F-014.5 lands:
 *   1. Replace `mutationFn` with real endpoint call.
 *   2. Remove `defer = true` flag.
 *   3. Update tooltip in BulkActionBar.
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { ATHLETES_VN } from '../athletes.microcopy';
import { BULK_ACTION_CAP, type AthleteStatus } from '../athletes.constant';

export interface BulkActionPayload {
  athleteIds: string[];
  targetStatus: AthleteStatus;
  reason: string;
}

export interface UseAthletesBulkActionsResult {
  /** Currently selected athlete _ids (Set for O(1) lookup). */
  selected: Set<string>;
  toggle: (id: string) => void;
  toggleAll: (ids: string[]) => void;
  clear: () => void;
  /** True when bulk endpoint is wired (defer=true means UI-only). */
  defer: boolean;
  /** Stub mutation — toasts deferred message until F-014.5. */
  bulkChangeStatus: (payload: BulkActionPayload) => Promise<void>;
  /** UX guard: enforce 500-cap (BR-AS-17). */
  capExceeded: boolean;
}

export function useAthletesBulkActions(): UseAthletesBulkActionsResult {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = (ids: string[]) => {
    setSelected((prev) => {
      // If all currently in `ids` are already selected, clear those.
      const allSelected = ids.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const clear = () => setSelected(new Set());

  const bulkChangeStatus = async (_payload: BulkActionPayload) => {
    // F-014.5 placeholder — toast and no-op.
    toast.info(ATHLETES_VN.toastBulkDeferred);
  };

  return {
    selected,
    toggle,
    toggleAll,
    clear,
    defer: true,
    bulkChangeStatus,
    capExceeded: selected.size > BULK_ACTION_CAP,
  };
}
