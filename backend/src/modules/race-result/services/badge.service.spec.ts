import {
  parseChipTime,
  parseDistanceKm,
  normalizeName,
  detectPodiumLogic,
  detectAgePodiumLogic,
  detectSubXLogic,
  detectUltraLogic,
  isValidFinisher,
} from './badge.service';

// FEATURE-021 BR-DISPLAY-01 — convenience finisher fixture so existing tests
// stay focused on rank/distance behaviour. Override fields per-test as needed.
const VALID_FINISHER = { finished: 1, chipTime: '1:00:00' } as const;

describe('parseChipTime', () => {
  it('parses H:MM:SS', () => {
    expect(parseChipTime('1:23:45')).toBe(1 * 3600 + 23 * 60 + 45);
  });
  it('parses MM:SS', () => {
    expect(parseChipTime('23:45')).toBe(23 * 60 + 45);
  });
  it('parses H:MM:SS.sss with milliseconds', () => {
    expect(parseChipTime('1:00:00.500')).toBeCloseTo(3600.5, 2);
  });
  it('returns 0 for empty/null input', () => {
    expect(parseChipTime('')).toBe(0);
    expect(parseChipTime(undefined)).toBe(0);
    expect(parseChipTime(null)).toBe(0);
  });
  it('returns 0 for malformed input', () => {
    expect(parseChipTime('abc:xx:yy')).toBe(0);
  });
});

describe('parseDistanceKm', () => {
  it.each([
    ['21km', 21],
    ['21 km', 21],
    ['21K', 21],
    ['21k', 21],
    ['42.195km', 42.195],
    ['42.195 km', 42.195],
    ['10K', 10],
    ['5K', 5],
    ['5 k', 5],
    ['42', 42],
    ['Marathon', 42],
    ['Full Marathon', 42],
    ['Half Marathon', 21],
    ['Half', 21],
    ['HM', 21],
    ['FM', 42],
    ['100K', 100],
    ['50K', 50],
  ])('parses "%s" as %s km', (input, expected) => {
    expect(parseDistanceKm(input)).toBeCloseTo(expected, 2);
  });

  it('converts miles to km (100M = ~160.9km)', () => {
    expect(parseDistanceKm('100mi')).toBeCloseTo(160.934, 2);
    expect(parseDistanceKm('50 miles')).toBeCloseTo(80.467, 2);
  });

  it('returns 0 for empty input', () => {
    expect(parseDistanceKm('')).toBe(0);
  });

  it('returns 0 for unparseable input', () => {
    expect(parseDistanceKm('Trail run xyz')).toBe(0);
  });

  it('handles bare number at reasonable range', () => {
    expect(parseDistanceKm('50')).toBe(50);
  });

  it('returns 0 for nonsensical bare number (>300)', () => {
    expect(parseDistanceKm('9999')).toBe(0);
  });
});

describe('normalizeName', () => {
  it('lowercases + strips diacritics (Vietnamese)', () => {
    expect(normalizeName('Nguyễn Văn Ánh')).toBe('nguyen van anh');
  });
  it('collapses multiple whitespace', () => {
    expect(normalizeName('  John   Doe  ')).toBe('john doe');
  });
  it('returns empty string for falsy input', () => {
    expect(normalizeName('')).toBe('');
    expect(normalizeName(null)).toBe('');
    expect(normalizeName(undefined)).toBe('');
  });
  it('handles names without diacritics', () => {
    expect(normalizeName('John Doe')).toBe('john doe');
  });
  it('equates decomposed and composed forms', () => {
    const composed = 'à';
    const decomposed = 'a\u0300';
    expect(normalizeName(composed)).toBe('a');
    expect(normalizeName(decomposed)).toBe('a');
  });
});

