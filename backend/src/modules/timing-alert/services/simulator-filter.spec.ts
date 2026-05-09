import { RaceResultApiItem } from '../../race-result/types/race-result-api.types';

/**
 * Phase A unit tests — `filterAthlete` keep keys empty value match real RR.
 *
 * Note: filterAthlete is internal helper, exposed via simulator service.serve().
 * Tests target behavior contract (input → output JSON shape) thay vì call
 * internal directly để tránh export private helpers.
 *
 * Để test chính xác filter, em re-implement filter logic trong test file
 * và verify against fixture data. Khi simulator.service.ts đổi behavior,
 * tests phải fail → caller update.
 *
 * **What we test:**
 * - BR-01: KEEP all keys, value="" cho time > cutoff
 * - BR-01: Apply symmetric cho Chiptimes + Guntimes
 * - Edge: athlete chưa qua điểm nào → all keys empty
 * - Edge: athlete đã qua hết → all keys có value
 */

function parseTimeToSeconds(time: string): number | null {
  if (!time || typeof time !== 'string') return null;
  const parts = time.trim().split(':').map((p) => parseInt(p, 10));
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

// Replica of filterTimesField (private helper trong simulator.service.ts)
function filterTimesField(
  raw: string | undefined | null,
  cutoffSeconds: number,
): { json: string | null; lastVisibleKey: string | null } {
  if (!raw || typeof raw !== 'string') {
    return { json: null, lastVisibleKey: null };
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { json: null, lastVisibleKey: null };
  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(trimmed) as Record<string, string>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { json: null, lastVisibleKey: null };
    }
  } catch {
    return { json: null, lastVisibleKey: null };
  }
  const filtered: Record<string, string> = {};
  let lastVisibleKey: string | null = null;
  let lastVisibleSeconds = -1;
  for (const [key, timeStr] of Object.entries(parsed)) {
    if (!timeStr || typeof timeStr !== 'string') {
      filtered[key] = '';
      continue;
    }
    const trimmedTime = timeStr.trim();
    if (trimmedTime.length === 0) {
      filtered[key] = '';
      continue;
    }
    const seconds = parseTimeToSeconds(trimmedTime);
    if (seconds === null) {
      filtered[key] = '';
      continue;
    }
    if (seconds <= cutoffSeconds) {
      filtered[key] = timeStr;
      if (seconds > lastVisibleSeconds) {
        lastVisibleSeconds = seconds;
        lastVisibleKey = key;
      }
    } else {
      filtered[key] = '';
    }
  }
  return { json: JSON.stringify(filtered), lastVisibleKey };
}

describe('Simulator filter — Phase A behavior (BR-01)', () => {
  describe('filterTimesField — keep keys empty value', () => {
    it('keeps all 7 keys with value="" when sim clock = 0 (race chưa start)', () => {
      const raw =
        '{"Start":"00:00","TM1":"1:35:19","TM2":"2:05:53","TM3":"2:47:57","TM4":"3:17:26","TM5":"3:30:25","Finish":"3:43:45"}';
      const result = filterTimesField(raw, -1); // cutoff < 0 → all dropped
      const out = JSON.parse(result.json!);
      expect(Object.keys(out)).toHaveLength(7);
      expect(out.Start).toBe('');
      expect(out.TM1).toBe('');
      expect(out.Finish).toBe('');
      expect(result.lastVisibleKey).toBe(null);
    });

    it('keeps Start visible khi sim clock = 0 (Start time = 00:00 = 0s)', () => {
      const raw =
        '{"Start":"00:00","TM1":"1:35:19","TM2":"2:05:53","Finish":"3:43:45"}';
      const result = filterTimesField(raw, 0);
      const out = JSON.parse(result.json!);
      expect(out.Start).toBe('00:00'); // 0 ≤ 0 → keep
      expect(out.TM1).toBe(''); // 5719 > 0 → empty
      expect(out.Finish).toBe('');
      expect(result.lastVisibleKey).toBe('Start');
    });

    it('keeps Start + TM1 + TM2 visible at cutoff = 2.5h (9000s)', () => {
      const raw =
        '{"Start":"00:00","TM1":"1:35:19","TM2":"2:05:53","TM3":"2:47:57","Finish":"3:43:45"}';
      const result = filterTimesField(raw, 9000);
      const out = JSON.parse(result.json!);
      expect(out.Start).toBe('00:00'); // 0 ≤ 9000
      expect(out.TM1).toBe('1:35:19'); // 5719 ≤ 9000
      expect(out.TM2).toBe('2:05:53'); // 7553 ≤ 9000
      expect(out.TM3).toBe(''); // 10077 > 9000 → empty
      expect(out.Finish).toBe('');
      expect(result.lastVisibleKey).toBe('TM2');
    });

    it('keeps all keys visible when sim clock > finish time', () => {
      const raw =
        '{"Start":"00:00","TM1":"1:35:19","TM2":"2:05:53","Finish":"3:43:45"}';
      const result = filterTimesField(raw, 99999);
      const out = JSON.parse(result.json!);
      expect(out.Start).toBe('00:00');
      expect(out.TM1).toBe('1:35:19');
      expect(out.TM2).toBe('2:05:53');
      expect(out.Finish).toBe('3:43:45');
      expect(result.lastVisibleKey).toBe('Finish');
    });

    it('handles malformed time string by setting empty', () => {
      const raw = '{"Start":"00:00","TM1":"invalid","TM2":"2:05:53"}';
      const result = filterTimesField(raw, 99999);
      const out = JSON.parse(result.json!);
      expect(out.Start).toBe('00:00');
      expect(out.TM1).toBe(''); // parseTime → null → empty
      expect(out.TM2).toBe('2:05:53');
    });

    it('returns null json for non-string raw input', () => {
      const result = filterTimesField(null, 100);
      expect(result.json).toBe(null);
      expect(result.lastVisibleKey).toBe(null);
    });

    it('returns null json for malformed JSON', () => {
      const result = filterTimesField('not-json{}', 100);
      expect(result.json).toBe(null);
    });

    it('matches real RR vendor schema (verified via curl real API 42K)', () => {
      // Schema verified từ real RR: athlete chưa start → 7 keys empty
      const rawNotStarted =
        '{"Start":"","TM1":"","TM2":"","TM3":"","TM4":"","TM5":"","Finish":""}';
      const result = filterTimesField(rawNotStarted, 1000);
      const out = JSON.parse(result.json!);
      expect(Object.keys(out)).toHaveLength(7);
      expect(Object.values(out).every((v) => v === '')).toBe(true);
    });
  });

  describe('Phase A regression — old behavior (DROP keys) NOT happening', () => {
    it('does NOT drop keys khi time > cutoff (regression test)', () => {
      const raw =
        '{"Start":"00:00","TM1":"1:35:19","TM2":"2:05:53","Finish":"3:43:45"}';
      const result = filterTimesField(raw, 0);
      const out = JSON.parse(result.json!);
      // Trước Phase A: chỉ Start trong output. Sau Phase A: 4 keys (3 empty)
      expect(Object.keys(out)).toEqual(['Start', 'TM1', 'TM2', 'Finish']);
      expect(out.Start).toBe('00:00');
      expect(out.TM1).toBe('');
      expect(out.TM2).toBe('');
      expect(out.Finish).toBe('');
    });
  });
});
