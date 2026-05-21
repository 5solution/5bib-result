/**
 * FEATURE-056 — Pure aggregation helper unit tests (BR-56-18 mandate).
 *
 * Tests cover:
 *  - computePodium happy path + edge (1 finisher / empty) + tie-break by chipTime
 *  - computePaceStats median/p10/p90 correctness + distribution length
 *  - computeAGBreakdown grouping + top5 sort + skip rows without category
 *  - computeStatusCounts buckets per status derivation
 *  - computeNegSplit chiptimes parsing + percent + avg + interpretation
 *  - chipTimeToSeconds / paceToSeconds / normalizeGenderToken pure helpers
 */
import {
  chipTimeToSeconds,
  paceToSeconds,
  secondsToChipTime,
  secondsToPace,
  normalizeGenderToken,
  isFinisherChipTime,
  computePodium,
  computePaceStats,
  computeAGBreakdown,
  computeStatusCounts,
  computeNegSplit,
  RaceResultLean,
} from './race-aggregations';

function row(overrides: Partial<RaceResultLean>): RaceResultLean {
  return {
    bib: overrides.bib ?? '1',
    name: overrides.name ?? 'Test',
    chipTime: overrides.chipTime ?? '3:30:00',
    category: overrides.category,
    gender: overrides.gender ?? 'male',
    genderRank: overrides.genderRank,
    genderRankNumeric: overrides.genderRankNumeric,
    chiptimes: overrides.chiptimes,
    pace: overrides.pace ?? '5:00/km',
    started: overrides.started,
    club: overrides.club,
    nationality: overrides.nationality,
    avatarUrl: overrides.avatarUrl,
  };
}

describe('race-aggregations — pure time helpers', () => {
  it('chipTimeToSeconds: parses hh:mm:ss', () => {
    expect(chipTimeToSeconds('3:15:30')).toBe(3 * 3600 + 15 * 60 + 30);
  });
  it('chipTimeToSeconds: parses mm:ss (BR-46-26 short race)', () => {
    expect(chipTimeToSeconds('23:45')).toBe(23 * 60 + 45);
  });
  it('chipTimeToSeconds: returns 0 for empty / invalid', () => {
    expect(chipTimeToSeconds('')).toBe(0);
    expect(chipTimeToSeconds('0:00:00')).toBe(0);
    expect(chipTimeToSeconds(undefined)).toBe(0);
    expect(chipTimeToSeconds('abc')).toBe(0);
  });

  it('secondsToChipTime: round-trip', () => {
    expect(secondsToChipTime(3 * 3600 + 15 * 60 + 30)).toBe('03:15:30');
    expect(secondsToChipTime(0)).toBe('00:00:00');
  });

  it('paceToSeconds: strips /km suffix', () => {
    expect(paceToSeconds('5:30/km')).toBe(5 * 60 + 30);
    expect(paceToSeconds('5:30')).toBe(5 * 60 + 30);
    expect(paceToSeconds(undefined)).toBe(0);
  });

  it('secondsToPace: formats', () => {
    expect(secondsToPace(5 * 60 + 30)).toBe('5:30/km');
    expect(secondsToPace(0)).toBe('—');
  });

  it('normalizeGenderToken: maps vendor variants', () => {
    expect(normalizeGenderToken('male')).toBe('male');
    expect(normalizeGenderToken('M')).toBe('male');
    expect(normalizeGenderToken('Nam')).toBe('male');
    expect(normalizeGenderToken('F')).toBe('female');
    expect(normalizeGenderToken('nữ')).toBe('female');
    expect(normalizeGenderToken('Other')).toBeNull();
    expect(normalizeGenderToken(undefined)).toBeNull();
  });

  it('isFinisherChipTime: non-zero positive', () => {
    expect(isFinisherChipTime('3:15:23')).toBe(true);
    expect(isFinisherChipTime('0:00:00')).toBe(false);
    expect(isFinisherChipTime('')).toBe(false);
    expect(isFinisherChipTime(undefined)).toBe(false);
  });
});

