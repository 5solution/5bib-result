'use client';

/**
 * F-014 BR-AS-28/29 — Per-section dirty state tracker.
 *
 * Each Settings section is a self-contained form. Dirty state is local
 * to the section but the SettingsLayout's left rail needs an aggregate
 * "which sections are dirty" map to render the chấm cam (orange dot).
 *
 * Pattern: parent calls `useDirtyFormPerSection()` → returns
 * `{ dirtyMap, setDirty }`. Each section calls `setDirty(id, isDirty)`
 * when its react-hook-form `formState.isDirty` flips. Save success →
 * section calls `setDirty(id, false)`.
 *
 * No autosave block, no confirm prompt — admin-trust philosophy.
 */

import { useCallback, useState } from 'react';

export type DirtyMap = Record<string, boolean>;

export interface UseDirtyFormPerSectionResult {
  dirtyMap: DirtyMap;
  setDirty: (sectionId: string, dirty: boolean) => void;
  /** True if ANY section is dirty (header save-bar use). */
  anyDirty: boolean;
  /** Clear ALL dirty flags (e.g., after global save / refetch). */
  clearAll: () => void;
}

export function useDirtyFormPerSection(): UseDirtyFormPerSectionResult {
  const [dirtyMap, setMap] = useState<DirtyMap>({});

  const setDirty = useCallback((sectionId: string, dirty: boolean) => {
    setMap((prev) => {
      // Avoid re-render churn when value hasn't changed.
      if (Boolean(prev[sectionId]) === dirty) return prev;
      const next = { ...prev };
      if (dirty) next[sectionId] = true;
      else delete next[sectionId];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setMap({});
  }, []);

  const anyDirty = Object.keys(dirtyMap).length > 0;

  return { dirtyMap, setDirty, anyDirty, clearAll };
}
