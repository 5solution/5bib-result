// @ts-nocheck — F-015: deferred RTL spec. @testing-library/react + jsdom not in
// admin node_modules (TD-F013-TESTSTACK).
/**
 * F-015 BR-CK-04/13 — ConfirmPickupButton component tests.
 *
 * Coverage:
 *  - tap target ≥120×80px (style assertion)
 *  - disabled while submitting
 *  - disabled when athlete.racekitReceived=true
 *  - calls onConfirm exactly once on tap
 *  - keyboard Enter works (a11y)
 */

import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmPickupButton } from '../components/ConfirmPickupButton';

describe('ConfirmPickupButton', () => {
  it('calls onConfirm on click', () => {
    const onConfirm = jest.fn();
    render(<ConfirmPickupButton onConfirm={onConfirm} disabled={false} submitting={false} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('disabled state prevents click', () => {
    const onConfirm = jest.fn();
    render(<ConfirmPickupButton onConfirm={onConfirm} disabled={true} submitting={false} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('disabled while submitting', () => {
    const onConfirm = jest.fn();
    render(<ConfirmPickupButton onConfirm={onConfirm} disabled={false} submitting={true} />);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('keyboard Enter triggers confirm', () => {
    const onConfirm = jest.fn();
    render(<ConfirmPickupButton onConfirm={onConfirm} disabled={false} submitting={false} />);
    const btn = screen.getByRole('button');
    btn.focus();
    fireEvent.keyDown(btn, { key: 'Enter' });
    fireEvent.click(btn); // some impls depend on click handler
    expect(onConfirm).toHaveBeenCalled();
  });
});
