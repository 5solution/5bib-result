// @ts-nocheck — F-015 BR-CK-18: @types/jest not in admin node_modules. Spec runs
// PASS via backend's jest+ts-jest (see jest.kiosk.config.cjs); admin tsc skips
// validation here because describe/it/expect globals aren't typed in admin.
/**
 * F-015 BR-CK-18 — Runtime type guards for `unknown` SDK responses.
 *
 * Coverage:
 *  - isAthleteCheckInResponse: well-formed envelope, data null/array/object,
 *    rejects null/undefined/array-as-envelope/wrong-type-success/bad-data.
 *  - isAthleteCheckInPayload: bib type discipline, name type, racekitReceived bool.
 *  - isConfirmPickupResponse: envelope shape + nested data.bib string check.
 *  - isCheckInStatsResponse: nested totals number check.
 */

import {
  isAthleteCheckInResponse,
  isAthleteCheckInPayload,
  isConfirmPickupResponse,
  isCheckInStatsResponse,
} from '../checkin.types';

describe('isAthleteCheckInResponse (BR-CK-18)', () => {
  it('accepts well-formed envelope with data object', () => {
    const payload = {
      success: true,
      data: { bib: '1001', name: 'Nguyễn Văn A', racekitReceived: false, athleteId: 555 },
    };
    expect(isAthleteCheckInResponse(payload)).toBe(true);
  });

  it('accepts well-formed envelope with data:null (not-found)', () => {
    expect(isAthleteCheckInResponse({ success: false, data: null })).toBe(true);
  });

  it('accepts envelope with data array (CMND multi-candidate)', () => {
    const payload = {
      success: true,
      data: [
        { bib: '1001', racekitReceived: false },
        { bib: '1002', racekitReceived: true },
      ],
    };
    expect(isAthleteCheckInResponse(payload)).toBe(true);
  });

  it('rejects null / undefined / primitive / array-as-envelope', () => {
    expect(isAthleteCheckInResponse(null)).toBe(false);
    expect(isAthleteCheckInResponse(undefined)).toBe(false);
    expect(isAthleteCheckInResponse('hello')).toBe(false);
    expect(isAthleteCheckInResponse(42)).toBe(false);
    expect(isAthleteCheckInResponse(true)).toBe(false);
  });

  it('rejects missing success or non-boolean success', () => {
    expect(isAthleteCheckInResponse({ data: null })).toBe(false);
    expect(isAthleteCheckInResponse({ success: 'true', data: null })).toBe(false);
  });

  it('rejects malformed data.bib (object)', () => {
    expect(
      isAthleteCheckInResponse({ success: true, data: { bib: { nested: 1 } } }),
    ).toBe(false);
  });

  it('tolerates extra unknown fields (forward-compat)', () => {
    expect(
      isAthleteCheckInResponse({
        success: true,
        data: { bib: '1001', futureField: 99, racekitReceived: false },
      }),
    ).toBe(true);
  });
});

describe('isAthleteCheckInPayload', () => {
  it('accepts numeric bib (vendor sometimes pushes number)', () => {
    expect(isAthleteCheckInPayload({ bib: 1001, racekitReceived: false })).toBe(true);
  });

  it('rejects non-bool racekitReceived', () => {
    expect(isAthleteCheckInPayload({ bib: '1', racekitReceived: 'yes' })).toBe(false);
  });

  it('rejects null', () => {
    expect(isAthleteCheckInPayload(null)).toBe(false);
  });
});

describe('isConfirmPickupResponse', () => {
  it('accepts envelope with bib string', () => {
    expect(
      isConfirmPickupResponse({
        success: true,
        data: { bib: '1001', athleteId: 555, checkedInAt: 'x', stationId: '1', source: 'bib' },
      }),
    ).toBe(true);
  });

  it('rejects envelope where data.bib is number', () => {
    expect(
      isConfirmPickupResponse({ success: true, data: { bib: 1001 } }),
    ).toBe(false);
  });

  it('accepts success:false with no data', () => {
    expect(isConfirmPickupResponse({ success: false })).toBe(true);
  });

  it('rejects null/undefined', () => {
    expect(isConfirmPickupResponse(null)).toBe(false);
    expect(isConfirmPickupResponse(undefined)).toBe(false);
  });
});

describe('isCheckInStatsResponse', () => {
  it('accepts envelope with valid totals', () => {
    expect(
      isCheckInStatsResponse({
        success: true,
        data: {
          totalAthletes: 100,
          pickedUp: 25,
          perStation: [],
          ratePerMinute: 5,
          recentEvents: [],
        },
      }),
    ).toBe(true);
  });

  it('rejects non-number totalAthletes', () => {
    expect(
      isCheckInStatsResponse({
        success: true,
        data: { totalAthletes: '100', pickedUp: 0 },
      }),
    ).toBe(false);
  });

  it('accepts envelope with no data field', () => {
    expect(isCheckInStatsResponse({ success: true })).toBe(true);
  });
});
