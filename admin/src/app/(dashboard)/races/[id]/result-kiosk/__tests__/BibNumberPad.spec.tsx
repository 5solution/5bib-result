// @ts-nocheck — F-013: jest + @testing-library/react not in admin node_modules
// (Manager STOP trigger "NO npm install"). Spec is correct Jest+RTL form,
// will type-check + run once admin gains the test stack (Phase 2).
/**
 * F-013 BR-RK-01 — BIB number-pad tests (Jest + @testing-library/react).
 *
 * Coverage:
 *  - happy: tap digit → onAppend fires with that digit
 *  - edge: max 6 digit cap (BR-RK-01) — buttons disable at limit
 *  - edge: clear empties (button disabled when value empty)
 *  - edge: backspace removes last (button disabled when value empty)
 *  - edge: submit fires onSubmit with current value, disabled when empty
 *  - edge: keyboard fallback — non-digit kbd input swallowed (no callback)
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { BibNumberPad } from '../components/BibNumberPad';

describe('BibNumberPad (BR-RK-01)', () => {
  function setup(value: string) {
    const onAppend = jest.fn();
    const onBackspace = jest.fn();
    const onClear = jest.fn();
    const onSubmit = jest.fn();
    render(
      <BibNumberPad
        value={value}
        onAppend={onAppend}
        onBackspace={onBackspace}
        onClear={onClear}
        onSubmit={onSubmit}
      />,
    );
    return { onAppend, onBackspace, onClear, onSubmit };
  }

  it('renders all 10 digits + Clear + Backspace + Submit', () => {
    setup('');
    for (let d = 0; d <= 9; d++) {
      expect(screen.getByText(String(d))).toBeTruthy();
    }
    expect(screen.getByTestId('kiosk-bib-numberpad')).toBeTruthy();
  });

  it('digit tap triggers onAppend with that digit', () => {
    const { onAppend } = setup('');
    fireEvent.click(screen.getByText('5'));
    expect(onAppend).toHaveBeenCalledWith('5');
  });

  it('caps at 6 digits — digit buttons disabled at value.length=6 (BR-RK-01)', () => {
    setup('123456');
    const button5 = screen.getByText('5').closest('button');
    expect(button5).toBeTruthy();
    expect(button5?.disabled).toBe(true);
  });

  it('Clear button disabled when value empty, enabled otherwise', () => {
    const { onClear } = setup('');
    const clearBtn = screen.getByLabelText('Xoá');
    expect((clearBtn as HTMLButtonElement).disabled).toBe(true);

    setup('123');
    const clearBtnFilled = screen.getAllByLabelText('Xoá').slice(-1)[0];
    fireEvent.click(clearBtnFilled);
    expect(onClear).toHaveBeenCalled();
  });

  it('Backspace fires onBackspace and disabled when empty', () => {
    setup('');
    const bk = screen.getByLabelText('Xoá ký tự cuối');
    expect((bk as HTMLButtonElement).disabled).toBe(true);

    const { onBackspace } = setup('123');
    const bk2 = screen.getAllByLabelText('Xoá ký tự cuối').slice(-1)[0];
    fireEvent.click(bk2);
    expect(onBackspace).toHaveBeenCalled();
  });

  it('Submit disabled when value empty, fires onSubmit otherwise', () => {
    setup('');
    const sub = screen.getByText('Tìm');
    expect((sub as HTMLButtonElement).disabled).toBe(true);

    const { onSubmit } = setup('1234');
    const sub2 = screen.getAllByText('Tìm').slice(-1)[0];
    fireEvent.click(sub2);
    expect(onSubmit).toHaveBeenCalled();
  });

  it('keyboard fallback — digit key triggers onAppend', () => {
    const { onAppend } = setup('');
    const wrapper = screen.getByTestId('kiosk-bib-numberpad');
    fireEvent.keyDown(wrapper, { key: '7' });
    expect(onAppend).toHaveBeenCalledWith('7');
  });

  it('keyboard fallback — non-digit key swallowed (no callback)', () => {
    const { onAppend } = setup('');
    const wrapper = screen.getByTestId('kiosk-bib-numberpad');
    fireEvent.keyDown(wrapper, { key: 'a' });
    fireEvent.keyDown(wrapper, { key: 'X' });
    expect(onAppend).not.toHaveBeenCalled();
  });

  it('keyboard fallback — Enter triggers onSubmit when value present', () => {
    const { onSubmit } = setup('123');
    const wrapper = screen.getByTestId('kiosk-bib-numberpad');
    fireEvent.keyDown(wrapper, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalled();
  });
});