describe('detectPodiumLogic', () => {
  it('returns gold badge for rank 1', () => {
    const b = detectPodiumLogic({ ...VALID_FINISHER, overallRankNumeric: 1 });
    expect(b).toMatchObject({
      type: 'PODIUM',
      shortLabel: '#1',
      color: '#f59e0b',
    });
    expect(b?.label).toContain('Vô địch');
  });
  it('returns silver badge for rank 2', () => {
    const b = detectPodiumLogic({ ...VALID_FINISHER, overallRankNumeric: 2 });
    expect(b?.shortLabel).toBe('#2');
    expect(b?.color).toBe('#94a3b8');
  });
  it('returns bronze badge for rank 3', () => {
    const b = detectPodiumLogic({ ...VALID_FINISHER, overallRankNumeric: 3 });
    expect(b?.shortLabel).toBe('#3');
  });
  it('returns null for rank > 3', () => {
    expect(
      detectPodiumLogic({ ...VALID_FINISHER, overallRankNumeric: 4 }),
    ).toBeNull();
    expect(
      detectPodiumLogic({ ...VALID_FINISHER, overallRankNumeric: 999 }),
    ).toBeNull();
  });
  it('returns null for missing rank', () => {
    expect(detectPodiumLogic({ ...VALID_FINISHER })).toBeNull();
  });
  it('falls back to string rank if numeric missing', () => {
    expect(
      detectPodiumLogic({ ...VALID_FINISHER, overallRank: '2' })?.shortLabel,
    ).toBe('#2');
  });
  it('returns null for non-numeric string', () => {
    expect(
      detectPodiumLogic({ ...VALID_FINISHER, overallRank: 'DNF' }),
    ).toBeNull();
  });
});

describe('detectAgePodiumLogic', () => {
  it('returns AG podium for rank 1 with category label', () => {
    const b = detectAgePodiumLogic({
      ...VALID_FINISHER,
      categoryRankNumeric: 1,
      category: 'M40-44',
    });
    expect(b?.type).toBe('AG_PODIUM');
    expect(b?.shortLabel).toBe('AG#1');
    expect(b?.label).toContain('M40-44');
  });
  it('returns null for rank > 3', () => {
    expect(
      detectAgePodiumLogic({ ...VALID_FINISHER, categoryRankNumeric: 4 }),
    ).toBeNull();
  });
  it('handles missing category gracefully', () => {
    const b = detectAgePodiumLogic({
      ...VALID_FINISHER,
      categoryRankNumeric: 1,
    });
    expect(b?.label).toContain('Age Group');
  });
});

describe('detectSubXLogic', () => {
  it('Sub-3H for marathon under 3 hours', () => {
    const b = detectSubXLogic({ distance: '42km', chipTime: '2:59:00' });
    expect(b).toHaveLength(1);
    expect(b[0].type).toBe('SUB3H');
  });

  it('Sub-3:30H for marathon under 3:30 but over 3H', () => {
    const b = detectSubXLogic({ distance: 'Marathon', chipTime: '3:25:00' });
    expect(b[0].type).toBe('SUB3_30H');
  });

  it('Sub-4H for marathon under 4:00 but over 3:30', () => {
    const b = detectSubXLogic({ distance: '42.195km', chipTime: '3:59:00' });
    expect(b[0].type).toBe('SUB4H');
  });

  it('no Sub-X for marathon over 4 hours', () => {
    expect(detectSubXLogic({ distance: '42km', chipTime: '4:15:00' })).toEqual([]);
  });

  it('Sub-90M for half-marathon under 90 min', () => {
    const b = detectSubXLogic({ distance: '21km', chipTime: '1:29:30' });
    expect(b[0].type).toBe('SUB90M');
  });

  it('Sub-1:45 for half under 1:45', () => {
    const b = detectSubXLogic({ distance: 'Half Marathon', chipTime: '1:42:00' });
    expect(b[0].type).toBe('SUB_1_45H');
  });

  it('Sub-45M for 10K under 45 min', () => {
    const b = detectSubXLogic({ distance: '10K', chipTime: '44:30' });
    expect(b[0].type).toBe('SUB45M');
  });

  it('Sub-20M for 5K under 20 min', () => {
    const b = detectSubXLogic({ distance: '5K', chipTime: '19:45' });
    expect(b[0].type).toBe('SUB20M');
  });

  it('returns empty array for unrecognized distance', () => {
    expect(detectSubXLogic({ distance: '13.1km', chipTime: '1:00:00' })).toEqual([]);
  });

  it('returns empty array for invalid chip time', () => {
    expect(detectSubXLogic({ distance: '42km', chipTime: 'DNF' })).toEqual([]);
  });

  it('picks fastest tier achieved (Sub-3 beats Sub-3:30 beats Sub-4)', () => {
    // 2:50 is under all three — should return Sub-3H (fastest tier listed first)
    const b = detectSubXLogic({ distance: '42km', chipTime: '2:50:00' });
    expect(b[0].type).toBe('SUB3H');
  });
});

