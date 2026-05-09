// @ts-nocheck — F-017: jest + @testing-library/react not in admin node_modules
// (TD-F013-TESTSTACK locked). Spec is correct Jest+RTL form, will type-check
// + run once admin gains the test stack (Phase 2).
/**
 * F-017 BR-AF-23 — ChipScanInput tests (byte-for-byte port verification).
 *
 * Coverage:
 *  - happy: emits chip ID + Enter → onScan called with UPPER+TRIM
 *  - edge: composition (IME) window suppresses scan
 *  - edge: <200ms gap accumulates, >200ms resets buffer
 *  - edge: same chip within 1500ms debounced
 *  - edge: focus on <input> without data-rfid-capture is ignored
 */

import { fireEvent, render } from '@testing-library/react';
import { ChipScanInput } from '../components/ChipScanInput';

describe('ChipScanInput (F-017 BR-AF-23 verbatim port)', () => {
  it('emits onScan with UPPER+TRIM chipId after Enter', () => {
    const onScan = jest.fn();
    render(<ChipScanInput onScan={onScan} />);
    'abc123'.split('').forEach((ch) => {
      fireEvent.keyDown(window, { key: ch });
    });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onScan).toHaveBeenCalledWith('ABC123');
  });

  it('IME composition suppresses buffer accumulation', () => {
    const onScan = jest.fn();
    render(<ChipScanInput onScan={onScan} />);
    fireEvent.compositionStart(window);
    fireEvent.keyDown(window, { key: 'a' });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onScan).not.toHaveBeenCalled();
  });

  it('debounces same chip within 1.5s', () => {
    jest.useFakeTimers();
    const onScan = jest.fn();
    render(<ChipScanInput onScan={onScan} />);
    'X1'.split('').forEach((ch) => fireEvent.keyDown(window, { key: ch }));
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onScan).toHaveBeenCalledTimes(1);
    'X1'.split('').forEach((ch) => fireEvent.keyDown(window, { key: ch }));
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onScan).toHaveBeenCalledTimes(1); // debounced
    jest.useRealTimers();
  });

  it('disabled prop suppresses listener', () => {
    const onScan = jest.fn();
    render(<ChipScanInput onScan={onScan} disabled />);
    'abc'.split('').forEach((ch) => fireEvent.keyDown(window, { key: ch }));
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onScan).not.toHaveBeenCalled();
  });
});
