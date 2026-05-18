/**
 * F-041 Consent Manager — Vietnam PDPA Decree 13/2023/NĐ-CP compliance (BR-41-03, BR-41-08..11).
 *
 * Default state: `analytics_storage: denied` (set by GoogleAnalytics component before any event).
 * User accept → update all 4 consent slots → granted.
 * User reject → stay denied.
 * Persistence: localStorage `5bib_consent_v1` JSON `{accepted, timestamp, version: 1}` TTL 365 days.
 *
 * SSR safe: all browser-only operations check `typeof window` first.
 */

export const CONSENT_KEY = '5bib_consent_v1';
export const CONSENT_VERSION = 1;
export const CONSENT_TTL_DAYS = 365;
export const CONSENT_TTL_MS = CONSENT_TTL_DAYS * 24 * 60 * 60 * 1000;

export interface ConsentRecord {
  accepted: boolean;
  timestamp: string; // ISO 8601
  version: number;
}

type GtagFn = (...args: unknown[]) => void;

interface WindowWithGtag extends Window {
  gtag?: GtagFn;
  dataLayer?: unknown[];
}

function getWindow(): WindowWithGtag | null {
  if (typeof window === 'undefined') return null;
  return window as WindowWithGtag;
}

// ────────────────────────────────────────────────────────────────────────────
// localStorage helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Load consent record from localStorage.
 * Returns null if missing / expired / version mismatch / parse error.
 */
export function loadConsent(): ConsentRecord | null {
  const win = getWindow();
  if (!win) return null;
  try {
    const raw = win.localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentRecord>;
    if (typeof parsed.accepted !== 'boolean') return null;
    if (typeof parsed.timestamp !== 'string') return null;
    if (parsed.version !== CONSENT_VERSION) return null; // version bump → re-prompt
    const ageMs = Date.now() - new Date(parsed.timestamp).getTime();
    if (Number.isNaN(ageMs)) return null;
    if (ageMs > CONSENT_TTL_MS) return null; // expired
    return parsed as ConsentRecord;
  } catch {
    return null;
  }
}

/**
 * Persist consent choice to localStorage.
 * Returns true on success, false if quota exceeded / private mode.
 */
export function saveConsent(accepted: boolean): boolean {
  const win = getWindow();
  if (!win) return false;
  try {
    const record: ConsentRecord = {
      accepted,
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
    };
    win.localStorage.setItem(CONSENT_KEY, JSON.stringify(record));
    return true;
  } catch {
    return false; // quota exceeded / disabled (private mode)
  }
}

/**
 * Clear consent — used for opt-out flow (Phase 2 revoke button).
 */
export function clearConsent(): void {
  const win = getWindow();
  if (!win) return;
  try {
    win.localStorage.removeItem(CONSENT_KEY);
  } catch {
    // ignore
  }
}

// ────────────────────────────────────────────────────────────────────────────
// gtag consent update — bridge between user choice and GA4 SDK
// ────────────────────────────────────────────────────────────────────────────

/**
 * Whether user has actively accepted tracking. False = denied OR not asked yet.
 * useGAEvent uses this to gate emit (BR-41-03 — no tracking pre-consent).
 */
export function hasConsent(): boolean {
  const record = loadConsent();
  return record?.accepted === true;
}

/**
 * Update gtag Consent Mode v2 slots based on user accept/reject choice.
 * Called by CookieConsentBanner after click "Đồng ý" or "Từ chối".
 */
export function updateGtagConsent(accepted: boolean): void {
  const win = getWindow();
  if (!win?.gtag) return;
  const value = accepted ? 'granted' : 'denied';
  win.gtag('consent', 'update', {
    analytics_storage: value,
    ad_storage: value,
    ad_user_data: value,
    ad_personalization: value,
  });
}

/**
 * Emit raw gtag event — used internally by useGAEvent hook.
 * Caller responsible for sanitization + consent check.
 */
export function emitGtagEvent(eventName: string, params: Record<string, unknown>): void {
  const win = getWindow();
  if (!win?.gtag) return;
  win.gtag('event', eventName, params);
}
