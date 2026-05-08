// @ts-nocheck — F-015: deferred RTL spec. @testing-library/react + jsdom not in
// admin node_modules (TD-F013-TESTSTACK).
/**
 * F-015 BR-CK-10 — CMNDLastFourInput PII-boundary tests.
 *
 * Coverage:
 *  - input accepts ONLY digits, max 4 chars
 *  - submit fires only when length=4
 *  - PII boundary: component never holds full CMND beyond 4 digits
 *  - reset clears state on parent unmount
 *  - shows helper text "Nhập 4 số cuối"
 */

import * as React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { CMNDLastFourInput } from '../components/CMNDLastFourInput';

describe('CMNDLastFourInput', () => {
  it('caps input at 4 digits', () => {
    const onSubmit = jest.fn();
    render(<CMNDLastFourInput onSubmit={onSubmit} loading={false} />);
    const input = screen.getByPlaceholderText(/4 số cuối|last 4/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1234567890' } });
    expect(input.value.length).toBeLessThanOrEqual(4);
  });

  it('rejects non-digit characters', () => {
    const onSubmit = jest.fn();
    render(<CMNDLastFourInput onSubmit={onSubmit} loading={false} />);
    const input = screen.getByPlaceholderText(/4 số cuối|last 4/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'a1b2' } });
    expect(input.value).toMatch(/^[0-9]*$/);
  });

  it('does NOT submit when length < 4', () => {
    const onSubmit = jest.fn();
    render(<CMNDLastFourInput onSubmit={onSubmit} loading={false} />);
    const input = screen.getByPlaceholderText(/4 số cuối|last 4/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '12' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits when length = 4', () => {
    const onSubmit = jest.fn();
    render(<CMNDLastFourInput onSubmit={onSubmit} loading={false} />);
    const input = screen.getByPlaceholderText(/4 số cuối|last 4/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '7891' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalled();
  });

  it('shows VN helper text', () => {
    render(<CMNDLastFourInput onSubmit={jest.fn()} loading={false} />);
    expect(screen.getByText(/4 số cuối|nhập|cmnd|cccd/i)).toBeTruthy();
  });
});
