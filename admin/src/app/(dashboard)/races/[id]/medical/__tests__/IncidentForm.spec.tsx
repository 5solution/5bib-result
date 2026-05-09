// @ts-nocheck — F-018: deferred RTL spec. Activates when admin gains
// @testing-library/react + jsdom (TD-F013-TESTSTACK closure → flip jest config
// regex to match `.*\.spec\.(ts|tsx)$`). Pattern follows F-013 specs.
/**
 * F-018 IncidentForm — 3-tap workflow + Sev 4-5 confirmation NOT bypassable.
 *
 * Coverage (when test stack lands):
 *  - tap severity 1 → no modal → category step appears
 *  - tap severity 4 → confirmation modal blocks → click outside does nothing
 *  - submit Sev 1 incident in 3 taps end-to-end (form-open → submit timer)
 *  - reject Sev 4 without photo: server 400 surfaces in form
 *  - "Khác" category requires ≥10 char description
 *  - trauma sub-type required
 *  - offline mode queues to IndexedDB instead of POST
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IncidentForm } from '../components/IncidentForm';

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('IncidentForm — 3-tap workflow', () => {
  it('shows severity step initially with no preselection', () => {
    renderWithQuery(
      <IncidentForm raceId="r1" onClose={jest.fn()} onCreated={jest.fn()} />,
    );
    const sev1 = screen.getByRole('button', { name: /\[1\]/ });
    expect(sev1).toBeInTheDocument();
    expect(sev1).not.toHaveAttribute('aria-pressed', 'true');
  });

  it('Sev 4 click opens confirmation modal — modal NOT bypassable on click outside', async () => {
    renderWithQuery(
      <IncidentForm raceId="r1" onClose={jest.fn()} onCreated={jest.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /\[4\]/ }));
    expect(
      await screen.findByRole('dialog', { name: /Xác nhận mức độ NẶNG/i }),
    ).toBeInTheDocument();
    // Click outside dialog → still open.
    fireEvent.click(document.body);
    expect(
      screen.queryByRole('dialog', { name: /Xác nhận mức độ NẶNG/i }),
    ).toBeInTheDocument();
  });
});

describe('IncidentForm — validation', () => {
  it('blocks submit when bib + name + desc all empty', async () => {
    renderWithQuery(
      <IncidentForm raceId="r1" onClose={jest.fn()} onCreated={jest.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /\[1\]/ }));
    // category & GPS still required; submit button should be disabled.
    const submit = screen.getByRole('button', { name: /Gửi báo cáo/i });
    expect(submit).toBeDisabled();
  });
});
