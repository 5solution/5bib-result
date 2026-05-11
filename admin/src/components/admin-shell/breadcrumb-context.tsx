"use client";

/**
 * F-024 UX-01 — Dynamic breadcrumb label provider.
 *
 * Pages có dynamic segment (vd `/contracts/[id]`) gọi `useSetCrumb(label)`
 * để inject label tiếng Việt cho ObjectId segment đang xem. Topbar đọc
 * label đó qua `useCrumb(segment)` và fallback "Chi tiết" nếu chưa load.
 *
 * Tránh tuyệt đối hiển thị raw ObjectId trong breadcrumb (UX-04).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type CrumbMap = Record<string, string>;

interface BreadcrumbContextValue {
  /** Map segment (raw URL segment) → label override (Vietnamese). */
  overrides: CrumbMap;
  /** Set / clear override cho 1 segment. */
  setOverride: (segment: string, label: string | null) => void;
}

const Ctx = createContext<BreadcrumbContextValue | null>(null);

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<CrumbMap>({});

  const setOverride = useCallback(
    (segment: string, label: string | null) => {
      setOverrides((prev) => {
        if (label === null) {
          if (!(segment in prev)) return prev;
          const { [segment]: _drop, ...rest } = prev;
          return rest;
        }
        if (prev[segment] === label) return prev;
        return { ...prev, [segment]: label };
      });
    },
    [],
  );

  const value = useMemo(
    () => ({ overrides, setOverride }),
    [overrides, setOverride],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBreadcrumbOverrides(): CrumbMap {
  const ctx = useContext(Ctx);
  return ctx?.overrides ?? {};
}

/**
 * Page-level hook: register a Vietnamese label cho dynamic segment đang xem.
 *
 * Usage:
 *   const { id } = use(params);
 *   useSetCrumb(id, contract?.contractNumber);
 *
 * Cleared tự động khi component unmount.
 */
export function useSetCrumb(segment: string, label: string | null | undefined) {
  const ctx = useContext(Ctx);
  useEffect(() => {
    if (!ctx) return;
    if (!segment) return;
    if (label && label.trim().length > 0) {
      ctx.setOverride(segment, label.trim());
    } else {
      ctx.setOverride(segment, null);
    }
    return () => {
      ctx.setOverride(segment, null);
    };
  }, [ctx, segment, label]);
}
