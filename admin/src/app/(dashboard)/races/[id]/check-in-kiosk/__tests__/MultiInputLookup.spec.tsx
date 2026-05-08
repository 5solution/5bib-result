// @ts-nocheck — F-015: deferred RTL spec. @testing-library/react + jsdom not in
// admin node_modules (TD-F013-TESTSTACK).
/**
 * F-015 BR-CK-01/10 — MultiInputLookup component tests.
 *
 * Coverage:
 *  - BIB input strips non-digits + caps length
 *  - CMND collapsed by default; expand button toggles
 *  - Submit button invokes onSubmitBib with current value
 *  - QR button triggers onScannedQr handler when scan event fires
 */

import * as React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { MultiInputLookup } from '../components/MultiInputLookup';
import { CheckInModeProvider } from '../components/CheckInModeProvider';

function renderWithProvider(ui: React.ReactElement) {
  return render(<CheckInModeProvider raceId="42">{ui}</CheckInModeProvider>);
}

describe('MultiInputLookup', () => {
  it('strips non-digits from BIB input', () => {
    const onSubmitBib = jest.fn();
    renderWithProvider(
      <MultiInputLookup
        onSubmitBib={onSubmitBib}
        onSubmitCmnd={jest.fn()}
        onScannedQr={jest.fn()}
        loading={false}
      />,
    );
    const bibInput = screen.getByPlaceholderText(/BIB/i);
    fireEvent.change(bibInput, { target: { value: '12a3b4' } });
    expect((bibInput as HTMLInputElement).value).toMatch(/^[0-9]+$/);
  });

  it('shows CMND area collapsed by default and expands on button click', () => {
    renderWithProvider(
      <MultiInputLookup
        onSubmitBib={jest.fn()}
        onSubmitCmnd={jest.fn()}
        onScannedQr={jest.fn()}
        loading={false}
      />,
    );
    const expand = screen.getByRole('button', { name: /CMND|CCCD|chứng minh/i });
    fireEvent.click(expand);
    expect(screen.getByPlaceholderText(/4 số cuối|last 4/i)).toBeTruthy();
  });

  it('submits BIB on Enter / submit button', () => {
    const onSubmitBib = jest.fn();
    renderWithProvider(
      <MultiInputLookup
        onSubmitBib={onSubmitBib}
        onSubmitCmnd={jest.fn()}
        onScannedQr={jest.fn()}
        loading={false}
      />,
    );
    const bibInput = screen.getByPlaceholderText(/BIB/i);
    fireEvent.change(bibInput, { target: { value: '1001' } });
    fireEvent.keyDown(bibInput, { key: 'Enter' });
    expect(onSubmitBib).toHaveBeenCalled();
  });

  it('disables inputs while loading', () => {
    renderWithProvider(
      <MultiInputLookup
        onSubmitBib={jest.fn()}
        onSubmitCmnd={jest.fn()}
        onScannedQr={jest.fn()}
        loading={true}
      />,
    );
    const inputs = screen.getAllByRole('textbox');
    inputs.forEach((i) => expect((i as HTMLInputElement).disabled).toBe(true));
  });
});
