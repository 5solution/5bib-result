'use client';

/**
 * F-009 AIMS/ITRA disclaimer banner (BR-CM2-30 + Race Ops Expert mandate).
 *
 * GPX là tham khảo. Course measurement chính thức cần Jones Counter (AIMS) hoặc
 * GPS multi-device average (ITRA). Banner re-shows after 7 days (PAUSE-CM2-07).
 */

import * as React from 'react';
import { Info, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'aims-itra-disclaimer-dismissed';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function AimsItraDisclaimerBanner(): React.ReactElement | null {
  const [dismissed, setDismissed] = React.useState(true); // start hidden — show only after hydration check

  React.useEffect(() => {
    // SSR-safe: only access localStorage on client.
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && Date.now() - Number(stored) < DISMISS_DURATION_MS) {
        setDismissed(true);
      } else {
        setDismissed(false);
      }
    } catch {
      // localStorage unavailable (SSR / disabled) → show banner.
      setDismissed(false);
    }
  }, []);

  const handleDismiss = React.useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      /* noop */
    }
    setDismissed(true);
  }, []);

  if (dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm"
    >
      <Info className="mt-0.5 size-4 shrink-0 text-blue-600" aria-hidden="true" />
      <div className="flex-1">
        <p className="font-semibold text-blue-900">
          Lưu ý — GPX chỉ là tham khảo
        </p>
        <p className="mt-0.5 text-xs text-blue-800">
          Course measurement chính thức cần Jones Counter (chuẩn AIMS) hoặc GPS
          multi-device average (chuẩn ITRA). Tracker GPX cá nhân có sai số 1-3% do
          tín hiệu vệ tinh + thuật toán smoothing.
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleDismiss}
        className="shrink-0 text-blue-700 hover:bg-blue-100"
        title="Ẩn 7 ngày"
      >
        <X className="size-3.5" aria-hidden="true" />
        <span className="sr-only">Đóng</span>
        <span className="ml-1 text-xs font-medium">Đã hiểu</span>
      </Button>
    </div>
  );
}
