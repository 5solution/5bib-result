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
  useRef,
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
  // F-024 fix infinite loop: KHÔNG đưa `ctx` vào deps của useEffect.
  // Mỗi lần `setOverride` call → provider re-render → ctx object mới
  // → effect re-run → setOverride lại → loop infinite ("Maximum update
  // depth exceeded"). Dùng ref để effect luôn point tới ctx mới nhất
  // mà KHÔNG retrigger effect.
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  useEffect(() => {
    const c = ctxRef.current;
    if (!c) return;
    if (!segment) return;
    if (label && label.trim().length > 0) {
      c.setOverride(segment, label.trim());
    } else {
      c.setOverride(segment, null);
    }
    return () => {
      c.setOverride(segment, null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ctx truy cập qua ref intentionally
  }, [segment, label]);
}