describe('computePodium', () => {
  it('Top 3 M + F sorted by genderRankNumeric ASC, medals gold/silver/bronze', () => {
    const rows = [
      row({ bib: 'M1', gender: 'male', genderRankNumeric: 3, chipTime: '3:30:00' }),
      row({ bib: 'M2', gender: 'male', genderRankNumeric: 1, chipTime: '2:45:00' }),
      row({ bib: 'M3', gender: 'male', genderRankNumeric: 2, chipTime: '3:00:00' }),
      row({ bib: 'M4', gender: 'male', genderRankNumeric: 4, chipTime: '3:45:00' }),
      row({ bib: 'F1', gender: 'female', genderRankNumeric: 1, chipTime: '3:15:00' }),
      row({ bib: 'F2', gender: 'female', genderRankNumeric: 2, chipTime: '3:30:00' }),
    ];
    const res = computePodium(rows);
    expect(res.male.map((c) => c.bib)).toEqual(['M2', 'M3', 'M1']);
    expect(res.male[0].medal).toBe('gold');
    expect(res.male[1].medal).toBe('silver');
    expect(res.male[2].medal).toBe('bronze');
    expect(res.female).toHaveLength(2);
    expect(res.maleFinisherCount).toBe(4);
    expect(res.femaleFinisherCount).toBe(2);
  });

  it('Tie-break: missing genderRankNumeric → chipTime ASC', () => {
    const rows = [
      row({ bib: 'A', gender: 'male', chipTime: '3:30:00' }), // no rank
      row({ bib: 'B', gender: 'male', chipTime: '2:45:00' }),
      row({ bib: 'C', gender: 'male', chipTime: '3:00:00' }),
    ];
    const res = computePodium(rows);
    expect(res.male.map((c) => c.bib)).toEqual(['B', 'C', 'A']);
  });

  it('Edge: only 1 finisher', () => {
    const rows = [row({ bib: '1', gender: 'male', chipTime: '3:00:00' })];
    const res = computePodium(rows);
    expect(res.male).toHaveLength(1);
    expect(res.male[0].medal).toBe('gold');
    expect(res.female).toHaveLength(0);
  });

  it('Edge: empty input', () => {
    expect(computePodium([])).toEqual({
      male: [],
      female: [],
      maleFinisherCount: 0,
      femaleFinisherCount: 0,
    });
  });

  it('DNS rows excluded (chipTime "0:00:00")', () => {
    const rows = [
      row({ bib: '1', gender: 'male', chipTime: '0:00:00' }),
      row({ bib: '2', gender: 'male', chipTime: '3:00:00' }),
    ];
    const res = computePodium(rows);
    expect(res.male.map((c) => c.bib)).toEqual(['2']);
  });
});

describe('computePaceStats', () => {
  it('median / p10 / p90 from sorted finisher paces', () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      row({
        bib: String(i),
        chipTime: '3:00:00',
        // paces: 4:00, 4:30, 5:00, ..., 8:30 (10 distinct, ascending)
        pace: `${4 + Math.floor(i / 2)}:${i % 2 === 0 ? '00' : '30'}/km`,
      }),
    );
    const res = computePaceStats(rows);
    expect(res.finisherCount).toBe(10);
    expect(res.distribution).toHaveLength(10);
    expect(res.medianPace).toMatch(/\d+:\d{2}\/km/);
    expect(res.p10Pace).toMatch(/\d+:\d{2}\/km/);
    expect(res.p90Pace).toMatch(/\d+:\d{2}\/km/);
  });

  it('Empty finishers → "—" sentinels', () => {
    expect(computePaceStats([])).toMatchObject({
      medianPace: '—',
      p10Pace: '—',
      p90Pace: '—',
      finisherCount: 0,
    });
  });
});

describe('computeAGBreakdown', () => {
  it('Groups by category + Top 5 sorted by genderRankNumeric ASC', () => {
    const rows: RaceResultLean[] = [
      row({ bib: '1', category: 'M30-39', chipTime: '3:00:00', genderRankNumeric: 1 }),
      row({ bib: '2', category: 'M30-39', chipTime: '3:15:00', genderRankNumeric: 2 }),
      row({ bib: '3', category: 'F30-39', chipTime: '3:30:00', genderRankNumeric: 1, gender: 'female' }),
      row({ bib: '4', category: '', chipTime: '4:00:00' }), // no category → skipped
    ];
    const res = computeAGBreakdown(rows);
    const m = res.find((b) => b.category === 'M30-39');
    expect(m?.finisherCount).toBe(2);
    expect(m?.top5).toHaveLength(2);
    expect(m?.top5[0].bib).toBe('1');
    const noEmpty = res.find((b) => b.category === '');
    expect(noEmpty).toBeUndefined();
  });

  it('Empty input → []', () => {
    expect(computeAGBreakdown([])).toEqual([]);
  });
});

describe('computeStatusCounts', () => {
  it('Buckets per status field', () => {
    const rows = [
      row({ bib: '1', chipTime: '3:00:00' }), // finished
      row({ bib: '2', chipTime: '', started: 1 }), // dnf
      row({ bib: '3', chipTime: '0:00:00' }), // dns
    ];
    const res = computeStatusCounts(rows);
    expect(res.finishers).toBe(1);
    expect(res.dnf).toBe(1);
    expect(res.dns).toBe(1);
    expect(res.dsq).toBe(0);
    expect(res.registered).toBe(3);
  });
});

