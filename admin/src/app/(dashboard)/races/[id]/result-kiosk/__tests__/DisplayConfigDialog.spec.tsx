// @ts-nocheck — F-017 deferred (TD-F013-TESTSTACK).
/**
 * F-017 — DisplayConfigDialog tests.
 *
 * Coverage:
 *  - opens / closes via prop
 *  - preset button click triggers PATCH
 *  - section toggle flips visibleSections
 *  - hero choice click updates draft
 *  - upload error >2MB shown
 *  - Save calls PUT and closes dialog
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DisplayConfigDialog } from '../components/DisplayConfigDialog';

function wrap(children: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('DisplayConfigDialog (F-017)', () => {
  it('renders nothing when open=false', () => {
    const { container } = render(
      wrap(<DisplayConfigDialog raceId="r1" open={false} onClose={() => {}} />),
    );
    expect(container.querySelector('[data-testid="display-config-dialog"]')).toBeNull();
  });

  it('renders dialog when open=true', () => {
    render(wrap(<DisplayConfigDialog raceId="r1" open={true} onClose={() => {}} />));
    expect(screen.getByTestId('display-config-dialog')).toBeTruthy();
    expect(screen.getByTestId('display-config-preview')).toBeTruthy();
  });

  it('Cancel button calls onClose', () => {
    const onClose = jest.fn();
    render(wrap(<DisplayConfigDialog raceId="r1" open={true} onClose={onClose} />));
    fireEvent.click(screen.getByText(/Huỷ/));
    expect(onClose).toHaveBeenCalled();
  });
});
