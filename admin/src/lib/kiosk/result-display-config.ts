/**
 * F-017 — Result Kiosk Display config TypeScript types + presets + runtime
 * guard / resolver. Mirrors backend `result-kiosk-display.schema.ts` shape.
 *
 * Colocated under `admin/src/lib/kiosk/` (per F-013/F-015 shared kiosk lib
 * convention) so the result-kiosk page tree consumes via barrel import.
 */

export type HeroChoice = 'rank' | 'finish-time' | 'photo';

export interface VisibleSections {
  rank: boolean;
  finishTime: boolean;
  splits: boolean;
  sponsorBanner: boolean;
  customMessage: boolean;
  qrShare: boolean; // Phase 2 — Phase 1 placeholder
  photo: boolean;
}

export type DisplayPreset = 'DEFAULT' | 'MINIMAL' | 'PREMIUM' | 'CUSTOM';

export interface DisplayConfig {
  mongoRaceId: string;
  heroChoice: HeroChoice;
  visibleSections: VisibleSections;
  themeColor: string; // hex, e.g. '#FF0E65'
  customMessage: string;
  sponsorLogos: string[]; // S3 URLs
  soundEnabled: boolean;
  idleTimeoutSeconds: number;
  preset: DisplayPreset;
}

/** Local DEFAULT used when backend has not yet lazy-created the doc. */
export const DEFAULT_DISPLAY_CONFIG: Omit<DisplayConfig, 'mongoRaceId'> = {
  heroChoice: 'rank',
  visibleSections: {
    rank: true,
    finishTime: true,
    splits: true,
    sponsorBanner: true,
    customMessage: false,
    qrShare: false,
    photo: false,
  },
  themeColor: '#FF0E65',
  customMessage: '',
  sponsorLogos: [],
  soundEnabled: true,
  idleTimeoutSeconds: 60,
  preset: 'DEFAULT',
};

export const MINIMAL_DISPLAY_CONFIG: Omit<DisplayConfig, 'mongoRaceId'> = {
  heroChoice: 'finish-time',
  visibleSections: {
    rank: true,
    finishTime: true,
    splits: false,
    sponsorBanner: false,
    customMessage: false,
    qrShare: false,
    photo: false,
  },
  themeColor: '#1c1917',
  customMessage: '',
  sponsorLogos: [],
  soundEnabled: false,
  idleTimeoutSeconds: 30,
  preset: 'MINIMAL',
};

export const PREMIUM_DISPLAY_CONFIG: Omit<DisplayConfig, 'mongoRaceId'> = {
  heroChoice: 'photo',
  visibleSections: {
    rank: true,
    finishTime: true,
    splits: true,
    sponsorBanner: true,
    customMessage: true,
    qrShare: false,
    photo: true,
  },
  themeColor: '#1d4ed8',
  customMessage: '',
  sponsorLogos: [],
  soundEnabled: true,
  idleTimeoutSeconds: 90,
  preset: 'PREMIUM',
};

export const PRESETS: Record<
  Exclude<DisplayPreset, 'CUSTOM'>,
  Omit<DisplayConfig, 'mongoRaceId'>
> = {
  DEFAULT: DEFAULT_DISPLAY_CONFIG,
  MINIMAL: MINIMAL_DISPLAY_CONFIG,
  PREMIUM: PREMIUM_DISPLAY_CONFIG,
};

/**
 * Defensive resolver — accepts a partial / unknown payload from the backend
 * and merges it onto DEFAULT so missing fields don't crash render.
 *
 * Reuse pattern of F-013 `isAthleteDetailResponse` runtime guard.
 */
export function resolveDisplayConfig(
  mongoRaceId: string,
  partial: unknown,
): DisplayConfig {
  const base = { mongoRaceId, ...DEFAULT_DISPLAY_CONFIG };
  if (!partial || typeof partial !== 'object') return base;

  const p = partial as Partial<DisplayConfig>;
  return {
    mongoRaceId,
    heroChoice: validHeroChoice(p.heroChoice) ?? base.heroChoice,
    visibleSections: {
      ...base.visibleSections,
      ...(p.visibleSections ?? {}),
    },
    themeColor: typeof p.themeColor === 'string' && /^#[0-9a-f]{6}$/i.test(p.themeColor)
      ? p.themeColor
      : base.themeColor,
    customMessage: typeof p.customMessage === 'string' ? p.customMessage : base.customMessage,
    sponsorLogos: Array.isArray(p.sponsorLogos) ? p.sponsorLogos.filter((u) => typeof u === 'string') : base.sponsorLogos,
    soundEnabled: typeof p.soundEnabled === 'boolean' ? p.soundEnabled : base.soundEnabled,
    idleTimeoutSeconds: typeof p.idleTimeoutSeconds === 'number' && p.idleTimeoutSeconds >= 10
      ? p.idleTimeoutSeconds
      : base.idleTimeoutSeconds,
    preset: validPreset(p.preset) ?? base.preset,
  };
}

function validHeroChoice(x: unknown): HeroChoice | null {
  return x === 'rank' || x === 'finish-time' || x === 'photo' ? x : null;
}

function validPreset(x: unknown): DisplayPreset | null {
  return x === 'DEFAULT' || x === 'MINIMAL' || x === 'PREMIUM' || x === 'CUSTOM' ? x : null;
}
