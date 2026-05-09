// @ts-nocheck — F-019: @types/jest not in admin node_modules. Spec runs PASS
// via backend's jest+ts-jest stack (jest.kiosk.config.cjs); admin tsc skips
// validation here because describe/it/expect globals aren't typed in admin.
/**
 * F-019 BR-AG-40 — runtime guards for `unknown` SDK responses.
 * Pattern follows F-018 `medical.types.spec.ts` (15-case precedent).
 *
 * Coverage (20 cases — well above F-018 15-case baseline):
 *  - happy: well-formed Podium / List / Anomaly / List
 *  - edge: missing id / wrong type
 *  - edge: tier out of range
 *  - edge: confidence out of range
 *  - edge: arrays not arrays
 *  - edge: extra fields tolerated (forward-compat)
 *  - state machine canTransitionTo helper (forward-only)
 */

import {
  canTransitionTo,
  isAnomalyWarning,
  isAnomalyWarningListResponse,
  isPodiumListResponse,
  isPodiumResponse,
} from './awards.types';
import { ALLOWED_TRANSITIONS } from './awards.constant';

const validPodium = {
  id: 'p1',
  raceId: 'r1',
  courseId: 'c1',
  courseName: 'Marathon 42K',
  ageGroup: '30-39',
  ageGroupKey: 'M_30-39',
  ageGroupLabel: 'Nam 30-39',
  gender: 'M',
  presetKey: 'vn_road_default',
  compoundingMode: 'compounding',
  agTopN: 3,
  athletes: [],
  state: 'AG_COMPUTED',
  stateHistory: [],
  createdAt: '2026-05-09T10:00:00Z',
  updatedAt: '2026-05-09T10:00:00Z',
};

const validWarning = {
  id: 'w1',
  raceId: 'r1',
  courseId: 'c1',
  bib: '1234',
  pattern: 'A',
  tier: 1,
  confidence: 0.9,
  evidence: { reason: 'Thiếu finish chip' },
  resolution: 'pending',
  transitionHistory: [],
  createdAt: '2026-05-09T10:00:00Z',
  updatedAt: '2026-05-09T10:00:00Z',
};

describe('isPodiumResponse (BR-AG-40)', () => {
  it('accepts well-formed payload', () => {
    expect(isPodiumResponse(validPodium)).toBe(true);
  });

  it('accepts payload with extra forward-compat fields', () => {
    expect(isPodiumResponse({ ...validPodium, _futureField: 42 })).toBe(true);
  });

  it('rejects null', () => {
    expect(isPodiumResponse(null)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isPodiumResponse(undefined)).toBe(false);
  });

  it('rejects array', () => {
    expect(isPodiumResponse([validPodium])).toBe(false);
  });

  it('rejects empty id', () => {
    expect(isPodiumResponse({ ...validPodium, id: '' })).toBe(false);
  });

  it('rejects when athletes not array', () => {
    expect(isPodiumResponse({ ...validPodium, athletes: 'oops' })).toBe(false);
  });

  it('rejects when stateHistory not array', () => {
    expect(isPodiumResponse({ ...validPodium, stateHistory: null })).toBe(false);
  });
});

describe('isPodiumListResponse', () => {
  it('accepts list with valid items', () => {
    expect(
      isPodiumListResponse({
        items: [validPodium],
        total: 1,
        countsByState: { AG_COMPUTED: 1 },
      }),
    ).toBe(true);
  });

  it('rejects when items contain malformed item', () => {
    expect(
      isPodiumListResponse({
        items: [{ ...validPodium, id: '' }],
        total: 1,
        countsByState: {},
      }),
    ).toBe(false);
  });

  it('rejects when total not number', () => {
    expect(isPodiumListResponse({ items: [], total: '1', countsByState: {} })).toBe(false);
  });
});

describe('isAnomalyWarning', () => {
  it('accepts well-formed warning', () => {
    expect(isAnomalyWarning(validWarning)).toBe(true);
  });

  it('rejects tier out of range (0)', () => {
    expect(isAnomalyWarning({ ...validWarning, tier: 0 })).toBe(false);
  });

  it('rejects tier out of range (4)', () => {
    expect(isAnomalyWarning({ ...validWarning, tier: 4 })).toBe(false);
  });

  it('rejects confidence out of range (-0.1)', () => {
    expect(isAnomalyWarning({ ...validWarning, confidence: -0.1 })).toBe(false);
  });

  it('rejects confidence out of range (1.5)', () => {
    expect(isAnomalyWarning({ ...validWarning, confidence: 1.5 })).toBe(false);
  });

  it('rejects when transitionHistory not array', () => {
    expect(isAnomalyWarning({ ...validWarning, transitionHistory: 'oops' })).toBe(false);
  });
});

describe('isAnomalyWarningListResponse', () => {
  it('accepts list with valid items', () => {
    expect(
      isAnomalyWarningListResponse({
        items: [validWarning],
        total: 1,
        countsByTier: { '1': 1 },
        blockingCount: 1,
      }),
    ).toBe(true);
  });

  it('rejects when blockingCount missing', () => {
    expect(
      isAnomalyWarningListResponse({
        items: [validWarning],
        total: 1,
        countsByTier: { '1': 1 },
      }),
    ).toBe(false);
  });
});

describe('canTransitionTo (BR-AG-23 — forward-only)', () => {
  it('allows RAW_RESULT → AG_COMPUTED', () => {
    expect(canTransitionTo('RAW_RESULT', 'AG_COMPUTED', ALLOWED_TRANSITIONS)).toBe(true);
  });

  it('rejects backward PODIUM_LOCKED → PODIUM_DRAFT (UNHAPPY-14)', () => {
    expect(canTransitionTo('PODIUM_LOCKED', 'PODIUM_DRAFT', ALLOWED_TRANSITIONS)).toBe(false);
  });

  it('PODIUM_FINAL has no outgoing', () => {
    expect(canTransitionTo('PODIUM_FINAL', 'AG_COMPUTED', ALLOWED_TRANSITIONS)).toBe(false);
  });
});
