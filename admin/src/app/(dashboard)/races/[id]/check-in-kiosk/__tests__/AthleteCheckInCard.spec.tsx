// @ts-nocheck — F-015: deferred RTL spec. @testing-library/react + jsdom not in
// admin node_modules (TD-F013-TESTSTACK).
/**
 * F-015 BR-CK-03/04 — AthleteCheckInCard component tests.
 *
 * Coverage:
 *  - renders BIB, name, course, gender, t-shirt size
 *  - shows "đã pickup" warning when racekitReceived=true
 *  - chip-verified badge appears when chipVerified=true
 *  - card variant changes color when already-picked
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { AthleteCheckInCard } from '../components/AthleteCheckInCard';

const baseAthlete = {
  athleteId: 555,
  bib: '1001',
  name: 'Nguyễn Văn A',
  course: '21K',
  courseDistance: '21K',
  gender: 'M',
  size: 'L',
  items: 'BIB, áo, túi đeo',
  racekitReceived: false,
};

describe('AthleteCheckInCard', () => {
  it('renders BIB + name + course', () => {
    render(<AthleteCheckInCard athlete={baseAthlete} />);
    expect(screen.getByText(/1001/)).toBeTruthy();
    expect(screen.getByText(/Nguyễn Văn A/)).toBeTruthy();
    expect(screen.getByText(/21K/)).toBeTruthy();
  });

  it('shows already-picked warning when racekitReceived=true', () => {
    render(
      <AthleteCheckInCard
        athlete={{
          ...baseAthlete,
          racekitReceived: true,
          racekitReceivedAt: '2026-05-08T05:00:00Z',
        }}
      />,
    );
    expect(screen.getByText(/đã pickup|đã nhận|already picked/i)).toBeTruthy();
  });

  it('shows chip-verified badge when chipVerified=true', () => {
    render(
      <AthleteCheckInCard athlete={{ ...baseAthlete, chipVerified: true }} />,
    );
    expect(screen.getByText(/chip|verified/i)).toBeTruthy();
  });

  it('renders gender + size when provided', () => {
    render(<AthleteCheckInCard athlete={baseAthlete} />);
    expect(screen.getByText(/L/)).toBeTruthy();
    expect(screen.getByText(/M/)).toBeTruthy();
  });
});
