'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'chip-verify-name-mode';

export type NameMode = 'bib' | 'full';

/**
 * Toggle hiển thị tên VĐV trên kiosk Bàn 2.
 *
 * Mode 'bib' (default): hiện `bib_name` (tên trên áo BIB — fun, khớp áo VĐV).
 * Mode 'full': hiện `full_name` (họ tên đầy đủ — verify CCCD).
 *
 * BR-04: persist trong sessionStorage (per-tab session).
 *   - F5 same tab → giữ mode đã chọn (sessionStorage không clear khi reload).
 *   - Đóng tab + mở lại → reset về 'bib' (sessionStorage cleared).
 *   - Tab mới (cùng browser) → KHÔNG inherit (sessionStorage per-tab).
 *
 * BR-05: default mode = 'bib' khi sessionStorage chưa có value.
 *
 * Init pattern: state init = 'bib' (deterministic SSR), populate từ
 * sessionStorage trong useEffect post-mount để tránh hydration mismatch.
 */
export function useNameDisplayMode() {
  const [mode, setMode] = useState<NameMode>('bib');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved === 'full' || saved === 'bib') setMode(saved);
  }, []);

  const setAndPersist = useCallback((next: NameMode) => {
    setMode(next);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(STORAGE_KEY, next);
    }
  }, []);

  return { mode, setMode: setAndPersist };
}

interface NameSource {
  bib_name: string | null;
  full_name: string | null;
  /** Legacy alias from old cache — fallback cuối khi 2 field mới null. */
  name: string | null;
}

/**
 * Resolve tên hiển thị theo mode + fallback chain.
 *
 * BR-01 (Mode 'bib'): bib_name → full_name → legacy name → '—'
 * BR-02 (Mode 'full'): full_name → bib_name → legacy name → '—'
 *
 * Trim whitespace; empty string sau trim coi như null.
 * KHÔNG bao giờ return empty string — luôn '—' để UI giữ layout.
 */
export function resolveDisplayName(athlete: NameSource, mode: NameMode): string {
  const bib = athlete.bib_name?.trim() || null;
  const full = athlete.full_name?.trim() || null;
  const legacy = athlete.name?.trim() || null;

  if (mode === 'full') {
    return full ?? bib ?? legacy ?? '—';
  }
  return bib ?? full ?? legacy ?? '—';
}
