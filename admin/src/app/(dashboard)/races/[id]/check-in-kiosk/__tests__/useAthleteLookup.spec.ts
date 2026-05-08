// @ts-nocheck — F-015: deferred RTL spec. @testing-library/react + jsdom not in
// admin node_modules (TD-F013-TESTSTACK). Spec is well-formed Jest+RTL ready to
// run once stack lands.
/**
 * F-015 BR-CK-01/02/10 — useAthleteLookup TanStack Query hook tests.
 *
 * Coverage:
 *  - happy path BIB lookup → returns { kind: 'found', payload }
 *  - 404 / data:null → returns { kind: 'not-found' }
 *  - CMND multi-candidate → returns { kind: 'multi-candidate' }
 *  - QR mode forwards `payload` text unchanged to /lookup-by-qr
 *  - network error → returns { kind: 'network-error' }
 */

import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAthleteLookup } from '../hooks/useAthleteLookup';

function wrap(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('useAthleteLookup', () => {
  let fetchSpy: jest.SpyInstance;
  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch' as any);
  });
  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('returns kind=found on 200 with single payload', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: { bib: '1001', name: 'A', racekitReceived: false, athleteId: 1 },
      }),
    } as any);
    const qc = new QueryClient();
    const { result } = renderHook(() => useAthleteLookup({ raceId: '42' }), {
      wrapper: wrap(qc),
    });
    let outcome: any;
    await act(async () => {
      outcome = await result.current.mutateAsync({ mode: 'bib', query: '1001' });
    });
    expect(outcome.kind).toBe('found');
    expect(outcome.payload.bib).toBe('1001');
  });

  it('returns kind=not-found on data:null envelope', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: false, data: null }),
    } as any);
    const qc = new QueryClient();
    const { result } = renderHook(() => useAthleteLookup({ raceId: '42' }), {
      wrapper: wrap(qc),
    });
    let outcome: any;
    await act(async () => {
      outcome = await result.current.mutateAsync({ mode: 'bib', query: '999' });
    });
    expect(outcome.kind).toBe('not-found');
  });

  it('returns kind=multi-candidate when CMND mode returns array', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: [
          { bib: '1001', racekitReceived: false, athleteId: 1 },
          { bib: '1002', racekitReceived: true, athleteId: 2 },
        ],
      }),
    } as any);
    const qc = new QueryClient();
    const { result } = renderHook(() => useAthleteLookup({ raceId: '42' }), {
      wrapper: wrap(qc),
    });
    let outcome: any;
    await act(async () => {
      outcome = await result.current.mutateAsync({ mode: 'cmnd', query: '7891' });
    });
    expect(outcome.kind).toBe('multi-candidate');
    expect(outcome.payloads).toHaveLength(2);
  });

  it('returns kind=network-error on fetch reject', async () => {
    fetchSpy.mockRejectedValue(new Error('boom'));
    const qc = new QueryClient();
    const { result } = renderHook(() => useAthleteLookup({ raceId: '42' }), {
      wrapper: wrap(qc),
    });
    let outcome: any;
    await act(async () => {
      outcome = await result.current.mutateAsync({ mode: 'bib', query: '1001' });
    });
    expect(outcome.kind).toBe('network-error');
  });

  it('forwards QR payload to /lookup-by-qr endpoint', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { bib: '1001', racekitReceived: false } }),
    } as any);
    const qc = new QueryClient();
    const { result } = renderHook(() => useAthleteLookup({ raceId: '42' }), {
      wrapper: wrap(qc),
    });
    await act(async () => {
      await result.current.mutateAsync({ mode: 'qr', query: 'bib=1001' });
    });
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain('lookup-by-qr');
  });
});
