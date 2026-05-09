// @ts-nocheck — F-018: @types/jest not in admin node_modules. Spec runs PASS
// via backend's jest+ts-jest stack (jest.kiosk.config.cjs); admin tsc skips
// validation here because describe/it/expect globals aren't typed in admin.
/**
 * F-018 BR-MI-36 — runtime guard for `unknown` SDK response.
 * Pattern follows F-013 `kiosk.types.spec.ts` (13/13 PASS precedent).
 *
 * Coverage (15 cases — well above F-013 13-case baseline):
 *  - happy: well-formed envelope → guard returns true
 *  - edge: missing id / wrong type
 *  - edge: severity out of range
 *  - edge: gpsLocation missing or malformed
 *  - edge: arrays not arrays
 *  - edge: extra fields tolerated (forward-compat)
 *  - state machine canTransitionTo helper
 */

import {
  canTransitionTo,
  isIncidentListResponse,
  isIncidentResponse,
  isSeverity,
} from './medical.types';
import { ALLOWED_TRANSITIONS } from './medical.constant';

const validIncident = {
  id: 'inc1',
  raceId: 'race1',
  severity: 3,
  category: 'cardiac',
  state: 'REPORTED',
  gpsLocation: { lat: 21.0285, lng: 105.8542, source: 'manual' },
  incidentTransitions: [],
  medicalTeamAssigned: [],
  witnessStatements: [],
  attachments: [],
  reportedByUserId: 'u1',
  reportedAt: '2026-05-08T10:00:00Z',
  anonymized: false,
  createdAt: '2026-05-08T10:00:00Z',
  updatedAt: '2026-05-08T10:00:00Z',
};

describe('isIncidentResponse (BR-MI-36)', () => {
  it('accepts well-formed payload', () => {
    expect(isIncidentResponse(validIncident)).toBe(true);
  });

  it('accepts payload with extra forward-compat fields', () => {
    expect(
      isIncidentResponse({ ...validIncident, _futureField: 42 }),
    ).toBe(true);
  });

  it('rejects null', () => {
    expect(isIncidentResponse(null)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isIncidentResponse(undefined)).toBe(false);
  });

  it('rejects array', () => {
    expect(isIncidentResponse([validIncident])).toBe(false);
  });

  it('rejects empty id', () => {
    expect(isIncidentResponse({ ...validIncident, id: '' })).toBe(false);
  });

  it('rejects severity out of range (0)', () => {
    expect(isIncidentResponse({ ...validIncident, severity: 0 })).toBe(false);
  });

  it('rejects severity out of range (6)', () => {
    expect(isIncidentResponse({ ...validIncident, severity: 6 })).toBe(false);
  });

  it('rejects severity wrong type (string)', () => {
    expect(isIncidentResponse({ ...validIncident, severity: '3' })).toBe(false);
  });

  it('rejects missing gpsLocation', () => {
    const { gpsLocation: _, ...rest } = validIncident;
    expect(isIncidentResponse(rest)).toBe(false);
  });

  it('rejects gpsLocation with non-numeric lat', () => {
    expect(
      isIncidentResponse({
        ...validIncident,
        gpsLocation: { lat: '21' as any, lng: 105, source: 'manual' },
      }),
    ).toBe(false);
  });

  it('rejects when medicalTeamAssigned is not array', () => {
    expect(
      isIncidentResponse({
        ...validIncident,
        medicalTeamAssigned: 'BS-A' as any,
      }),
    ).toBe(false);
  });

  it('rejects when incidentTransitions is missing', () => {
    const { incidentTransitions: _, ...rest } = validIncident;
    expect(isIncidentResponse(rest)).toBe(false);
  });

  it('rejects when witnessStatements is not array', () => {
    expect(
      isIncidentResponse({ ...validIncident, witnessStatements: null }),
    ).toBe(false);
  });

  it('rejects when attachments is not array', () => {
    expect(
      isIncidentResponse({ ...validIncident, attachments: undefined }),
    ).toBe(false);
  });
});

describe('isIncidentListResponse', () => {
  it('accepts well-formed list', () => {
    expect(
      isIncidentListResponse({
        items: [validIncident],
        total: 1,
        limit: 50,
        offset: 0,
        activeCount: 1,
      }),
    ).toBe(true);
  });

  it('rejects when items contains malformed entry', () => {
    expect(
      isIncidentListResponse({
        items: [{ ...validIncident, severity: 99 }],
        total: 1,
        limit: 50,
        offset: 0,
        activeCount: 1,
      }),
    ).toBe(false);
  });

  it('rejects when total missing', () => {
    expect(
      isIncidentListResponse({ items: [], activeCount: 0, limit: 50, offset: 0 }),
    ).toBe(false);
  });
});

describe('isSeverity', () => {
  it('accepts 1..5', () => {
    [1, 2, 3, 4, 5].forEach((s) => expect(isSeverity(s)).toBe(true));
  });

  it('rejects 0, 6, NaN, null', () => {
    [0, 6, NaN, null, undefined, '3', 1.5].forEach((s) =>
      expect(isSeverity(s)).toBe(false),
    );
  });
});

describe('canTransitionTo (BR-MI-12 forward-only)', () => {
  it('REPORTED → MEDIC_DISPATCHED allowed', () => {
    expect(
      canTransitionTo('REPORTED', 'MEDIC_DISPATCHED', ALLOWED_TRANSITIONS),
    ).toBe(true);
  });

  it('REPORTED → HOSPITAL_TRANSFER NOT allowed (must hit AMB_REQUESTED first)', () => {
    expect(
      canTransitionTo('REPORTED', 'HOSPITAL_TRANSFER', ALLOWED_TRANSITIONS),
    ).toBe(false);
  });

  it('CLOSED is terminal — no forward transitions', () => {
    expect(
      canTransitionTo('CLOSED', 'REPORTED', ALLOWED_TRANSITIONS),
    ).toBe(false);
    expect(
      canTransitionTo('CLOSED', 'CLOSED', ALLOWED_TRANSITIONS),
    ).toBe(false);
  });

  it('Lvl 1 shortcut REPORTED → RESOLVED_ONSITE allowed', () => {
    expect(
      canTransitionTo('REPORTED', 'RESOLVED_ONSITE', ALLOWED_TRANSITIONS),
    ).toBe(true);
  });

  it('HOSPITAL_TRANSFER → CLOSED allowed', () => {
    expect(
      canTransitionTo('HOSPITAL_TRANSFER', 'CLOSED', ALLOWED_TRANSITIONS),
    ).toBe(true);
  });

  it('RESOLVED_ONSITE → CLOSED allowed (only forward path)', () => {
    expect(
      canTransitionTo('RESOLVED_ONSITE', 'CLOSED', ALLOWED_TRANSITIONS),
    ).toBe(true);
  });

  it('RESOLVED_ONSITE → REPORTED NOT allowed (forward-only)', () => {
    expect(
      canTransitionTo('RESOLVED_ONSITE', 'REPORTED', ALLOWED_TRANSITIONS),
    ).toBe(false);
  });
});
