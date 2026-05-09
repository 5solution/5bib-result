'use client';

/**
 * F-014 BR-AS-10/11 — URL-synced filter state.
 *
 * State is the URL query string — all filter state encoded in
 * `useSearchParams` so that bookmark / share / back-button works.
 *
 * URL params:
 *   q=<text>              search query
 *   status=LIVE,DNF       comma-separated AthleteStatus values
 *   course=10K,21K        comma-separated courseIds
 *   gender=M|F|all
 *   ag=<group>|all
 *   paid=yes|no|all
 *   view=default|live-now|finishers|incidents
 *   page=<n>              1-based pagination
 *
 * `router.replace` keeps history clean (filter changes don't pollute back-stack).
 */

import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ATHLETE_STATUSES,
  ATHLETE_VIEWS,
  type AthleteStatus,
  type AthleteView,
} from '../athletes.constant';
import {
  DEFAULT_FILTERS,
  type AthleteFilters,
} from '../athletes.types';

function parseStatuses(raw: string | null): AthleteStatus[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s): s is AthleteStatus =>
      (ATHLETE_STATUSES as readonly string[]).includes(s),
    );
}

function parseList(raw: string | null): string[] {
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function parseGender(raw: string | null): AthleteFilters['gender'] {
  if (raw === 'M' || raw === 'F') return raw;
  return 'all';
}

function parsePaid(raw: string | null): AthleteFilters['paid'] {
  if (raw === 'yes' || raw === 'no') return raw;
  return 'all';
}

function parseView(raw: string | null): AthleteView {
  if (!raw) return 'default';
  return (ATHLETE_VIEWS as readonly string[]).includes(raw)
    ? (raw as AthleteView)
    : 'default';
}

function parsePage(raw: string | null): number {
  const n = parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export interface UseAthleteFiltersResult {
  filters: AthleteFilters;
  view: AthleteView;
  page: number;
  setFilter: <K extends keyof AthleteFilters>(
    key: K,
    value: AthleteFilters[K],
  ) => void;
  setView: (next: AthleteView) => void;
  setPage: (next: number) => void;
  reset: () => void;
}

export function useAthleteFilters(): UseAthleteFiltersResult {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filters = useMemo<AthleteFilters>(
    () => ({
      q: searchParams.get('q') ?? '',
      statuses: parseStatuses(searchParams.get('status')),
      courseIds: parseList(searchParams.get('course')),
      gender: parseGender(searchParams.get('gender')),
      ageGroup: searchParams.get('ag') ?? 'all',
      paid: parsePaid(searchParams.get('paid')),
    }),
    [searchParams],
  );

  const view = useMemo(() => parseView(searchParams.get('view')), [searchParams]);
  const page = useMemo(() => parsePage(searchParams.get('page')), [searchParams]);

  const writeParams = useCallback(
    (mutator: (sp: URLSearchParams) => void) => {
      const sp = new URLSearchParams(searchParams.toString());
      mutator(sp);
      const qs = sp.toString();
      router.replace(qs ? `?${qs}` : '?', { scroll: false });
    },
    [router, searchParams],
  );

  const setFilter = useCallback<UseAthleteFiltersResult['setFilter']>(
    (key, value) => {
      writeParams((sp) => {
        // Filter changes reset pagination to 1
        sp.delete('page');
        if (key === 'q') {
          if (typeof value === 'string' && value.length > 0) sp.set('q', value);
          else sp.delete('q');
        } else if (key === 'statuses') {
          const arr = value as AthleteStatus[];
          if (arr.length > 0) sp.set('status', arr.join(','));
          else sp.delete('status');
        } else if (key === 'courseIds') {
          const arr = value as string[];
          if (arr.length > 0) sp.set('course', arr.join(','));
          else sp.delete('course');
        } else if (key === 'gender') {
          if (value === 'all') sp.delete('gender');
          else sp.set('gender', String(value));
        } else if (key === 'ageGroup') {
          if (value === 'all' || !value) sp.delete('ag');
          else sp.set('ag', String(value));
        } else if (key === 'paid') {
          if (value === 'all') sp.delete('paid');
          else sp.set('paid', String(value));
        }
      });
    },
    [writeParams],
  );

  const setView = useCallback(
    (next: AthleteView) => {
      writeParams((sp) => {
        sp.delete('page');
        if (next === 'default') sp.delete('view');
        else sp.set('view', next);
      });
    },
    [writeParams],
  );

  const setPage = useCallback(
    (next: number) => {
      writeParams((sp) => {
        if (next <= 1) sp.delete('page');
        else sp.set('page', String(next));
      });
    },
    [writeParams],
  );

  const reset = useCallback(() => {
    writeParams((sp) => {
      sp.delete('q');
      sp.delete('status');
      sp.delete('course');
      sp.delete('gender');
      sp.delete('ag');
      sp.delete('paid');
      sp.delete('view');
      sp.delete('page');
    });
  }, [writeParams]);

  // Keep DEFAULT_FILTERS reference for tests / shallow-equal checks.
  void DEFAULT_FILTERS;

  return { filters, view, page, setFilter, setView, setPage, reset };
}
