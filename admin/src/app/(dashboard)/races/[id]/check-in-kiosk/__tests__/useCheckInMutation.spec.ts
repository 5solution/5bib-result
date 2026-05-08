// @ts-nocheck — F-015: deferred RTL spec. @testing-library/react + jsdom not in
// admin node_modules (TD-F013-TESTSTACK).
/**
 * F-015 BR-CK-04/05 — atomic check-in mutation tests.
 *
 * Coverage:
 *  - success → kind:'success' + invalidates ['checkin-stats', raceId]
 *  - 409 conflict → kind:'conflict' (UI shows BR-CK-05 cooldown)
 *  - non-2xx network → kind:'network-error'
 *  - bad envelope shape → kind:'network-error' (BR-CK-18 runtime guard)
 */

import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCheckInMutation } from '../hooks/useCheckInMutation';

function wrap(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('useCheckInMutation', () => {
  let fetchSpy: jest.SpyInstance;
  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch' as any);
  });
  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('success on 200 + invalidates checkin-stats query', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          bib: '1001',
          athleteId: 555,
          checkedInAt: '2026-05-08T05:00:00Z',
          stationId: '1',
          source: 'bib',
        },
      }),
    } as any);
    const qc = new QueryClient();
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(
      () => useCheckInMutation({ raceId: '42', stationId: '1' }),
      { wrapper: wrap(qc) },
    );
    let outcome: any;
    await act(async () => {
      outcome = await result.current.mutateAsync({
        bib: '1001',
        athleteId: 555,
        source: 'bib',
      });
    });
    expect(outcome.kind).toBe('success');
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['checkin-stats', '42'],
    });
  });

  it('returns conflict on 409', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ success: false, message: 'already_checked_in' }),
    } as any);
    const qc = new QueryClient();
    const { result } = renderHook(
      () => useCheckInMutation({ raceId: '42', stationId: '1' }),
      { wrapper: wrap(qc) },
    );
    let outcome: any;
    await act(async () => {
      outcome = await result.current.mutateAsync({
        bib: '1001',
        athleteId: 555,
        source: 'bib',
      });
    });
    expect(outcome.kind).toBe('conflict');
  });

  it('returns network-error on 500', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) } as any);
    const qc = new QueryClient();
    const { result } = renderHook(
      () => useCheckInMutation({ raceId: '42', stationId: '1' }),
      { wrapper: wrap(qc) },
    );
    let outcome: any;
    await act(async () => {
      outcome = await result.current.mutateAsync({
        bib: '1001',
        athleteId: 555,
        source: 'bib',
      });
    });
    expect(outcome.kind).toBe('network-error');
  });

  it('returns network-error when envelope fails BR-CK-18 guard', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { bib: { wrong: 'type' } } }), // no success bool
    } as any);
    const qc = new QueryClient();
    const { result } = renderHook(
      () => useCheckInMutation({ raceId: '42', stationId: '1' }),
      { wrapper: wrap(qc) },
    );
    let outcome: any;
    await act(async () => {
      outcome = await result.current.mutateAsync({
        bib: '1001',
        athleteId: 555,
        source: 'bib',
      });
    });
    expect(outcome.kind).toBe('network-error');
  });
});
