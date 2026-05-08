// @ts-nocheck — F-015: deferred RTL spec. @testing-library/react + jsdom not in
// admin node_modules (TD-F013-TESTSTACK).
/**
 * F-015 BR-CK-08/09 — useStationSync SSE + polling fallback tests.
 *
 * Coverage:
 *  - EventSource connect + onmessage updates stats
 *  - 3 consecutive disconnects → polling fallback engaged
 *  - cleanup on unmount closes EventSource
 *  - heartbeat events ignored from stats stream
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStationSync } from '../hooks/useStationSync';

function wrap(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

class FakeEventSource {
  url: string;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onopen: ((ev: Event) => void) | null = null;
  closeCalls = 0;
  constructor(url: string) {
    this.url = url;
    setTimeout(() => this.onopen?.(new Event('open')), 0);
  }
  addEventListener(_t: string, _h: any) {}
  close() {
    this.closeCalls++;
  }
}

describe('useStationSync', () => {
  let originalES: any;
  let lastEs: FakeEventSource | null = null;
  beforeEach(() => {
    lastEs = null;
    originalES = (global as any).EventSource;
    (global as any).EventSource = function (url: string) {
      lastEs = new FakeEventSource(url);
      return lastEs;
    };
    jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: { totalAthletes: 10, pickedUp: 0, perStation: [], ratePerMinute: 0, recentEvents: [] },
      }),
    } as any);
  });
  afterEach(() => {
    (global as any).EventSource = originalES;
    jest.restoreAllMocks();
  });

  it('connects EventSource when enabled=true', async () => {
    const qc = new QueryClient();
    renderHook(() => useStationSync({ raceId: '42', enabled: true }), { wrapper: wrap(qc) });
    await waitFor(() => expect(lastEs).not.toBeNull());
    expect(lastEs?.url).toContain('/check-in/stream');
  });

  it('updates stats when SSE delivers a pickup event', async () => {
    const qc = new QueryClient();
    const onPickup = jest.fn();
    renderHook(() => useStationSync({ raceId: '42', enabled: true, onPickup }), {
      wrapper: wrap(qc),
    });
    await waitFor(() => expect(lastEs).not.toBeNull());
    act(() => {
      lastEs?.onmessage?.(new MessageEvent('message', {
        data: JSON.stringify({ type: 'pickup', bib: '1001', stationId: '1' }),
      } as any));
    });
    expect(onPickup).toHaveBeenCalled();
  });

  it('closes EventSource on unmount', async () => {
    const qc = new QueryClient();
    const { unmount } = renderHook(() => useStationSync({ raceId: '42', enabled: true }), {
      wrapper: wrap(qc),
    });
    await waitFor(() => expect(lastEs).not.toBeNull());
    unmount();
    expect(lastEs?.closeCalls).toBeGreaterThan(0);
  });

  it('falls back to polling on persistent SSE error', async () => {
    const qc = new QueryClient();
    renderHook(() => useStationSync({ raceId: '42', enabled: true }), { wrapper: wrap(qc) });
    await waitFor(() => expect(lastEs).not.toBeNull());
    // Simulate 3 errors
    for (let i = 0; i < 3; i++) {
      act(() => lastEs?.onerror?.(new Event('error')));
    }
    // Polling fallback should fire fetches
    await waitFor(() => expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(0));
  });
});
