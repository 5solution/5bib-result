// @ts-nocheck — F-018 deferred RTL spec (TD-F013-TESTSTACK).
/**
 * F-018 useIncidentSse — Race Director realtime alerts.
 *
 * Coverage when test stack lands:
 *  - opens EventSource with cookie credentials
 *  - state = 'connected' on `onopen`
 *  - state = 'disconnected' on `onerror`
 *  - Sev 4-5 incident.created → fires `onCriticalAlert`
 *  - Sev 1-3 incident.created → debounce invalidate but no audible callback
 *  - heartbeat keeps state=connected
 *  - reconnect when EventSource closes
 */

import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useIncidentSse } from '../hooks/useIncidentSse';

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  withCredentials: boolean;
  onopen: () => void = () => {};
  onerror: () => void = () => {};
  listeners: Record<string, ((evt: MessageEvent) => void)[]> = {};
  constructor(url: string, opts: { withCredentials: boolean }) {
    this.url = url;
    this.withCredentials = opts.withCredentials;
    MockEventSource.instances.push(this);
  }
  addEventListener(type: string, fn: (evt: MessageEvent) => void) {
    (this.listeners[type] ??= []).push(fn);
  }
  close() {}
}

beforeAll(() => {
  // @ts-expect-error mock
  global.EventSource = MockEventSource;
});

function wrap() {
  const qc = new QueryClient();
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('useIncidentSse', () => {
  it('Sev 5 incident.created invokes onCriticalAlert callback', () => {
    const onCritical = jest.fn();
    renderHook(
      () => useIncidentSse({ raceId: 'r1', onCriticalAlert: onCritical }),
      { wrapper: wrap() },
    );
    const es = MockEventSource.instances.at(-1)!;
    const handlers = es.listeners['incident.created'] ?? [];
    handlers.forEach((h) =>
      h({ data: JSON.stringify({ severity: 5, id: 'i1', bib: '1001' }) } as MessageEvent),
    );
    expect(onCritical).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 5, bib: '1001' }),
    );
  });
});
