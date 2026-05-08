// @ts-nocheck — F-014 deferred spec (TD-F013-TESTSTACK locked).
/**
 * F-014 BR-AS-01 — StatusBadge renders 9 statuses.
 *
 * Coverage:
 *   - one assertion per status (renders the VN label OR the status code)
 *   - LIVE includes pulse dot
 *   - aria-label uses statusFullLabel (a11y)
 *   - compact mode shows status code instead of label
 *   - unknown status falls back to neutral chip with raw code
 */

import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../components/StatusBadge';
import { ATHLETE_STATUSES, STATUS_TONES } from '../athletes.constant';
import { ATHLETES_VN } from '../athletes.microcopy';

describe('StatusBadge (BR-AS-01)', () => {
  ATHLETE_STATUSES.forEach((s) => {
    it(`renders status ${s} with correct VN label`, () => {
      render(<StatusBadge status={s} />);
      const badge = screen.getByTestId(`status-badge-${s}`);
      expect(badge).toBeTruthy();
      expect(badge.textContent).toContain(STATUS_TONES[s].label);
      expect(badge.getAttribute('aria-label')).toBe(ATHLETES_VN.statusFullLabel[s]);
    });
  });

  it('LIVE includes a pulsing dot', () => {
    const { container } = render(<StatusBadge status="LIVE" />);
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('compact mode shows raw status code', () => {
    render(<StatusBadge status="DSQ" compact />);
    const badge = screen.getByTestId('status-badge-DSQ');
    expect(badge.textContent).toContain('DSQ');
  });

  it('unknown status falls back to neutral rendering', () => {
    // @ts-expect-error — intentional bad status
    const { getByTitle } = render(<StatusBadge status="WAT" />);
    expect(getByTitle('WAT')).toBeTruthy();
  });
});
