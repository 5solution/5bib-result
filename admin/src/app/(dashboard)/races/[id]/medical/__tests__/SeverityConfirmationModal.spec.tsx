// @ts-nocheck — F-018 deferred RTL spec (TD-F013-TESTSTACK).
/**
 * F-018 SeverityConfirmationModal — BR-MI-04 mandatory confirmation Sev 4 & 5.
 *
 * Coverage when test stack lands:
 *  - Sev 1-3 → modal does not render
 *  - Sev 4 → modal renders with "NẶNG" copy
 *  - Sev 5 → modal renders with "NGUY KỊCH" copy
 *  - cancel button → onCancel callback
 *  - confirm button → onConfirm callback
 *  - click outside → does NOT close (BR-MI-04 NOT bypassable)
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { SeverityConfirmationModal } from '../components/SeverityConfirmationModal';

describe('SeverityConfirmationModal', () => {
  it('does not render for Sev 3', () => {
    render(
      <SeverityConfirmationModal
        open
        severity={3}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders NẶNG copy for Sev 4', () => {
    render(
      <SeverityConfirmationModal
        open
        severity={4}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByText(/NẶNG/)).toBeInTheDocument();
  });

  it('renders NGUY KỊCH copy for Sev 5', () => {
    render(
      <SeverityConfirmationModal
        open
        severity={5}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByText(/NGUY KỊCH/)).toBeInTheDocument();
  });

  it('confirm button fires callback', () => {
    const onConfirm = jest.fn();
    render(
      <SeverityConfirmationModal
        open
        severity={4}
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận/i }));
    expect(onConfirm).toHaveBeenCalled();
  });
});
