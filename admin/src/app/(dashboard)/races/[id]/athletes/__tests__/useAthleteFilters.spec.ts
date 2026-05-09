// @ts-nocheck — F-014 deferred spec (TD-F013-TESTSTACK locked).
/**
 * F-014 BR-AS-10/11 — URL-synced filter state.
 *
 * Coverage:
 *   - read filter state from URL (q / status / course / view / page)
 *   - setFilter writes URL via router.replace + resets page
 *   - reset() clears all params
 *   - parseStatuses tolerates unknown values (drops them)
 *   - parseView falls back to 'default' on unknown
 */

import { renderHook, act } from '@testing-library/react';
import { useAthleteFilters } from '../hooks/useAthleteFilters';

const mockReplace = jest.fn();
let mockSearch = '';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => ({
    get: (key: string) => new URLSearchParams(mockSearch).get(key),
    toString: () => mockSearch,
  }),
}));

describe('useAthleteFilters (BR-AS-10/11 URL sync)', () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockSearch = '';
  });

  it('returns DEFAULT_FILTERS when URL is empty', () => {
    const { result } = renderHook(() => useAthleteFilters());
    expect(result.current.filters.q).toBe('');
    expect(result.current.filters.statuses).toEqual([]);
    expect(result.current.view).toBe('default');
    expect(result.current.page).toBe(1);
  });

  it('parses status enum from comma-separated URL', () => {
    mockSearch = 'status=LIVE,DNF,UNKNOWN';
    const { result } = renderHook(() => useAthleteFilters());
    // UNKNOWN dropped, valid enums preserved
    expect(result.current.filters.statuses).toEqual(['LIVE', 'DNF']);
  });

  it('parses view falling back to "default" on unknown', () => {
    mockSearch = 'view=garbage';
    const { result } = renderHook(() => useAthleteFilters());
    expect(result.current.view).toBe('default');
  });

  it('parses page as positive integer, fallback 1', () => {
    mockSearch = 'page=3';
    const { result: r1 } = renderHook(() => useAthleteFilters());
    expect(r1.current.page).toBe(3);
    mockSearch = 'page=-9';
    const { result: r2 } = renderHook(() => useAthleteFilters());
    expect(r2.current.page).toBe(1);
  });

  it('setFilter("q", value) writes URL via replace + clears page', () => {
    mockSearch = 'page=5';
    const { result } = renderHook(() => useAthleteFilters());
    act(() => result.current.setFilter('q', 'Nguyen'));
    expect(mockReplace).toHaveBeenCalledTimes(1);
    const callArg = mockReplace.mock.calls[0][0] as string;
    expect(callArg).toContain('q=Nguyen');
    expect(callArg).not.toContain('page=');
  });

  it('setFilter clearing q removes the param', () => {
    mockSearch = 'q=foo';
    const { result } = renderHook(() => useAthleteFilters());
    act(() => result.current.setFilter('q', ''));
    const arg = mockReplace.mock.calls[0][0] as string;
    expect(arg).not.toContain('q=');
  });

  it('reset() clears all filter params', () => {
    mockSearch = 'q=x&status=LIVE&course=10K&view=incidents&page=4';
    const { result } = renderHook(() => useAthleteFilters());
    act(() => result.current.reset());
    const arg = mockReplace.mock.calls[0][0] as string;
    expect(arg).toBe('?');
  });
});
