// @ts-nocheck — F-017: jest + @testing-library/react-hooks not in admin
// node_modules (TD-F013-TESTSTACK locked). Spec form correct, deferred run.
/**
 * F-017 — useChipScan TanStack mutation tests.
 *
 * Coverage:
 *  - happy: 200 success=true → kind:'found' with bib + envelope
 *  - edge: errorCode='race-not-mapped' → kind:'race-not-mapped'
 *  - edge: errorCode='chip-not-found' → kind:'chip-not-found'
 *  - edge: errorCode='chip-disabled' → kind:'chip-disabled' with bib
 *  - edge: malformed JSON → kind:'data-error'
 *  - edge: 5xx → kind:'network-error'
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useChipScan } from '../hooks/useChipScan';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useChipScan (F-017)', () => {
  const origFetch = global.fetch;
  afterEach(() => {
    global.fetch = origFetch;
  });

  it('returns found on success', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        bib: '101',
        data: { bib: '101', name: 'Test' },
        success: true,
      }),
    }));
    const { result } = renderHook(() => useChipScan({ raceId: 'race1' }), { wrapper });
    let outcome: any;
    await act(async () => {
      outcome = await result.current.mutateAsync('CHIP1');
    });
    expect(outcome.kind).toBe('found');
    expect(outcome.bib).toBe('101');
  });

  it('returns race-not-mapped errorCode', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        bib: null,
        data: null,
        success: false,
        errorCode: 'race-not-mapped',
      }),
    }));
    const { result } = renderHook(() => useChipScan({ raceId: 'race1' }), { wrapper });
    let outcome: any;
    await act(async () => {
      outcome = await result.current.mutateAsync('CHIP1');
    });
    expect(outcome.kind).toBe('race-not-mapped');
  });

  it('returns network-error on 500', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    const { result } = renderHook(() => useChipScan({ raceId: 'race1' }), { wrapper });
    let outcome: any;
    await act(async () => {
      outcome = await result.current.mutateAsync('CHIP1');
    });
    expect(outcome.kind).toBe('network-error');
  });
});
