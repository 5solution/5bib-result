// @ts-nocheck — F-013: @types/jest not in admin node_modules. This spec runs
// PASS via backend's jest+ts-jest (see jest.kiosk.config.cjs); admin tsc skips
// validation here because describe/it/expect globals aren't typed in admin.
/**
 * F-013 BR-RK-11 — Runtime type guard for `unknown` SDK response.
 *
 * Coverage:
 *  - happy: well-formed envelope → guard returns true
 *  - edge: missing success → false
 *  - edge: data wrong type → false
 *  - edge: null / undefined / array → false
 *  - edge: bib wrong type → false
 *  - edge: extra fields tolerated (forward-compat)
 */

import { isAthleteDetailResponse, deriveKioskStatus } from '../kiosk.types';

describe('isAthleteDetailResponse (BR-RK-11)', () => {
  it('accepts well-formed envelope with data object', () => {
    const payload = {
      success: true,
      data: {
        bib: '1001',
        name: 'Nguyễn Văn A',
        chipTime: '02:00:15',
        gunTime: '02:01:00',
        Chiptimes: '{"Start":"00:00","Finish":"02:00:15"}',
      },
    };
    expect(isAthleteDetailResponse(payload)).toBe(true);
  });

  it('accepts well-formed envelope with data:null (BR-RK-02 not-found)', () => {
    const payload = { success: false, data: null, message: 'Athlete not found' };
    expect(isAthleteDetailResponse(payload)).toBe(true);
  });

  it('accepts numeric bib (vendor sometimes pushes number)', () => {
    const payload = { success: true, data: { bib: 1001, name: 'A' } };
    expect(isAthleteDetailResponse(payload)).toBe(true);
  });

  it('rejects null', () => {
    expect(isAthleteDetailResponse(null)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isAthleteDetailResponse(undefined)).toBe(false);
  });

  it('rejects array', () => {
    expect(isAthleteDetailResponse([])).toBe(false);
  });

  it('rejects primitive', () => {
    expect(isAthleteDetailResponse('hello')).toBe(false);
    expect(isAthleteDetailResponse(42)).toBe(false);
    expect(isAthleteDetailResponse(true)).toBe(false);
  });

  it('rejects missing success', () => {
    expect(isAthleteDetailResponse({ data: { bib: '1' } })).toBe(false);
  });

  it('rejects success non-boolean', () => {
    expect(isAthleteDetailResponse({ success: 'true', data: null })).toBe(false);
  });

  it('rejects data array', () => {
    expect(isAthleteDetailResponse({ success: true, data: [] })).toBe(false);
  });

  it('rejects bib wrong type (object)', () => {
    expect(
      isAthleteDetailResponse({ success: true, data: { bib: { v: 1 } } }),
    ).toBe(false);
  });

  it('rejects Chiptimes non-string', () => {
    expect(
      isAthleteDetailResponse({
        success: true,
        data: { bib: '1', Chiptimes: { Start: '00:00' } },
      }),
    ).toBe(false);
  });

  it('tolerates extra unknown fields (forward-compat)', () => {
    const payload = {
      success: true,
      data: { bib: '1001', name: 'A', futureField: { x: 1 } },
    };
    expect(isAthleteDetailResponse(payload)).toBe(true);
  });
});

describe('deriveKioskStatus (BR-RK-03/04/05/08)', () => {
  it('returns FIN for finished athlete with valid rank + chipTime', () => {
    expect(
      deriveKioskStatus({
        timingPoint: 'Finish',
        overallRank: '5',
        chipTime: '01:30:22',
      }),
    ).toBe('FIN');
  });

  it('returns DNS when timingPoint=DNS', () => {
    expect(deriveKioskStatus({ timingPoint: 'DNS' })).toBe('DNS');
  });

  it('returns DNF when timingPoint=DNF', () => {
    expect(deriveKioskStatus({ timingPoint: 'DNF' })).toBe('DNF');
  });

  it('returns DSQ when timingPoint starts with DSQ', () => {
    expect(deriveKioskStatus({ timingPoint: 'DSQ-CUTOFF' })).toBe('DSQ');
  });

  it('returns LIVE when timingPoint is intermediate (TM2)', () => {
    expect(
      deriveKioskStatus({
        timingPoint: 'TM2',
        overallRank: '12',
        chipTime: '00:42:11',
      }),
    ).toBe('LIVE');
  });

  it('returns DNF when Finish reached but rank invalid', () => {
    expect(
      deriveKioskStatus({
        timingPoint: 'Finish',
        overallRank: '-1',
        chipTime: '00:00:00',
      }),
    ).toBe('DNF');
  });

  it('returns null for null/undefined input', () => {
    expect(deriveKioskStatus(null)).toBe(null);
    expect(deriveKioskStatus(undefined)).toBe(null);
  });
});
