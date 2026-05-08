// @ts-nocheck — F-017 deferred (TD-F013-TESTSTACK).
/**
 * F-017 — KioskResultCard config-driven render tests.
 *
 * Coverage:
 *  - DEFAULT preset → HeroRank visible, splits visible, sponsor visible if logos
 *  - MINIMAL preset → HeroFinishTime, no splits, no sponsor
 *  - PREMIUM preset → HeroPhoto, customMessage visible
 *  - sponsor logos render when sponsorBanner=true and logos provided
 *  - QR placeholder when qrShare=true (Phase 1)
 */

import { render, screen } from '@testing-library/react';
import { KioskResultCard } from '../components/KioskResultCard';
import {
  DEFAULT_DISPLAY_CONFIG,
  MINIMAL_DISPLAY_CONFIG,
  PREMIUM_DISPLAY_CONFIG,
} from '@/lib/kiosk/result-display-config';

const SAMPLE = {
  bib: '99',
  name: 'Test',
  chipTime: '01:00:00',
  overallRank: '5',
  Chiptimes: JSON.stringify({ Start: '00:00', Finish: '1:00:00' }),
  Paces: JSON.stringify({ Finish: '5:00' }),
  timingPoint: 'FINISH',
};

describe('KioskResultCard (F-017 config-driven)', () => {
  it('DEFAULT preset renders HeroRank', () => {
    render(
      <KioskResultCard
        data={SAMPLE}
        config={{ mongoRaceId: 'r1', ...DEFAULT_DISPLAY_CONFIG }}
      />,
    );
    expect(screen.getByTestId('hero-rank')).toBeTruthy();
  });

  it('MINIMAL preset renders HeroFinishTime, no splits', () => {
    render(
      <KioskResultCard
        data={SAMPLE}
        config={{ mongoRaceId: 'r1', ...MINIMAL_DISPLAY_CONFIG }}
      />,
    );
    expect(screen.getByTestId('hero-finish-time')).toBeTruthy();
    expect(screen.queryByTestId('kiosk-splits-list')).toBeNull();
  });

  it('PREMIUM preset renders HeroPhoto + customMessage', () => {
    render(
      <KioskResultCard
        data={SAMPLE}
        config={{
          mongoRaceId: 'r1',
          ...PREMIUM_DISPLAY_CONFIG,
          customMessage: 'Chúc mừng!',
        }}
      />,
    );
    expect(screen.getByTestId('hero-photo')).toBeTruthy();
    expect(screen.getByText('Chúc mừng!')).toBeTruthy();
  });

  it('sponsor banner renders when logos provided', () => {
    render(
      <KioskResultCard
        data={SAMPLE}
        config={{
          mongoRaceId: 'r1',
          ...DEFAULT_DISPLAY_CONFIG,
          sponsorLogos: ['https://cdn/a.png'],
        }}
      />,
    );
    expect(screen.getByTestId('sponsor-banner')).toBeTruthy();
  });

  it('QR placeholder renders when qrShare=true', () => {
    render(
      <KioskResultCard
        data={SAMPLE}
        config={{
          mongoRaceId: 'r1',
          ...DEFAULT_DISPLAY_CONFIG,
          visibleSections: { ...DEFAULT_DISPLAY_CONFIG.visibleSections, qrShare: true },
        }}
      />,
    );
    expect(screen.getByTestId('qr-share-section')).toBeTruthy();
  });
});