describe('detectUltraLogic', () => {
  it('returns ultra for 50K', () => {
    const b = detectUltraLogic({ ...VALID_FINISHER, distance: '50K' });
    expect(b?.type).toBe('ULTRA');
  });
  it('returns ultra for 100K', () => {
    expect(
      detectUltraLogic({ ...VALID_FINISHER, distance: '100km' })?.type,
    ).toBe('ULTRA');
  });
  it('returns ultra for UTMB keyword', () => {
    expect(
      detectUltraLogic({ ...VALID_FINISHER, distance: 'UTMB MCC' })?.type,
    ).toBe('ULTRA');
  });
  it('returns ultra for "ultra" keyword', () => {
    expect(
      detectUltraLogic({ ...VALID_FINISHER, distance: 'Ultra Trail 80k' })?.type,
    ).toBe('ULTRA');
  });
  it('returns ultra for 100 miles', () => {
    expect(
      detectUltraLogic({ ...VALID_FINISHER, distance: '100mi' })?.type,
    ).toBe('ULTRA');
  });
  it('returns null for marathon (42km — below 50km)', () => {
    expect(
      detectUltraLogic({ ...VALID_FINISHER, distance: '42km' }),
    ).toBeNull();
  });
  it('returns null for half marathon', () => {
    expect(
      detectUltraLogic({ ...VALID_FINISHER, distance: '21km' }),
    ).toBeNull();
  });
  it('returns null for missing distance', () => {
    expect(detectUltraLogic({ ...VALID_FINISHER })).toBeNull();
  });
});

// ─── FEATURE-021 BR-DISPLAY-01/05/06 — Public Display Celebration BUGFIX ──

describe('FEATURE-021 — parseDistanceKm meters vs miles disambiguation', () => {
  // BR-DISPLAY-05 — meters
  it('parses meters: "4800m" → 4.8 (BR-DISPLAY-05)', () => {
    expect(parseDistanceKm('4800m')).toBeCloseTo(4.8, 3);
  });
  it('parses meters: "5000m" → 5', () => {
    expect(parseDistanceKm('5000m')).toBe(5);
  });
  it('parses meters with decimal: "4800.5m" → 4.8005', () => {
    expect(parseDistanceKm('4800.5m')).toBeCloseTo(4.8005, 4);
  });

  // BR-DISPLAY-06 — kilometers (no regression)
  it('parses kilometers lowercase: "5km" → 5', () => {
    expect(parseDistanceKm('5km')).toBe(5);
  });
  it('parses kilometers uppercase: "5K" → 5', () => {
    expect(parseDistanceKm('5K')).toBe(5);
  });

  // BR-DISPLAY-06 — miles (no regression)
  it('parses miles short form: "100mi" → 160.934', () => {
    expect(parseDistanceKm('100mi')).toBeCloseTo(160.934, 2);
  });
  it('parses miles long form: "100miles" → 160.934', () => {
    expect(parseDistanceKm('100miles')).toBeCloseTo(160.934, 2);
  });

  // Documented choice for ambiguous uppercase `M`: treat as miles
  // (Vietnamese vendor convention — original behaviour preserved).
  it('treats uppercase "100M" as miles → 160.934 (documented choice)', () => {
    expect(parseDistanceKm('100M')).toBeCloseTo(160.934, 2);
  });

  // Bare numbers + edge cases
  it('parses bare number: "42.195" → 42.195', () => {
    expect(parseDistanceKm('42.195')).toBeCloseTo(42.195, 3);
  });
  it('returns 0 for empty string', () => {
    expect(parseDistanceKm('')).toBe(0);
  });
});

