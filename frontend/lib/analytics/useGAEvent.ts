'use client';

/**
 * F-041 useGAEvent — Type-safe GA4 event emitter hook (BR-41-05, BR-41-18).
 *
 * Compile-time PII rejection: EventParams type union excludes PIIParamKey.
 * Runtime consent gate: emits only if user has accepted cookie consent.
 * Runtime sanitizer: strips any blacklisted key that bypasses TypeScript.
 *
 * Usage:
 *   const gaEvent = useGAEvent();
 *   gaEvent('view_athlete', { race_slug: slug, bib: '7055', from_route: 'ranking' });
 */

import { useCallback } from 'react';
import {
  type EventName,
  type EventParams,
  type EventParamValue,
  sanitizeEventParams,
} from './events';
import { emitGtagEvent, hasConsent } from './consent-manager';

type EmitFn = (event: EventName, params?: EventParams) => void;

export function useGAEvent(): EmitFn {
  return useCallback<EmitFn>((event, params) => {
    if (typeof window === 'undefined') return;
    if (!hasConsent()) return; // BR-41-03: no tracking pre-consent

    // Runtime PII sanitizer (defense-in-depth — TS rejects compile-time, this catches dynamic key)
    const sanitized = sanitizeEventParams(
      (params ?? {}) as Record<string, EventParamValue>,
    );

    emitGtagEvent(event, sanitized);
  }, []);
}

/**
 * Non-hook variant for use OUTSIDE React components (vd: click handler in
 * Next.js Server Action callback, library code). Same consent gate + sanitizer.
 */
export function gaEvent(event: EventName, params?: EventParams): void {
  if (typeof window === 'undefined') return;
  if (!hasConsent()) return;
  const sanitized = sanitizeEventParams(
    (params ?? {}) as Record<string, EventParamValue>,
  );
  emitGtagEvent(event, sanitized);
}
