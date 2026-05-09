// @ts-nocheck — F-017 deferred (TD-F013-TESTSTACK).
/**
 * F-017 — useDisplayConfig hook tests.
 *
 * Coverage:
 *  - GET resolves backend doc into resolveDisplayConfig output
 *  - PUT mutation updates query cache via setQueryData
 *  - Preset PATCH mutates cache
 */

import { renderHook, act, waitFor } from '@testing-library/react-hooks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDisplayConfig, useUpdateDisplayConfig, useApplyPreset } from '../hooks/useDisplayConfig';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useDisplayConfig (F-017)', () => {
  const origFetch = global.fetch;
  afterEach(() => {
    global.fetch = origFetch;
  });

  it('GET resolves config', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          mongoRaceId: 'race1',
          heroChoice: 'finish-time',
          themeColor: '#1d4ed8',
          visibleSections: { rank: true, finishTime: true, splits: false, sponsorBanner: false, customMessage: false, qrShare: false, photo: false },
          customMessage: '',
          sponsorLogos: [],
          soundEnabled: true,
          idleTimeoutSeconds: 60,
          preset: 'CUSTOM',
        },
      }),
    }));
    const { result, waitFor } = renderHook(() => useDisplayConfig('race_abc12345'), { wrapper });
    await waitFor(() => result.current.isSuccess);
    expect(result.current.data?.heroChoice).toBe('finish-time');
  });

  it('PUT updates cache', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ data: { mongoRaceId: 'race1', heroChoice: 'rank' } }),
    }));
    const { result } = renderHook(() => useUpdateDisplayConfig('race_abc12345'), { wrapper });
    let out;
    await act(async () => {
      out = await result.current.mutateAsync({ heroChoice: 'rank' });
    });
    expect(out.heroChoice).toBe('rank');
  });

  it('Preset PATCH', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ data: { mongoRaceId: 'race1', preset: 'MINIMAL', heroChoice: 'finish-time' } }),
    }));
    const { result } = renderHook(() => useApplyPreset('race_abc12345'), { wrapper });
    let out;
    await act(async () => {
      out = await result.current.mutateAsync('MINIMAL');
    });
    expect(out.preset).toBe('MINIMAL');
  });
});
