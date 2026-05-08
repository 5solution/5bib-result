'use client';

/**
 * F-014 BR-AS-09/52 — debounced search input.
 *
 * Wraps a controlled string with a 300ms debounce (configurable). The
 * downstream hook (useAthletesList) consumes only `debouncedQuery`. Visual
 * input mirrors `query` immediately for responsive feel.
 *
 * Cancels the trailing timer on unmount + on rapid key cascades.
 */

import { useEffect, useRef, useState } from 'react';
import { SEARCH_DEBOUNCE_MS } from '../athletes.constant';

export interface UseAthletesSearchResult {
  /** Live input value (sync). */
  query: string;
  /** Set the live input — caller binds to <Input onChange>. */
  setQuery: (next: string) => void;
  /** Debounced value — pass to query key / API. */
  debouncedQuery: string;
  /** Manually flush debounce (e.g., on Enter). */
  flush: () => void;
}

export function useAthletesSearch(
  initial = '',
  delay = SEARCH_DEBOUNCE_MS,
): UseAthletesSearchResult {
  const [query, setQuery] = useState(initial);
  const [debouncedQuery, setDebouncedQuery] = useState(initial);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, delay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, delay]);

  const flush = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setDebouncedQuery(query);
  };

  return { query, setQuery, debouncedQuery, flush };
}
