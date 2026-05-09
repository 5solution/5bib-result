/**
 * F-017 runtime guard tests — verify resolveDisplayConfig + presets + safe
 * defaults. Pure functions, no React or DOM — runs in plain Jest.
 */

import {
  DEFAULT_DISPLAY_CONFIG,
  MINIMAL_DISPLAY_CONFIG,
  PREMIUM_DISPLAY_CONFIG,
  PRESETS,
  resolveDisplayConfig,
} from '../result-display-config';

describe('result-display-config (F-017)', () => {
  it('DEFAULT preset has rank hero + sponsor visible', () => {
    expect(DEFAULT_DISPLAY_CONFIG.heroChoice).toBe('rank');
    expect(DEFAULT_DISPLAY_CONFIG.visibleSections.sponsorBanner).toBe(true);
    expect(DEFAULT_DISPLAY_CONFIG.visibleSections.qrShare).toBe(false);
    expect(DEFAULT_DISPLAY_CONFIG.soundEnabled).toBe(true);
  });

  it('MINIMAL preset hides splits/sponsor and uses finish-time hero', () => {
    expect(MINIMAL_DISPLAY_CONFIG.heroChoice).toBe('finish-time');
    expect(MINIMAL_DISPLAY_CONFIG.visibleSections.splits).toBe(false);
    expect(MINIMAL_DISPLAY_CONFIG.visibleSections.sponsorBanner).toBe(false);
    expect(MINIMAL_DISPLAY_CONFIG.soundEnabled).toBe(false);
  });

  it('PREMIUM preset enables photo + customMessage', () => {
    expect(PREMIUM_DISPLAY_CONFIG.heroChoice).toBe('photo');
    expect(PREMIUM_DISPLAY_CONFIG.visibleSections.photo).toBe(true);
    expect(PREMIUM_DISPLAY_CONFIG.visibleSections.customMessage).toBe(true);
  });

  it('PRESETS map exposes DEFAULT/MINIMAL/PREMIUM', () => {
    expect(PRESETS.DEFAULT.heroChoice).toBe('rank');
    expect(PRESETS.MINIMAL.heroChoice).toBe('finish-time');
    expect(PRESETS.PREMIUM.heroChoice).toBe('photo');
  });

  it('resolveDisplayConfig falls back to DEFAULT on null/undefined', () => {
    expect(resolveDisplayConfig('race_x123abcd', null).heroChoice).toBe('rank');
    expect(resolveDisplayConfig('race_x123abcd', undefined).heroChoice).toBe('rank');
  });

  it('resolveDisplayConfig merges partial visibleSections onto base', () => {
    const out = resolveDisplayConfig('race_partial1', {
      visibleSections: { qrShare: true },
    } as never);
    expect(out.visibleSections.qrShare).toBe(true);
    expect(out.visibleSections.rank).toBe(true); // base preserved
    expect(out.visibleSections.splits).toBe(true);
  });

  it('resolveDisplayConfig rejects malformed themeColor', () => {
    const out = resolveDisplayConfig('race_bad1', {
      themeColor: 'red; DROP TABLE races;',
    } as never);
    expect(out.themeColor).toBe('#FF0E65');
  });

  it('resolveDisplayConfig rejects negative idleTimeoutSeconds', () => {
    const out = resolveDisplayConfig('race_negidle', {
      idleTimeoutSeconds: -10,
    } as never);
    expect(out.idleTimeoutSeconds).toBe(60);
  });

  it('resolveDisplayConfig accepts valid hex color', () => {
    const out = resolveDisplayConfig('race_color1', {
      themeColor: '#abcdef',
    } as never);
    expect(out.themeColor).toBe('#abcdef');
  });

  it('resolveDisplayConfig filters non-string sponsorLogos', () => {
    const out = resolveDisplayConfig('race_logos1', {
      sponsorLogos: ['https://cdn/a.png', 12345 as never, null as never, 'https://cdn/b.png'],
    } as never);
    expect(out.sponsorLogos).toEqual(['https://cdn/a.png', 'https://cdn/b.png']);
  });
});