describe('FEATURE-021 — isValidFinisher (BR-DISPLAY-01)', () => {
  it('returns true for finished=1 with valid chipTime', () => {
    expect(isValidFinisher({ finished: 1, chipTime: '40:47' })).toBe(true);
    expect(isValidFinisher({ finished: 1, chipTime: '1:23:45' })).toBe(true);
  });
  it('returns false for finished=0', () => {
    expect(isValidFinisher({ finished: 0, chipTime: '40:47' })).toBe(false);
  });
  it('returns false for finished=undefined', () => {
    expect(isValidFinisher({ chipTime: '40:47' })).toBe(false);
  });
  it('returns false for chipTime="" even if finished=1', () => {
    expect(isValidFinisher({ finished: 1, chipTime: '' })).toBe(false);
  });
  it('returns false for chipTime="0:00" even if finished=1', () => {
    expect(isValidFinisher({ finished: 1, chipTime: '0:00' })).toBe(false);
  });
  it('returns false for chipTime missing', () => {
    expect(isValidFinisher({ finished: 1 })).toBe(false);
  });
});

describe('FEATURE-021 — detectPodiumLogic finished guard (BR-DISPLAY-01)', () => {
  it('fires PODIUM for finished=1, chipTime="40:47", rank=1', () => {
    const b = detectPodiumLogic({
      finished: 1,
      chipTime: '40:47',
      overallRankNumeric: 1,
    });
    expect(b?.type).toBe('PODIUM');
  });
  it('returns null for finished=0 even if rank=1 (vendor pre-race rank leak)', () => {
    expect(
      detectPodiumLogic({
        finished: 0,
        chipTime: '',
        overallRankNumeric: 1,
      }),
    ).toBeNull();
  });
  it('returns null for chipTime="0:00" even if finished=1', () => {
    expect(
      detectPodiumLogic({
        finished: 1,
        chipTime: '0:00',
        overallRankNumeric: 1,
      }),
    ).toBeNull();
  });
  it('returns null for chipTime="" even if finished=1', () => {
    expect(
      detectPodiumLogic({
        finished: 1,
        chipTime: '',
        overallRankNumeric: 1,
      }),
    ).toBeNull();
  });
});

describe('FEATURE-021 — detectAgePodiumLogic finished guard (BR-DISPLAY-01)', () => {
  it('fires AG_PODIUM for finished=1, chipTime>0, ageGroupRank=2', () => {
    const b = detectAgePodiumLogic({
      finished: 1,
      chipTime: '45:00',
      categoryRankNumeric: 2,
      category: 'F35-39',
    });
    expect(b?.type).toBe('AG_PODIUM');
  });
  it('returns null for finished=0', () => {
    expect(
      detectAgePodiumLogic({
        finished: 0,
        chipTime: '',
        categoryRankNumeric: 1,
      }),
    ).toBeNull();
  });
  it('returns null for chipTime="0:00"', () => {
    expect(
      detectAgePodiumLogic({
        finished: 1,
        chipTime: '0:00',
        categoryRankNumeric: 1,
      }),
    ).toBeNull();
  });
  it('returns null for chipTime=""', () => {
    expect(
      detectAgePodiumLogic({
        finished: 1,
        chipTime: '',
        categoryRankNumeric: 1,
      }),
    ).toBeNull();
  });
});

describe('FEATURE-021 — detectUltraLogic finished guard + meters parsing', () => {
  it('fires ULTRA for finished=1, chipTime>0, distance="50km"', () => {
    expect(
      detectUltraLogic({
        finished: 1,
        chipTime: '6:30:00',
        distance: '50km',
      })?.type,
    ).toBe('ULTRA');
  });
  it('fires ULTRA for finished=1, distance="100mi" (160km)', () => {
    expect(
      detectUltraLogic({
        finished: 1,
        chipTime: '24:00:00',
        distance: '100mi',
      })?.type,
    ).toBe('ULTRA');
  });
  it('returns null for finished=0 even if distance="50km"', () => {
    expect(
      detectUltraLogic({
        finished: 0,
        chipTime: '',
        distance: '50km',
      }),
    ).toBeNull();
  });
  it('returns null for finished=1, distance="4800m" (= 4.8km, NOT ultra — Bug #1 regression)', () => {
    expect(
      detectUltraLogic({
        finished: 1,
        chipTime: '30:00',
        distance: '4800m',
      }),
    ).toBeNull();
  });
  it('returns null for finished=1, distance="42.195km" (= marathon, below 50km)', () => {
    expect(
      detectUltraLogic({
        finished: 1,
        chipTime: '4:00:00',
        distance: '42.195km',
      }),
    ).toBeNull();
  });
});
