/**
 * Client-side watchlist storage (F-11 BR-01/09).
 *
 * Strategy:
 *  - Signed-out → localStorage (cap 20 per race, 100 total).
 *  - Signed-in  → backend MongoDB (Clerk-gated) is source of truth;
 *                 localStorage kept as offline cache/mirror so the UI is
 *                 never empty when fetch is slow.
 *
 * Safari private mode disables localStorage — fall back to in-memory Map.
 * Corrupt JSON is reset to [] silently.
 */

export interface WatchlistItem {
  raceId: string;
  courseId: string;
  bib: string;
  name?: string;
  raceName?: string;
  raceSlug?: string;
  courseName?: string;
  athleteGender?: string;
  athleteCategory?: string;
  addedAt: number;
}

export const WATCHLIST_KEY = '5bib-watchlist';
export const MAX_PER_RACE = 20;
export const MAX_TOTAL = 100;

type StorageLike = {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
};

const memoryStore = new Map<string, string>();
const memoryFallback: StorageLike = {
  getItem: (k) => memoryStore.get(k) ?? null,
  setItem: (k, v) => void memoryStore.set(k, v),
  removeItem: (k) => void memoryStore.delete(k),
};

/** Returns localStorage if usable, otherwise an in-memory shim. */
export function safeStorage(): StorageLike {
  if (typeof window === 'undefined') return memoryFallback;
  try {
    const test = '__5bib_test__';
    window.localStorage.setItem(test, '1');
    window.localStorage.removeItem(test);
    return window.localStorage;
  } catch {
    return memoryFallback;
  }
}

export function isUsingLocalStorage(): boolean {
  return safeStorage() !== memoryFallback;
}

function isValidItem(x: unknown): x is WatchlistItem {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.raceId === 'string' &&
    typeof o.courseId === 'string' &&
    typeof o.bib === 'string' &&
    typeof o.addedAt === 'number'
  );
}

export function readWatchlist(): WatchlistItem[] {
  try {
    const raw = safeStorage().getItem(WATCHLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('not an array');
    return parsed.filter(isValidItem);
  } catch (err) {
    // Corrupt JSON → reset silently
    if (typeof console !== 'undefined') {
      console.error('watchlist storage corrupted, resetting', err);
    }
    try {
      safeStorage().removeItem(WATCHLIST_KEY);
    } catch {
      /* ignore */
    }
    return [];
  }
}

export function writeWatchlist(items: WatchlistItem[]): void {
  try {
    safeStorage().setItem(WATCHLIST_KEY, JSON.stringify(items));
  } catch {
    /* ignore — quota exceeded / private mode */
  }
}

export type AddResult =
  | { ok: true; items: WatchlistItem[] }
  | { ok: false; reason: 'race-limit' | 'total-limit' };

export function addToWatchlist(item: WatchlistItem): AddResult {
  const items = readWatchlist();
  const already = items.find(
    (i) => i.raceId === item.raceId && i.bib === item.bib,
  );
  if (already) return { ok: true, items };

  const inRace = items.filter((i) => i.raceId === item.raceId).length;
  if (inRace >= MAX_PER_RACE) return { ok: false, reason: 'race-limit' };
  if (items.length >= MAX_TOTAL) return { ok: false, reason: 'total-limit' };

  const next = [item, ...items];
  writeWatchlist(next);
  return { ok: true, items: next };
}

export function removeFromWatchlist(
  raceId: string,
  bib: string,
): WatchlistItem[] {
  const next = readWatchlist().filter(
    (i) => !(i.raceId === raceId && i.bib === bib),
  );
  writeWatchlist(next);
  return next;
}

export function isInWatchlist(raceId: string, bib: string): boolean {
  return readWatchlist().some((i) => i.raceId === raceId && i.bib === bib);
}

export function filterByRace(raceId: string): WatchlistItem[] {
  return readWatchlist().filter((i) => i.raceId === raceId);
}

export function filterByCourse(
  raceId: string,
  courseId: string,
): WatchlistItem[] {
  return readWatchlist().filter(
    (i) => i.raceId === raceId && i.courseId === courseId,
  );
}

export function clearWatchlist(): void {
  writeWatchlist([]);
}
