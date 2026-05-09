// @ts-nocheck — F-013: jest + @testing-library/react not in admin node_modules
// (Manager STOP trigger "NO npm install"). Spec is correct Jest+RTL form,
// will type-check + run once admin gains the test stack (Phase 2).
/**
 * F-013 BR-RK-06 — Idle countdown overlay tests.
 *
 * Coverage:
 *  - happy: secondsRemaining=8 renders overlay with "8s..."
 *  - edge: secondsRemaining=null does not render
 *  - edge: tap dismisses (calls onDismiss)
 *  - a11y: motion-reduce class present (verifies prefers-reduced-motion guard)
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { KioskIdleOverlay } from '../components/KioskIdleOverlay';

describe('KioskIdleOverlay (BR-RK-06)', () => {
  it('renders overlay with countdown when secondsRemaining provided', () => {
    render(<KioskIdleOverlay secondsRemaining={8} onDismiss={jest.fn()} />);
    expect(screen.getByTestId('kiosk-idle-overlay')).toBeTruthy();
    expect(screen.getByTestId('kiosk-idle-countdown').textContent).toContain('8');
  });

  it('returns null when secondsRemaining is null', () => {
    const { container } = render(
      <KioskIdleOverlay secondsRemaining={null} onDismiss={jest.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('countdown decrements visibly when re-rendered', () => {
    const { rerender } = render(
      <KioskIdleOverlay secondsRemaining={10} onDismiss={jest.fn()} />,
    );
    expect(screen.getByTestId('kiosk-idle-countdown').textContent).toContain('10');
    rerender(<KioskIdleOverlay secondsRemaining={5} onDismiss={jest.fn()} />);
    expect(screen.getByTestId('kiosk-idle-countdown').textContent).toContain('5');
    rerender(<KioskIdleOverlay secondsRemaining={1} onDismiss={jest.fn()} />);
    expect(screen.getByTestId('kiosk-idle-countdown').textContent).toContain('1');
  });

  it('tap fires onDismiss', () => {
    const onDismiss = jest.fn();
    render(<KioskIdleOverlay secondsRemaining={3} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTestId('kiosk-idle-overlay'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('motion-reduce class present for prefers-reduced-motion guard', () => {
    render(<KioskIdleOverlay secondsRemaining={5} onDismiss={jest.fn()} />);
    const overlay = screen.getByTestId('kiosk-idle-overlay');
    expect(overlay.className).toContain('motion-reduce:transition-none');
  });
});