describe('computeNegSplit (BR-56-09 + Clarification #3)', () => {
  // 1st half = 1:35:00 (5700s), 2nd half = 3:15:23 - 1:35:00 = 1:40:23 (6023s)
  // 2H > 1H → positive split (NOT negative)
  const positiveSplitRow = row({
    bib: '101',
    chipTime: '3:15:23',
    chiptimes: JSON.stringify({ Start: '0:00', '21K': '1:35:00', Finish: '3:15:23' }),
  });

  // 1st half = 1:45:00 (6300s), 2nd half = 3:30:00 - 1:45:00 = 1:45:00 (6300s) — neutral
  // Force negative by making midpoint > halfTime: chiptime midpoint 1:55:00, finish 3:30:00
  // midpoint=1:55:00 (6900s), halfTime=6300s. diff=600s
  // 2nd half = 3:30:00 - 1:55:00 = 1:35:00 (5700s). 5700 < 6900 → NEGATIVE split.
  const negativeSplitRow = row({
    bib: '102',
    chipTime: '3:30:00',
    chiptimes: JSON.stringify({ Start: '0:00', '21K': '1:55:00', Finish: '3:30:00' }),
  });

  it('Computes percent + averages + interpretation', () => {
    const rows = [positiveSplitRow, negativeSplitRow];
    const res = computeNegSplit(rows);
    expect(res.finishersAnalyzed).toBe(2);
    expect(res.value).toBe(50);
    expect(res.benchmark).toBe(40);
    expect(res.avgFirstHalf).toMatch(/\d{2}:\d{2}:\d{2}/);
    expect(res.avgSecondHalf).toMatch(/\d{2}:\d{2}:\d{2}/);
    expect(res.interpretation).toContain('50');
  });

  it('Interpretation thresholds: <20% → "kỹ thuật cao"', () => {
    // 100 finishers, 19 negative
    const rows: RaceResultLean[] = [];
    for (let i = 0; i < 81; i++) {
      rows.push(row({ bib: `P${i}`, chipTime: '3:15:23', chiptimes: JSON.stringify({ Start: '0:00', '21K': '1:35:00', Finish: '3:15:23' }) }));
    }
    for (let i = 0; i < 19; i++) {
      rows.push(row({ bib: `N${i}`, chipTime: '3:30:00', chiptimes: JSON.stringify({ Start: '0:00', '21K': '1:55:00', Finish: '3:30:00' }) }));
    }
    const res = computeNegSplit(rows);
    expect(res.value).toBe(19);
    expect(res.interpretation).toContain('kỹ thuật cao');
  });

  it('Interpretation thresholds: 20-40% → "phù hợp đa số"', () => {
    // 100 finishers, 30 negative
    const rows: RaceResultLean[] = [];
    for (let i = 0; i < 70; i++) {
      rows.push(row({ bib: `P${i}`, chipTime: '3:15:23', chiptimes: JSON.stringify({ Start: '0:00', '21K': '1:35:00', Finish: '3:15:23' }) }));
    }
    for (let i = 0; i < 30; i++) {
      rows.push(row({ bib: `N${i}`, chipTime: '3:30:00', chiptimes: JSON.stringify({ Start: '0:00', '21K': '1:55:00', Finish: '3:30:00' }) }));
    }
    const res = computeNegSplit(rows);
    expect(res.value).toBe(30);
    expect(res.interpretation).toContain('phù hợp đa số');
  });

  it('Interpretation thresholds: >40% → "dễ pacing"', () => {
    const rows: RaceResultLean[] = [];
    for (let i = 0; i < 30; i++) {
      rows.push(row({ bib: `P${i}`, chipTime: '3:15:23', chiptimes: JSON.stringify({ Start: '0:00', '21K': '1:35:00', Finish: '3:15:23' }) }));
    }
    for (let i = 0; i < 70; i++) {
      rows.push(row({ bib: `N${i}`, chipTime: '3:30:00', chiptimes: JSON.stringify({ Start: '0:00', '21K': '1:55:00', Finish: '3:30:00' }) }));
    }
    const res = computeNegSplit(rows);
    expect(res.value).toBe(70);
    expect(res.interpretation).toContain('dễ pacing');
  });

  it('Malformed chiptimes JSON → skip row, no throw', () => {
    const rows = [
      row({ bib: '1', chipTime: '3:00:00', chiptimes: 'not-json' }),
      positiveSplitRow,
    ];
    const res = computeNegSplit(rows);
    expect(res.finishersAnalyzed).toBe(1);
  });

  it('Only Start + Finish (no midpoint) → skip', () => {
    const rows = [
      row({
        bib: '1',
        chipTime: '3:00:00',
        chiptimes: JSON.stringify({ Start: '0:00', Finish: '3:00:00' }),
      }),
    ];
    const res = computeNegSplit(rows);
    expect(res.finishersAnalyzed).toBe(0);
    expect(res.value).toBe(0);
    expect(res.interpretation).toContain('Không đủ dữ liệu');
  });

  it('Empty finishers → graceful zeros', () => {
    const res = computeNegSplit([]);
    expect(res.value).toBe(0);
    expect(res.benchmark).toBe(40);
    expect(res.avgFirstHalf).toBe('00:00:00');
    expect(res.avgSecondHalf).toBe('00:00:00');
    expect(res.deltaSeconds).toBe(0);
    expect(res.finishersAnalyzed).toBe(0);
  });
});
